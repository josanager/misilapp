import path from 'node:path';

export const HUB_HOST = process.env.MISIL_HUB_HOST || '0.0.0.0';
export const HUB_PORT = Number.parseInt(process.env.MISIL_HUB_PORT || '4320', 10);
export const HUB_DATA_DIR = path.resolve(process.env.MISIL_HUB_DATA_DIR || '.misil-hub');
export const MAX_MESSAGE_BYTES = 64 * 1024;

if (!Number.isSafeInteger(HUB_PORT) || HUB_PORT < 1024 || HUB_PORT > 65535) {
  throw new Error('MISIL_HUB_PORT debe estar entre 1024 y 65535.');
}
