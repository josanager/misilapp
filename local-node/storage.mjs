import path from 'node:path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { CHUNK_SIZE, DATA_DIR, QUOTA_BYTES } from './config.mjs';
import { db } from './database.mjs';

const BLOB_DIR = path.join(DATA_DIR, 'blobs');
const TEMP_DIR = path.join(DATA_DIR, 'tmp');
const KEY_PATH = path.join(DATA_DIR, 'master.key');
let masterKey;
let commitQueue = Promise.resolve();

async function withCommitLock(task) {
  const previous = commitQueue;
  let release;
  commitQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

export async function initializeStorage() {
  await mkdir(BLOB_DIR, { recursive: true, mode: 0o700 });
  await mkdir(TEMP_DIR, { recursive: true, mode: 0o700 });
  try {
    masterKey = await readFile(KEY_PATH);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    masterKey = randomBytes(32);
    await writeFile(KEY_PATH, masterKey, { mode: 0o600, flag: 'wx' });
  }
  if (masterKey.length !== 32) throw new Error('La clave maestra local no es válida.');
  await chmod(KEY_PATH, 0o600);
  await rm(TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEMP_DIR, { recursive: true, mode: 0o700 });
}

export function storageStatus() {
  const result = db.prepare('SELECT COALESCE(SUM(stored_size), 0) AS used FROM blobs').get();
  const usedBytes = Number(result.used);
  return {
    quotaBytes: QUOTA_BYTES,
    usedBytes,
    availableBytes: Math.max(0, QUOTA_BYTES - usedBytes),
    percentUsed: QUOTA_BYTES === 0 ? 0 : (usedBytes / QUOTA_BYTES) * 100,
    encrypted: true,
    chunkSize: CHUNK_SIZE,
    dataDirectory: DATA_DIR,
  };
}

function encryptChunk(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { encrypted, iv, authTag: cipher.getAuthTag() };
}

function decryptChunk(encrypted, iv, authTag) {
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export async function storeRequest(request, { fileName, contentType, contentLength }) {
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw Object.assign(new Error('La subida requiere un Content-Length válido.'), { statusCode: 411 });
  }
  if (contentLength > QUOTA_BYTES) {
    throw Object.assign(new Error('El archivo supera la cuota total del nodo local.'), { statusCode: 507 });
  }

  const tempId = randomUUID();
  const tempPath = path.join(TEMP_DIR, tempId);
  await mkdir(tempPath, { mode: 0o700 });
  const hash = createHash('sha256');
  const chunks = [];
  let pending = Buffer.alloc(0);
  let plainSize = 0;
  let storedSize = 0;

  const persistChunk = async (plain, index) => {
    hash.update(plain);
    const { encrypted, iv, authTag } = encryptChunk(plain);
    await writeFile(path.join(tempPath, `${index}.bin`), encrypted, { mode: 0o600 });
    chunks.push({
      index,
      plainSize: plain.length,
      storedSize: encrypted.length,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    });
    plainSize += plain.length;
    storedSize += encrypted.length;
  };

  try {
    for await (const incoming of request) {
      pending = Buffer.concat([pending, Buffer.from(incoming)]);
      while (pending.length >= CHUNK_SIZE) {
        await persistChunk(pending.subarray(0, CHUNK_SIZE), chunks.length);
        pending = pending.subarray(CHUNK_SIZE);
      }
      if (plainSize + pending.length > contentLength) {
        throw Object.assign(new Error('La carga excede el tamaño declarado.'), { statusCode: 400 });
      }
    }
    if (pending.length > 0 || contentLength === 0) await persistChunk(pending, chunks.length);
    if (plainSize !== contentLength) {
      throw Object.assign(new Error('La carga terminó con un tamaño diferente al declarado.'), { statusCode: 400 });
    }

    const sha256 = hash.digest('hex');
    return await withCommitLock(async () => {
      const duplicate = db.prepare('SELECT * FROM blobs WHERE sha256 = ?').get(sha256);
      if (duplicate) {
        await rm(tempPath, { recursive: true, force: true });
        return { ...duplicate, deduplicated: true };
      }

      const currentStatus = storageStatus();
      if (storedSize > currentStatus.availableBytes) {
        throw Object.assign(new Error('La cuota local se completó durante la subida.'), { statusCode: 507 });
      }

      const id = randomUUID();
      const finalPath = path.join(BLOB_DIR, id);
      await rename(tempPath, finalPath);
      const createdAt = new Date().toISOString();
      try {
        const saveBlob = db.transaction(() => {
          db.prepare(`
            INSERT INTO blobs
              (id, sha256, original_name, content_type, plain_size, stored_size, chunk_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, sha256, fileName, contentType, plainSize, storedSize, CHUNK_SIZE, createdAt);
          const insertChunk = db.prepare(`
            INSERT INTO blob_chunks
              (blob_id, chunk_index, plain_size, stored_size, iv, auth_tag)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const chunk of chunks) {
            insertChunk.run(id, chunk.index, chunk.plainSize, chunk.storedSize, chunk.iv, chunk.authTag);
          }
        });
        saveBlob();
      } catch (error) {
        await rm(finalPath, { recursive: true, force: true });
        throw error;
      }
      return db.prepare('SELECT * FROM blobs WHERE id = ?').get(id);
    });
  } catch (error) {
    await rm(tempPath, { recursive: true, force: true });
    throw error;
  }
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return { start: 0, end: size - 1, partial: false };
  if (size === 0) throw Object.assign(new Error('Un archivo vacío no admite rangos.'), { statusCode: 416 });
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) throw Object.assign(new Error('Rango no válido.'), { statusCode: 416 });
  let start;
  let end;
  if (match[1] === '' && match[2] !== '') {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
    throw Object.assign(new Error('Rango fuera del archivo.'), { statusCode: 416 });
  }
  return { start, end: Math.min(end, size - 1), partial: true };
}

export async function streamBlob(blobId, request, response) {
  const blob = db.prepare('SELECT * FROM blobs WHERE id = ?').get(blobId);
  if (!blob) throw Object.assign(new Error('Archivo no encontrado.'), { statusCode: 404 });
  const range = parseRange(request.headers.range, blob.plain_size);
  const firstChunk = Math.floor(range.start / blob.chunk_size);
  const lastChunk = Math.floor(range.end / blob.chunk_size);
  const chunks = db.prepare(`
    SELECT * FROM blob_chunks
    WHERE blob_id = ? AND chunk_index BETWEEN ? AND ?
    ORDER BY chunk_index
  `).all(blobId, firstChunk, lastChunk);

  response.statusCode = range.partial ? 206 : 200;
  response.setHeader('Content-Type', blob.content_type);
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Length', String(range.end - range.start + 1));
  response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(blob.original_name)}`);
  response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  if (range.partial) response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${blob.plain_size}`);

  for (const chunk of chunks) {
    const encrypted = await readFile(path.join(BLOB_DIR, blobId, `${chunk.chunk_index}.bin`));
    const plain = decryptChunk(encrypted, Buffer.from(chunk.iv, 'base64'), Buffer.from(chunk.auth_tag, 'base64'));
    const chunkStart = chunk.chunk_index * blob.chunk_size;
    const from = Math.max(0, range.start - chunkStart);
    const to = Math.min(plain.length, range.end - chunkStart + 1);
    if (to > from) response.write(plain.subarray(from, to));
  }
  response.end();
}

export async function removeBlobIfUnreferenced(blobId) {
  if (!blobId) return false;
  const references = db.prepare('SELECT COUNT(*) AS count FROM messages WHERE blob_id = ?').get(blobId);
  if (Number(references.count) > 0) return false;
  db.prepare('DELETE FROM blobs WHERE id = ?').run(blobId);
  await rm(path.join(BLOB_DIR, blobId), { recursive: true, force: true });
  return true;
}
