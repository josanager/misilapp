import type { Message, Profile } from '../types';

const STORAGE_KEY = 'misil.web-relay.identity.v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type RelayIdentity = {
  version: 1;
  roomId: string;
  accessToken: string;
  encryptionKey: string;
  deviceId: string;
  displayName: string;
  createdAt: string;
};

type SharedRoomSecret = {
  v: 1;
  r: string;
  t: string;
  k: string;
};

type EncryptedEnvelope = {
  id: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
};

type RelayPayload = {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
  };
};

const apiBase = (import.meta.env.VITE_RELAY_API_URL || '').replace(/\/$/, '');

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomSecret(size = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function relayRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : `El relay respondió con ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

function saveIdentity(identity: RelayIdentity): RelayIdentity {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

function identityProfile(identity: RelayIdentity): Profile {
  return {
    id: identity.deviceId,
    username: identity.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'web',
    display_name: identity.displayName,
    avatar_url: null,
    public_key: null,
    status: 'MISIL Web',
    can_create_groups: false,
    created_at: identity.createdAt,
  };
}

async function importRoomKey(identity: RelayIdentity): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(identity.encryptionKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function loadRelayIdentity(): RelayIdentity | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as RelayIdentity | null;
    if (!parsed || parsed.version !== 1 || !parsed.roomId || !parsed.accessToken || !parsed.encryptionKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRelayIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function relayProfile(identity: RelayIdentity): Profile {
  return identityProfile(identity);
}

export function exportRoomCode(identity: RelayIdentity): string {
  const secret: SharedRoomSecret = {
    v: 1,
    r: identity.roomId,
    t: identity.accessToken,
    k: identity.encryptionKey,
  };
  return bytesToBase64Url(encoder.encode(JSON.stringify(secret)));
}

export async function createRelayRoom(displayName: string): Promise<RelayIdentity> {
  const identity: RelayIdentity = {
    version: 1,
    roomId: crypto.randomUUID(),
    accessToken: randomSecret(),
    encryptionKey: randomSecret(),
    deviceId: crypto.randomUUID(),
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
  };
  await relayRequest('/api/relay/rooms', {
    method: 'POST',
    body: JSON.stringify({
      roomId: identity.roomId,
      tokenHash: await sha256Hex(identity.accessToken),
    }),
  });
  return saveIdentity(identity);
}

export async function joinRelayRoom(code: string, displayName: string): Promise<RelayIdentity> {
  let secret: SharedRoomSecret;
  try {
    secret = JSON.parse(decoder.decode(base64UrlToBytes(code.trim()))) as SharedRoomSecret;
  } catch {
    throw new Error('El código de acceso no es válido.');
  }
  if (secret.v !== 1 || !secret.r || !secret.t || base64UrlToBytes(secret.k).length !== 32) {
    throw new Error('El código de acceso no es compatible con esta versión.');
  }
  const identity: RelayIdentity = {
    version: 1,
    roomId: secret.r,
    accessToken: secret.t,
    encryptionKey: secret.k,
    deviceId: crypto.randomUUID(),
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
  };
  await listRelayMessages(identity);
  return saveIdentity(identity);
}

export async function sendRelayMessage(identity: RelayIdentity, content: string): Promise<Message> {
  const payload: RelayPayload = {
    id: crypto.randomUUID(),
    content: content.trim(),
    createdAt: new Date().toISOString(),
    sender: { id: identity.deviceId, displayName: identity.displayName },
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await importRoomKey(identity),
    encoder.encode(JSON.stringify(payload)),
  ));
  await relayRequest('/api/relay/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${identity.accessToken}` },
    body: JSON.stringify({
      roomId: identity.roomId,
      id: payload.id,
      ciphertext: bytesToBase64Url(ciphertext),
      iv: bytesToBase64Url(iv),
      createdAt: payload.createdAt,
    }),
  });
  return payloadToMessage(payload);
}

function payloadToMessage(payload: RelayPayload): Message {
  return {
    id: payload.id,
    topic_id: 'relay-general',
    user_id: payload.sender.id,
    content: payload.content,
    type: 'text',
    blob_id: null,
    file_url: null,
    file_name: null,
    file_size: null,
    replied_to: null,
    media_group_id: null,
    created_at: payload.createdAt,
    profile: {
      id: payload.sender.id,
      username: 'web',
      display_name: payload.sender.displayName,
      avatar_url: null,
      public_key: null,
      status: 'MISIL Web',
      can_create_groups: false,
      created_at: payload.createdAt,
    },
    status: 'sent',
  };
}

export async function listRelayMessages(identity: RelayIdentity): Promise<Message[]> {
  const response = await relayRequest<{ messages: EncryptedEnvelope[] }>(
    `/api/relay/messages?roomId=${encodeURIComponent(identity.roomId)}`,
    { headers: { Authorization: `Bearer ${identity.accessToken}` } },
  );
  const key = await importRoomKey(identity);
  const messages: Message[] = [];
  for (const envelope of response.messages) {
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64UrlToBytes(envelope.iv) },
        key,
        base64UrlToBytes(envelope.ciphertext),
      );
      const payload = JSON.parse(decoder.decode(plain)) as RelayPayload;
      if (payload.id === envelope.id && payload.content) messages.push(payloadToMessage(payload));
    } catch {
      // A malformed or foreign envelope is ignored without exposing room details.
    }
  }
  return messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
}
