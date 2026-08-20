import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForNode(baseUrl, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`MISIL Node terminó con código ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/v1/health`);
      if (response.ok) return;
    } catch { /* el proceso todavía está iniciando */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('MISIL Node no inició a tiempo.');
}

test('el nodo cifra, deduplica, sirve rangos y aplica la cuota', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'misil-node-test-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const quota = 2 * 1024 * 1024;
  const child = spawn(process.execPath, ['local-node/server.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      MISIL_DATA_DIR: dataDir,
      MISIL_NODE_PORT: String(port),
      MISIL_QUOTA_BYTES: String(quota),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(dataDir, { recursive: true, force: true });
  });

  await waitForNode(baseUrl, child);
  assert.equal(stderr, '');

  const health = await fetch(`${baseUrl}/v1/health`).then((response) => response.json());
  assert.equal(health.storage.quotaBytes, quota);
  assert.equal(health.storage.encrypted, true);

  const payload = Buffer.alloc(1024 * 1024 + 321, 0x5a);
  const upload = await fetch(`${baseUrl}/v1/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'prueba.bin' },
    body: payload,
  });
  assert.equal(upload.status, 201);
  const blob = await upload.json();
  assert.equal(blob.size, payload.length);
  assert.equal(blob.deduplicated, false);

  const downloaded = Buffer.from(await fetch(blob.url).then((response) => response.arrayBuffer()));
  assert.deepEqual(downloaded, payload);

  const rangeResponse = await fetch(blob.url, { headers: { Range: 'bytes=123-9876' } });
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers.get('content-range'), `bytes 123-9876/${payload.length}`);
  assert.deepEqual(Buffer.from(await rangeResponse.arrayBuffer()), payload.subarray(123, 9877));

  const chunkNames = await readdir(path.join(dataDir, 'blobs', blob.id));
  const encryptedChunk = await readFile(path.join(dataDir, 'blobs', blob.id, chunkNames[0]));
  assert.notDeepEqual(encryptedChunk.subarray(0, 1024), payload.subarray(0, 1024));

  const duplicateResponse = await fetch(`${baseUrl}/v1/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'copia.bin' },
    body: payload,
  });
  const duplicate = await duplicateResponse.json();
  assert.equal(duplicateResponse.status, 201, JSON.stringify(duplicate));
  assert.equal(duplicate.id, blob.id);
  assert.equal(duplicate.deduplicated, true);

  const afterDuplicate = await fetch(`${baseUrl}/v1/storage`).then((response) => response.json());
  assert.equal(afterDuplicate.usedBytes, payload.length);

  const oversized = await fetch(`${baseUrl}/v1/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'grande.bin' },
    body: Buffer.alloc(quota + 1),
  });
  assert.equal(oversized.status, 507);

  const removed = await fetch(`${baseUrl}/v1/blobs/${blob.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  const finalStatus = await fetch(`${baseUrl}/v1/storage`).then((response) => response.json());
  assert.equal(finalStatus.usedBytes, 0);

  const roomId = randomUUID();
  const accessToken = 'relay-test-token-that-is-long-enough-for-authentication';
  const tokenHash = createHash('sha256').update(accessToken).digest('hex');
  const roomResponse = await fetch(`${baseUrl}/api/relay/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, tokenHash }),
  });
  assert.equal(roomResponse.status, 201);

  const envelope = {
    roomId,
    id: randomUUID(),
    ciphertext: 'c29icmUtY2lmcmFkby1zaW4tdGV4dG8tbGVnaWJsZQ',
    iv: 'dmVjdG9yLWluaWNpYWw',
    createdAt: new Date().toISOString(),
  };
  const relayHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const relaySend = await fetch(`${baseUrl}/api/relay/messages`, {
    method: 'POST', headers: relayHeaders, body: JSON.stringify(envelope),
  });
  assert.equal(relaySend.status, 201);

  const relayList = await fetch(`${baseUrl}/api/relay/messages?roomId=${roomId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(relayList.status, 200);
  const relayBody = await relayList.json();
  assert.equal(relayBody.messages.length, 1);
  assert.equal(relayBody.messages[0].ciphertext, envelope.ciphertext);
  assert.equal(JSON.stringify(relayBody).includes('texto-legible'), false);

  const deniedRelay = await fetch(`${baseUrl}/api/relay/messages?roomId=${roomId}`, {
    headers: { Authorization: 'Bearer token-incorrecto-que-tambien-es-suficientemente-largo' },
  });
  assert.equal(deniedRelay.status, 403);
});
