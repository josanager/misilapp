import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DATA_DIR, MAX_JSON_BYTES, NODE_HOST, NODE_PORT } from './config.mjs';
import { booleanize, db, LOCAL_USER_ID, seedLocalWorkspace } from './database.mjs';
import {
  initializeStorage,
  removeBlobIfUnreferenced,
  storageStatus,
  storeRequest,
  streamBlob,
} from './storage.mjs';

const GROUP_BOOLEANS = [
  'is_public', 'allow_links', 'allow_media', 'allow_messages',
  'show_members', 'show_media', 'show_links', 'show_files',
];
const MESSAGE_BOOLEANS = ['is_edited'];

function json(response, status, data) {
  const body = JSON.stringify(data);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Length, X-File-Name');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw Object.assign(new Error('Solicitud demasiado grande.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON no válido.'), { statusCode: 400 });
  }
}

function route(pattern, pathname) {
  const match = pattern.exec(pathname);
  return match ? match.groups || {} : null;
}

function profile() {
  return booleanize(db.prepare('SELECT * FROM profiles WHERE id = ?').get(LOCAL_USER_ID), ['can_create_groups']);
}

function decorateMessage(row) {
  if (!row) return row;
  return {
    ...booleanize(row, MESSAGE_BOOLEANS),
    profile: {
      id: row.profile_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
  };
}

const MESSAGE_SELECT = `
  SELECT m.*, p.id AS profile_id, p.username, p.display_name, p.avatar_url
  FROM messages m JOIN profiles p ON p.id = m.user_id
`;

async function handle(request, response) {
  applyCors(request, response);
  if (request.method === 'OPTIONS') return response.end();
  const host = String(request.headers.host || '');
  if (!new RegExp(`^(localhost|127\\.0\\.0\\.1):${NODE_PORT}$`).test(host)) {
    return json(response, 403, { error: 'MISIL Node solo acepta solicitudes locales.' });
  }
  const url = new URL(request.url, `http://${request.headers.host || `${NODE_HOST}:${NODE_PORT}`}`);
  const { pathname } = url;

  if (request.method === 'GET' && pathname === '/v1/health') {
    return json(response, 200, { ok: true, version: 1, storage: storageStatus(), profile: profile() });
  }
  if (request.method === 'GET' && pathname === '/v1/profile') return json(response, 200, profile());
  if (request.method === 'PATCH' && pathname === '/v1/profile') {
    const body = await readJson(request);
    db.prepare('UPDATE profiles SET display_name = COALESCE(?, display_name), status = COALESCE(?, status), avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
      .run(body.display_name ?? null, body.status ?? null, body.avatar_url ?? null, LOCAL_USER_ID);
    return json(response, 200, profile());
  }
  if (request.method === 'GET' && pathname === '/v1/storage') return json(response, 200, storageStatus());

  if (request.method === 'POST' && pathname === '/v1/blobs') {
    const fileName = decodeURIComponent(String(request.headers['x-file-name'] || 'archivo'));
    const contentType = String(request.headers['content-type'] || 'application/octet-stream');
    const contentLength = Number(request.headers['content-length']);
    const blob = await storeRequest(request, { fileName, contentType, contentLength });
    return json(response, 201, {
      id: blob.id,
      url: `http://${NODE_HOST}:${NODE_PORT}/v1/blobs/${blob.id}`,
      fileName: blob.original_name,
      contentType: blob.content_type,
      size: blob.plain_size,
      deduplicated: Boolean(blob.deduplicated),
    });
  }
  let params = route(/^\/v1\/blobs\/(?<id>[0-9a-f-]+)$/, pathname);
  if (request.method === 'GET' && params) return streamBlob(params.id, request, response);
  if (request.method === 'DELETE' && params) {
    const removed = await removeBlobIfUnreferenced(params.id);
    return json(response, removed ? 200 : 409, removed ? { ok: true } : { error: 'El archivo todavía está en uso.' });
  }

  if (request.method === 'GET' && pathname === '/v1/groups') {
    const groups = db.prepare(`
      SELECT g.*, COUNT(gm.user_id) AS member_count
      FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id
      GROUP BY g.id ORDER BY g.created_at DESC
    `).all().map((group) => booleanize(group, GROUP_BOOLEANS));
    return json(response, 200, groups);
  }
  if (request.method === 'POST' && pathname === '/v1/groups') {
    const body = await readJson(request);
    if (!String(body.name || '').trim()) throw Object.assign(new Error('El grupo necesita un nombre.'), { statusCode: 400 });
    const now = new Date().toISOString();
    const groupId = randomUUID();
    const topicId = randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO groups (id, name, description, created_by, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(groupId, String(body.name).trim(), String(body.description || ''), LOCAL_USER_ID, body.is_public ? 1 : 0, now);
      db.prepare("INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)")
        .run(groupId, LOCAL_USER_ID, now);
      db.prepare("INSERT INTO topics (id, group_id, name, description, created_by, position, created_at) VALUES (?, ?, 'General', 'Tema general', ?, 0, ?)")
        .run(topicId, groupId, LOCAL_USER_ID, now);
    })();
    const group = db.prepare('SELECT *, 1 AS member_count FROM groups WHERE id = ?').get(groupId);
    return json(response, 201, booleanize(group, GROUP_BOOLEANS));
  }
  params = route(/^\/v1\/groups\/(?<id>[0-9a-f-]+)$/, pathname);
  if (request.method === 'GET' && params) {
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(params.id);
    if (!group) throw Object.assign(new Error('Grupo no encontrado.'), { statusCode: 404 });
    return json(response, 200, booleanize(group, GROUP_BOOLEANS));
  }
  if (request.method === 'PATCH' && params) {
    const body = await readJson(request);
    const allowed = ['name', 'description', 'avatar_url', 'is_public', 'allow_links', 'allow_media', 'allow_messages', 'max_members', 'show_members', 'show_media', 'show_links', 'show_files'];
    const entries = Object.entries(body).filter(([key]) => allowed.includes(key));
    if (entries.length) {
      const set = entries.map(([key]) => `${key} = ?`).join(', ');
      const values = entries.map(([key, value]) => GROUP_BOOLEANS.includes(key) ? (value ? 1 : 0) : value);
      db.prepare(`UPDATE groups SET ${set} WHERE id = ?`).run(...values, params.id);
    }
    return json(response, 200, booleanize(db.prepare('SELECT * FROM groups WHERE id = ?').get(params.id), GROUP_BOOLEANS));
  }
  if (request.method === 'DELETE' && params) {
    const blobIds = db.prepare(`SELECT DISTINCT m.blob_id FROM messages m JOIN topics t ON t.id = m.topic_id WHERE t.group_id = ? AND m.blob_id IS NOT NULL`).all(params.id);
    db.prepare('DELETE FROM groups WHERE id = ?').run(params.id);
    for (const { blob_id: blobId } of blobIds) await removeBlobIfUnreferenced(blobId);
    return json(response, 200, { ok: true });
  }

  params = route(/^\/v1\/groups\/(?<id>[0-9a-f-]+)\/topics$/, pathname);
  if (request.method === 'GET' && params) {
    return json(response, 200, db.prepare('SELECT * FROM topics WHERE group_id = ? ORDER BY position, created_at').all(params.id));
  }
  if (request.method === 'POST' && params) {
    const body = await readJson(request);
    const position = db.prepare('SELECT COUNT(*) AS count FROM topics WHERE group_id = ?').get(params.id).count;
    const topic = { id: randomUUID(), group_id: params.id, name: String(body.name || '').trim(), description: String(body.description || ''), created_by: LOCAL_USER_ID, position, created_at: new Date().toISOString() };
    if (!topic.name) throw Object.assign(new Error('El tema necesita un nombre.'), { statusCode: 400 });
    db.prepare('INSERT INTO topics (id, group_id, name, description, created_by, position, created_at) VALUES (@id, @group_id, @name, @description, @created_by, @position, @created_at)').run(topic);
    return json(response, 201, topic);
  }
  params = route(/^\/v1\/groups\/(?<id>[0-9a-f-]+)\/members$/, pathname);
  if (request.method === 'GET' && params) {
    const members = db.prepare(`SELECT gm.*, p.id AS profile_id, p.username, p.display_name, p.avatar_url, p.status FROM group_members gm JOIN profiles p ON p.id = gm.user_id WHERE gm.group_id = ?`).all(params.id)
      .map((member) => ({ ...member, profile: { id: member.profile_id, username: member.username, display_name: member.display_name, avatar_url: member.avatar_url, status: member.status } }));
    return json(response, 200, members);
  }

  params = route(/^\/v1\/topics\/(?<id>[0-9a-f-]+)\/messages$/, pathname);
  if (request.method === 'GET' && params) {
    const messages = db.prepare(`${MESSAGE_SELECT} WHERE m.topic_id = ? ORDER BY m.created_at LIMIT 500`).all(params.id).map(decorateMessage);
    return json(response, 200, messages);
  }
  if (request.method === 'POST' && pathname === '/v1/messages') {
    const body = await readJson(request);
    const message = {
      id: body.id || randomUUID(), topic_id: body.topic_id, user_id: LOCAL_USER_ID,
      content: String(body.content || ''), type: body.type || 'text', blob_id: body.blob_id || null,
      file_url: body.file_url || null, file_name: body.file_name || null, file_size: body.file_size || null,
      replied_to: body.replied_to || null, media_group_id: body.media_group_id || null,
      created_at: new Date().toISOString(),
    };
    db.prepare(`INSERT INTO messages (id, topic_id, user_id, content, type, blob_id, file_url, file_name, file_size, replied_to, media_group_id, created_at)
      VALUES (@id, @topic_id, @user_id, @content, @type, @blob_id, @file_url, @file_name, @file_size, @replied_to, @media_group_id, @created_at)`).run(message);
    return json(response, 201, decorateMessage(db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(message.id)));
  }
  params = route(/^\/v1\/messages\/(?<id>[0-9a-f-]+)$/, pathname);
  if (request.method === 'PATCH' && params) {
    const body = await readJson(request);
    db.prepare('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?').run(String(body.content || ''), params.id);
    return json(response, 200, decorateMessage(db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(params.id)));
  }
  if (request.method === 'DELETE' && params) {
    const target = db.prepare('SELECT blob_id, media_group_id, user_id FROM messages WHERE id = ?').get(params.id);
    if (!target) return json(response, 200, { ok: true });
    const targets = target.media_group_id
      ? db.prepare('SELECT id, blob_id FROM messages WHERE media_group_id = ? AND user_id = ?').all(target.media_group_id, target.user_id)
      : [{ id: params.id, blob_id: target.blob_id }];
    db.prepare(`DELETE FROM messages WHERE id IN (${targets.map(() => '?').join(',')})`).run(...targets.map((item) => item.id));
    for (const item of targets) await removeBlobIfUnreferenced(item.blob_id);
    return json(response, 200, { ok: true, deleted: targets.map((item) => item.id) });
  }

  if (request.method === 'GET' && pathname === '/v1/reactions') {
    const ids = (url.searchParams.get('messageIds') || '').split(',').filter(Boolean).slice(0, 500);
    if (!ids.length) return json(response, 200, []);
    const reactions = db.prepare(`SELECT * FROM message_reactions WHERE message_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    return json(response, 200, reactions);
  }
  if (request.method === 'POST' && pathname === '/v1/reactions/toggle') {
    const body = await readJson(request);
    const existing = db.prepare('SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(body.message_id, LOCAL_USER_ID, body.emoji);
    if (existing) db.prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
    else db.prepare('INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), body.message_id, LOCAL_USER_ID, body.emoji, new Date().toISOString());
    return json(response, 200, db.prepare('SELECT * FROM message_reactions WHERE message_id = ?').all(body.message_id));
  }

  if (request.method === 'GET' && pathname === '/v1/media') {
    const groupId = url.searchParams.get('groupId');
    const media = db.prepare(`${MESSAGE_SELECT} JOIN topics t ON t.id = m.topic_id WHERE t.group_id = ? AND (m.type != 'text' OR m.content LIKE '%http%') ORDER BY m.created_at DESC`).all(groupId).map(decorateMessage);
    return json(response, 200, media);
  }
  if (request.method === 'GET' && pathname === '/v1/ratings') {
    const ids = (url.searchParams.get('messageIds') || '').split(',').filter(Boolean).slice(0, 500);
    if (!ids.length) return json(response, 200, []);
    return json(response, 200, db.prepare(`SELECT message_id, AVG(rating) AS avg, COUNT(*) AS count, MAX(CASE WHEN user_id = ? THEN rating END) AS user_rating FROM media_ratings WHERE message_id IN (${ids.map(() => '?').join(',')}) GROUP BY message_id`).all(LOCAL_USER_ID, ...ids));
  }
  if (request.method === 'POST' && pathname === '/v1/ratings') {
    const body = await readJson(request);
    db.prepare(`INSERT INTO media_ratings (id, message_id, user_id, rating, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(message_id, user_id) DO UPDATE SET rating = excluded.rating`).run(randomUUID(), body.message_id, LOCAL_USER_ID, body.rating, new Date().toISOString());
    return json(response, 200, { ok: true });
  }
  params = route(/^\/v1\/messages\/(?<id>[0-9a-f-]+)\/view$/, pathname);
  if (request.method === 'POST' && params) {
    db.prepare('UPDATE messages SET view_count = view_count + 1 WHERE id = ?').run(params.id);
    return json(response, 200, { ok: true });
  }

  return json(response, 404, { error: 'Ruta local no encontrada.' });
}

await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
await initializeStorage();
seedLocalWorkspace();

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    if (response.headersSent) return response.destroy(error);
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) console.error(error);
    json(response, status, { error: error?.message || 'Error interno del nodo local.' });
  });
});

server.listen(NODE_PORT, NODE_HOST, () => {
  const { usedBytes, quotaBytes } = storageStatus();
  console.log(`MISIL Node activo en http://${NODE_HOST}:${NODE_PORT}`);
  console.log(`Almacenamiento local: ${usedBytes} / ${quotaBytes} bytes`);
  console.log(`Directorio: ${DATA_DIR}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => {
    db.close();
    process.exit(0);
  }));
}
