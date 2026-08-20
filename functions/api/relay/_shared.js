const ROOM_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/i;
const ENVELOPE_PATTERN = /^[A-Za-z0-9_-]+$/;

export const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function response(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
      ...headers,
    },
  });
}

export function methodNotAllowed() {
  return response({ error: 'Método no permitido.' }, 405, { Allow: 'GET, POST, OPTIONS' });
}

export async function parseJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 96 * 1024) throw new RelayError('Solicitud demasiado grande.', 413);
  try {
    return await request.json();
  } catch {
    throw new RelayError('JSON no válido.', 400);
  }
}

export function validateRoomId(roomId) {
  if (!ROOM_ID_PATTERN.test(String(roomId || ''))) throw new RelayError('Identificador de espacio no válido.', 400);
  return String(roomId);
}

export function validateTokenHash(tokenHash) {
  if (!TOKEN_HASH_PATTERN.test(String(tokenHash || ''))) throw new RelayError('Credencial no válida.', 400);
  return String(tokenHash).toLowerCase();
}

export function validateEnvelope(value, name, maxLength) {
  const text = String(value || '');
  if (!text || text.length > maxLength || !ENVELOPE_PATTERN.test(text)) {
    throw new RelayError(`${name} no válido.`, 400);
  }
  return text;
}

export async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function authorizeRoom(request, db, roomId) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header);
  if (!match) throw new RelayError('Falta la credencial del espacio.', 401);
  const room = await db.prepare('SELECT token_hash, expires_at FROM relay_rooms WHERE id = ?').bind(roomId).first();
  if (!room || room.expires_at <= Date.now()) throw new RelayError('Este espacio ya no existe.', 404);
  if (await sha256Hex(match[1]) !== room.token_hash) throw new RelayError('Credencial incorrecta.', 403);
  await db.prepare('UPDATE relay_rooms SET last_seen_at = ? WHERE id = ?').bind(Date.now(), roomId).run();
}

export async function purgeExpired(db, roomId) {
  await db.prepare('DELETE FROM relay_messages WHERE room_id = ? AND expires_at <= ?').bind(roomId, Date.now()).run();
}

export class RelayError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export function handleError(error) {
  if (error instanceof RelayError) return response({ error: error.message }, error.status);
  console.error('MISIL relay error', error);
  return response({ error: 'El relay temporal no está disponible.' }, 500);
}
