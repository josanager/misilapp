import {
  authorizeNode,
  capacitySnapshot,
  ensureNetworkSchema,
  handleError,
  networkDatabase,
  networkMethodNotAllowed,
  parseJson,
  response,
  validateAppVersion,
  validateByteCount,
  validateNodeId,
  validatePlatform,
} from './_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!['PUT', 'DELETE'].includes(context.request.method)) return networkMethodNotAllowed('PUT, DELETE');

  try {
    const body = await parseJson(context.request);
    const nodeId = validateNodeId(body.nodeId);
    const db = networkDatabase(context.env.RELAY_DB);
    await ensureNetworkSchema(db);
    await authorizeNode(context.request, db, nodeId);

    if (context.request.method === 'DELETE') {
      await db.prepare(`
        UPDATE network_nodes
        SET last_seen_at = 0, quota_bytes = 0, used_bytes = 0, storage_healthy = 0
        WHERE id = ?
      `).bind(nodeId).run();
      return response({ ok: true, nodeId, offline: true });
    }

    const quotaBytes = validateByteCount(body.quotaBytes, 'Cuota del nodo');
    const usedBytes = validateByteCount(body.usedBytes, 'Uso del nodo', quotaBytes);
    const platform = validatePlatform(body.platform);
    const appVersion = validateAppVersion(body.appVersion);
    const storageHealthy = body.storageHealthy === true ? 1 : 0;
    const now = Date.now();

    await db.prepare(`
      UPDATE network_nodes
      SET platform = ?, app_version = ?, quota_bytes = ?, used_bytes = ?,
          storage_healthy = ?, last_seen_at = ?
      WHERE id = ?
    `).bind(platform, appVersion, quotaBytes, usedBytes, storageHealthy, now, nodeId).run();

    return response(await capacitySnapshot(db, now));
  } catch (error) {
    return handleError(error);
  }
}
