import { handleError, methodNotAllowed, parseJson, response, validateRoomId, validateTokenHash } from './_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (context.request.method !== 'POST') return methodNotAllowed();
  try {
    const body = await parseJson(context.request);
    const roomId = validateRoomId(body.roomId);
    const tokenHash = validateTokenHash(body.tokenHash);
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
    const result = await context.env.RELAY_DB.prepare(`
      INSERT OR IGNORE INTO relay_rooms (id, token_hash, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(roomId, tokenHash, now, now, expiresAt).run();
    if (!result.meta.changes) return response({ error: 'Ese espacio ya existe.' }, 409);
    return response({ ok: true, roomId, expiresAt }, 201);
  } catch (error) {
    return handleError(error);
  }
}
