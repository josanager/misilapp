import {
  MESSAGE_TTL_MS,
  authorizeRoom,
  handleError,
  methodNotAllowed,
  parseJson,
  purgeExpired,
  response,
  validateEnvelope,
  validateRoomId,
} from './_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!['GET', 'POST'].includes(context.request.method)) return methodNotAllowed();
  try {
    const url = new URL(context.request.url);
    const body = context.request.method === 'POST' ? await parseJson(context.request) : {};
    const roomId = validateRoomId(body.roomId || url.searchParams.get('roomId'));
    await authorizeRoom(context.request, context.env.RELAY_DB, roomId);
    await purgeExpired(context.env.RELAY_DB, roomId);

    if (context.request.method === 'GET') {
      const { results } = await context.env.RELAY_DB.prepare(`
        SELECT id, ciphertext, iv, created_at AS createdAt
        FROM relay_messages
        WHERE room_id = ? AND expires_at > ?
        ORDER BY created_at ASC
        LIMIT 500
      `).bind(roomId, Date.now()).all();
      return response({ messages: results });
    }

    const id = validateRoomId(body.id);
    const ciphertext = validateEnvelope(body.ciphertext, 'Contenido cifrado', 64 * 1024);
    const iv = validateEnvelope(body.iv, 'Vector de cifrado', 64);
    const createdAt = Date.parse(body.createdAt);
    const now = Date.now();
    if (!Number.isFinite(createdAt) || Math.abs(createdAt - now) > 10 * 60 * 1000) {
      return response({ error: 'La fecha del mensaje no es válida.' }, 400);
    }
    const expiresAt = now + MESSAGE_TTL_MS;
    await context.env.RELAY_DB.prepare(`
      INSERT OR IGNORE INTO relay_messages (id, room_id, ciphertext, iv, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, roomId, ciphertext, iv, body.createdAt, expiresAt).run();
    return response({ ok: true, id, expiresAt }, 201);
  } catch (error) {
    return handleError(error);
  }
}
