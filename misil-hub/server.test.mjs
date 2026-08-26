import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';

const projectRoot = path.resolve(import.meta.dirname, '..');
const key = () => randomBytes(32).toString('base64url');

async function freePort() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function connect(baseURL, identity) {
  const query = new URLSearchParams(identity);
  const socket = new WebSocket(`${baseURL}/v1/connect?${query}`);
  const messages = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve({ socket, messages }));
    socket.once('error', reject);
  });
}

async function waitFor(messages, type) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = messages.find((message) => message.type === type);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No llegó ${type}.`);
}

test('registra identidades, entrega en tiempo real y conserva mensajes offline', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'misil-hub-test-'));
  const port = await freePort();
  const baseURL = `ws://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['misil-hub/server.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, MISIL_HUB_HOST: '127.0.0.1', MISIL_HUB_PORT: String(port), MISIL_HUB_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(dataDir, { recursive: true, force: true });
  });

  await new Promise((resolve, reject) => {
    child.stdout.on('data', resolve);
    child.once('error', reject);
  });

  const aliceIdentity = { deviceId: randomUUID(), key: key(), username: 'alice-test', displayName: 'Alice', platform: 'macos' };
  const bobIdentity = { deviceId: randomUUID(), key: key(), username: 'bob-test', displayName: 'Bob', platform: 'windows' };
  const alice = await connect(baseURL, aliceIdentity);
  const bob = await connect(baseURL, bobIdentity);
  await waitFor(alice.messages, 'ready');
  await waitFor(bob.messages, 'ready');

  const firstId = randomUUID();
  alice.socket.send(JSON.stringify({ type: 'message.send', recipientUsername: 'bob-test', clientMessageId: firstId, content: 'Hola desde macOS', createdAt: new Date().toISOString() }));
  const received = await waitFor(bob.messages, 'message.received');
  assert.equal(received.message.content, 'Hola desde macOS');
  assert.equal(received.message.senderUsername, 'alice-test');
  await waitFor(alice.messages, 'message.ack');

  bob.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 80));
  alice.socket.send(JSON.stringify({ type: 'message.send', recipientUsername: 'bob-test', clientMessageId: randomUUID(), content: 'Mensaje pendiente', createdAt: new Date().toISOString() }));
  await new Promise((resolve) => setTimeout(resolve, 80));

  const bobAgain = await connect(baseURL, bobIdentity);
  const pending = await waitFor(bobAgain.messages, 'messages.pending');
  assert.equal(pending.messages.length, 1);
  assert.equal(pending.messages[0].content, 'Mensaje pendiente');
  alice.socket.close();
  bobAgain.socket.close();
});
