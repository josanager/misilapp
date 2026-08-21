import {
  RelayError,
  ensureNetworkSchema,
  handleError,
  networkDatabase,
  networkMethodNotAllowed,
  parseJson,
  response,
  validateAppVersion,
  validateNodeId,
  validatePlatform,
  validateTokenHash,
} from './_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (context.request.method !== 'POST') return networkMethodNotAllowed('POST');

  try {
    const body = await parseJson(context.request);
    const nodeId = validateNodeId(body.nodeId);
    const tokenHash = validateTokenHash(body.tokenHash);
    const platform = validatePlatform(body.platform);
    const appVersion = validateAppVersion(body.appVersion);
    const db = networkDatabase(context.env.RELAY_DB);
    await ensureNetworkSchema(db);
    const existing = await db.prepare('SELECT token_hash FROM network_nodes WHERE id = ?').bind(nodeId).first();

    if (existing && existing.token_hash !== tokenHash) {
      throw new RelayError('Ese identificador de nodo ya está registrado.', 409);
    }

    const now = Date.now();
    await db.prepare(`
      INSERT INTO network_nodes
        (id, token_hash, platform, app_version, quota_bytes, used_bytes, storage_healthy, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        platform = excluded.platform,
        app_version = excluded.app_version
    `).bind(nodeId, tokenHash, platform, appVersion, now).run();

    return response({ ok: true, nodeId, protocolVersion: 1 }, existing ? 200 : 201);
  } catch (error) {
    return handleError(error);
  }
}
