import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { HUB_HOST, HUB_PORT, MAX_MESSAGE_BYTES } from './config.mjs';
import { db } from './database.mjs';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const DEVICE_PATTERN = /^[0-9a-f-]{36}$/i;
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const PLATFORM_PATTERN = /^(windows|macos)$/;
const socketsByUsername = new Map();

function json(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function normalizedUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw new Error('Nombre de usuario no válido.');
  return username;
}

function validDeviceId(value) {
  const id = String(value || '').toLowerCase();
  if (!DEVICE_PATTERN.test(id)) throw new Error('Identificador de equipo no válido.');
  return id;
}

function validKey(value) {
  const key = String(value || '');
  if (!KEY_PATTERN.test(key)) throw new Error('Llave de equipo no válida.');
  return key;
}

function authenticate(url) {
  const deviceId = validDeviceId(url.searchParams.get('deviceId'));
  const deviceKey = validKey(url.searchParams.get('key'));
  const username = normalizedUsername(url.searchParams.get('username'));
  const displayName = String(url.searchParams.get('displayName') || username).trim().slice(0, 64) || username;
  const platform = String(url.searchParams.get('platform') || '').toLowerCase();
  if (!PLATFORM_PATTERN.test(platform)) throw new Error('Plataforma no válida.');

  const keyHash = createHash('sha256').update(deviceKey).digest('hex');
  const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
  const usernameOwner = db.prepare('SELECT id FROM devices WHERE username = ?').get(username);
  if (usernameOwner && usernameOwner.id !== deviceId) throw new Error('Ese nombre de usuario ya está ocupado.');
  if (existing) {
    const expected = Buffer.from(existing.key_hash, 'hex');
    const received = Buffer.from(keyHash, 'hex');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new Error('La llave de este equipo no coincide.');
    }
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO devices (id, username, display_name, key_hash, platform, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      display_name = excluded.display_name,
      platform = excluded.platform,
      last_seen_at = excluded.last_seen_at
  `).run(deviceId, username, displayName, keyHash, platform, now, now);
  return { deviceId, username, displayName, platform };
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function addSocket(identity, socket) {
  const sockets = socketsByUsername.get(identity.username) || new Set();
  sockets.add(socket);
  socketsByUsername.set(identity.username, sockets);
}

function removeSocket(identity, socket) {
  const sockets = socketsByUsername.get(identity.username);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) socketsByUsername.delete(identity.username);
}

function deliverPending(identity, socket) {
  const pending = db.prepare(`
    SELECT id, sender_username AS senderUsername, sender_display_name AS senderDisplayName,
           recipient_username AS recipientUsername, content, created_at AS createdAt
    FROM messages
    WHERE recipient_username = ? AND delivered_at IS NULL
    ORDER BY created_at ASC LIMIT 500
  `).all(identity.username);
  if (pending.length === 0) return;
  send(socket, { type: 'messages.pending', messages: pending });
  const deliveredAt = new Date().toISOString();
  const markDelivered = db.prepare('UPDATE messages SET delivered_at = ? WHERE id = ?');
  db.transaction((rows) => rows.forEach((row) => markDelivered.run(deliveredAt, row.id)))(pending);
}

function handleMessage(identity, socket, raw) {
  if (raw.length > MAX_MESSAGE_BYTES) throw new Error('Mensaje demasiado grande.');
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch { throw new Error('Mensaje JSON no válido.'); }
  if (payload.type === 'ping') {
    send(socket, { type: 'pong', at: new Date().toISOString() });
    return;
  }
  if (payload.type !== 'message.send') throw new Error('Operación no reconocida.');

  const recipientUsername = normalizedUsername(payload.recipientUsername);
  const recipient = db.prepare('SELECT username FROM devices WHERE username = ?').get(recipientUsername);
  if (!recipient) throw new Error('Ese contacto todavía no está registrado en MISIL.');
  const clientMessageId = validDeviceId(payload.clientMessageId);
  const content = String(payload.content || '').trim();
  if (!content || content.length > 4000) throw new Error('El mensaje debe contener entre 1 y 4000 caracteres.');
  const createdAtValue = Date.parse(payload.createdAt);
  const createdAt = Number.isFinite(createdAtValue) ? new Date(createdAtValue).toISOString() : new Date().toISOString();
  const id = randomUUID();

  db.prepare(`
    INSERT OR IGNORE INTO messages
      (id, client_message_id, sender_device_id, sender_username, sender_display_name,
       recipient_username, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, clientMessageId, identity.deviceId, identity.username, identity.displayName, recipientUsername, content, createdAt);
  const stored = db.prepare(`
    SELECT id, sender_username AS senderUsername, sender_display_name AS senderDisplayName,
           recipient_username AS recipientUsername, content, created_at AS createdAt
    FROM messages WHERE sender_device_id = ? AND client_message_id = ?
  `).get(identity.deviceId, clientMessageId);

  send(socket, { type: 'message.ack', clientMessageId, message: stored });
  const recipientSockets = socketsByUsername.get(recipientUsername);
  if (recipientSockets?.size) {
    recipientSockets.forEach((recipientSocket) => send(recipientSocket, { type: 'message.received', message: stored }));
    db.prepare('UPDATE messages SET delivered_at = ? WHERE id = ?').run(new Date().toISOString(), stored.id);
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(response, 200, {
      ok: true,
      service: 'misil-hub',
      protocolVersion: 1,
      onlineDevices: [...socketsByUsername.values()].reduce((total, sockets) => total + sockets.size, 0),
    });
  }
  return json(response, 404, { error: 'Ruta no encontrada.' });
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/v1/connect') return socket.destroy();
  try {
    const identity = authenticate(url);
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket, request, identity);
    });
  } catch (error) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
});

webSocketServer.on('connection', (socket, _request, identity) => {
  addSocket(identity, socket);
  send(socket, {
    type: 'ready',
    protocolVersion: 1,
    profile: identity,
    personalLink: `misil://contacto/${identity.username}/${identity.deviceId}`,
  });
  deliverPending(identity, socket);
  socket.on('message', (raw) => {
    try { handleMessage(identity, socket, raw); }
    catch (error) { send(socket, { type: 'error', error: error.message }); }
  });
  socket.on('close', () => removeSocket(identity, socket));
  socket.on('error', () => removeSocket(identity, socket));
});

server.listen(HUB_PORT, HUB_HOST, () => {
  process.stdout.write(`MISIL Hub escuchando en ws://${HUB_HOST}:${HUB_PORT}/v1/connect\n`);
});

function shutdown() {
  for (const sockets of socketsByUsername.values()) sockets.forEach((socket) => socket.close(1001, 'Servidor cerrándose'));
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
