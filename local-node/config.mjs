import path from 'node:path';

export const NODE_HOST = '127.0.0.1';
export const NODE_PORT = Number.parseInt(process.env.MISIL_NODE_PORT || '4317', 10);
export const DATA_DIR = path.resolve(process.env.MISIL_DATA_DIR || '.misil-data');
export const QUOTA_BYTES = Number.parseInt(
  process.env.MISIL_QUOTA_BYTES || String(10 * 1024 * 1024 * 1024),
  10,
);
export const CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_JSON_BYTES = 1024 * 1024;
export const PRESENCE_TTL_MS = Number.parseInt(
  process.env.MISIL_PRESENCE_TTL_MS || '35000',
  10,
);

if (!Number.isSafeInteger(NODE_PORT) || NODE_PORT < 1024 || NODE_PORT > 65535) {
  throw new Error('MISIL_NODE_PORT debe ser un puerto válido entre 1024 y 65535.');
}

if (!Number.isSafeInteger(QUOTA_BYTES) || QUOTA_BYTES <= 0) {
  throw new Error('MISIL_QUOTA_BYTES debe ser un entero positivo.');
}

if (!Number.isSafeInteger(PRESENCE_TTL_MS) || PRESENCE_TTL_MS < 100) {
  throw new Error('MISIL_PRESENCE_TTL_MS debe ser un entero de al menos 100 ms.');
}
