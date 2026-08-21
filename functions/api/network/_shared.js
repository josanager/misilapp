import {
  RelayError,
  handleError,
  parseJson,
  response,
  sha256Hex,
} from '../relay/_shared.js';

const NODE_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/i;
const APP_VERSION_PATTERN = /^[0-9A-Za-z.+_-]{1,32}$/;
const SUPPORTED_PLATFORMS = new Set(['windows', 'macos']);
const MAX_NODE_QUOTA_BYTES = 16 * 1024 * 1024 * 1024 * 1024;

export const PRESENCE_PROTOCOL_VERSION = 1;
export const HEARTBEAT_INTERVAL_SECONDS = 10;
export const OFFLINE_AFTER_SECONDS = 35;
export const OFFLINE_AFTER_MS = OFFLINE_AFTER_SECONDS * 1000;
let schemaReady;

export { RelayError, handleError, parseJson, response };

export function networkDatabase(binding) {
  return typeof binding.withSession === 'function'
    ? binding.withSession('first-primary')
    : binding;
}

export async function ensureNetworkSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS network_nodes (
          id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL,
          platform TEXT NOT NULL CHECK(platform IN ('windows', 'macos')),
          app_version TEXT NOT NULL,
          quota_bytes INTEGER NOT NULL DEFAULT 0 CHECK(quota_bytes >= 0),
          used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(used_bytes >= 0),
          storage_healthy INTEGER NOT NULL DEFAULT 0 CHECK(storage_healthy IN (0, 1)),
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL DEFAULT 0
        )
      `),
      db.prepare('CREATE INDEX IF NOT EXISTS network_nodes_presence_idx ON network_nodes(last_seen_at, storage_healthy)'),
      db.prepare('CREATE INDEX IF NOT EXISTS network_nodes_platform_idx ON network_nodes(platform, last_seen_at)'),
    ]).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

export function validateNodeId(value) {
  const nodeId = String(value || '').toLowerCase();
  if (!NODE_ID_PATTERN.test(nodeId)) throw new RelayError('Identificador de nodo no válido.', 400);
  return nodeId;
}

export function validateTokenHash(value) {
  const tokenHash = String(value || '').toLowerCase();
  if (!TOKEN_HASH_PATTERN.test(tokenHash)) throw new RelayError('Credencial de nodo no válida.', 400);
  return tokenHash;
}

export function validatePlatform(value) {
  const platform = String(value || '').toLowerCase();
  if (!SUPPORTED_PLATFORMS.has(platform)) throw new RelayError('Plataforma de nodo no válida.', 400);
  return platform;
}

export function validateAppVersion(value) {
  const appVersion = String(value || 'unknown');
  if (!APP_VERSION_PATTERN.test(appVersion)) throw new RelayError('Versión de aplicación no válida.', 400);
  return appVersion;
}

export function validateByteCount(value, name, maximum = MAX_NODE_QUOTA_BYTES) {
  const byteCount = Number(value);
  if (!Number.isSafeInteger(byteCount) || byteCount < 0 || byteCount > maximum) {
    throw new RelayError(`${name} no válido.`, 400);
  }
  return byteCount;
}

export async function authorizeNode(request, db, nodeId) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header);
  if (!match) throw new RelayError('Falta la credencial del nodo.', 401);
  const node = await db.prepare('SELECT token_hash FROM network_nodes WHERE id = ?').bind(nodeId).first();
  if (!node) throw new RelayError('El nodo no está registrado.', 404);
  if (await sha256Hex(match[1]) !== node.token_hash) throw new RelayError('Credencial de nodo incorrecta.', 403);
  return node;
}

export async function capacitySnapshot(db, now = Date.now()) {
  const cutoff = now - OFFLINE_AFTER_MS;
  const [summaryResult, platformsResult] = await db.batch([
    db.prepare(`
      SELECT
        COUNT(*) AS onlineNodes,
        COALESCE(SUM(quota_bytes), 0) AS totalQuotaBytes,
        COALESCE(SUM(used_bytes), 0) AS totalUsedBytes
      FROM network_nodes
      WHERE last_seen_at >= ? AND storage_healthy = 1 AND quota_bytes > 0
    `).bind(cutoff),
    db.prepare(`
      SELECT
        platform,
        COUNT(*) AS onlineNodes,
        COALESCE(SUM(quota_bytes), 0) AS quotaBytes
      FROM network_nodes
      WHERE last_seen_at >= ? AND storage_healthy = 1 AND quota_bytes > 0
      GROUP BY platform
      ORDER BY platform
    `).bind(cutoff),
  ]);

  const summary = summaryResult.results?.[0] || {};
  const totalQuotaBytes = Number(summary.totalQuotaBytes || 0);
  const totalUsedBytes = Number(summary.totalUsedBytes || 0);
  return {
    protocolVersion: PRESENCE_PROTOCOL_VERSION,
    generatedAt: new Date(now).toISOString(),
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    offlineAfterSeconds: OFFLINE_AFTER_SECONDS,
    onlineNodes: Number(summary.onlineNodes || 0),
    totalQuotaBytes,
    totalUsedBytes,
    availableBytes: Math.max(0, totalQuotaBytes - totalUsedBytes),
    platforms: (platformsResult.results || []).map((row) => ({
      platform: row.platform,
      onlineNodes: Number(row.onlineNodes || 0),
      quotaBytes: Number(row.quotaBytes || 0),
    })),
  };
}

export function networkMethodNotAllowed(allow) {
  return response({ error: 'Método no permitido.' }, 405, { Allow: `${allow}, OPTIONS` });
}
