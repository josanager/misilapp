import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { DATA_DIR } from './config.mjs';

mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const db = new Database(path.join(DATA_DIR, 'misil.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    public_key TEXT,
    status TEXT NOT NULL DEFAULT '',
    can_create_groups INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    created_by TEXT NOT NULL REFERENCES profiles(id),
    is_public INTEGER NOT NULL DEFAULT 0,
    allow_links INTEGER NOT NULL DEFAULT 1,
    allow_media INTEGER NOT NULL DEFAULT 1,
    allow_messages INTEGER NOT NULL DEFAULT 1,
    max_members INTEGER,
    show_members INTEGER NOT NULL DEFAULT 1,
    show_media INTEGER NOT NULL DEFAULT 1,
    show_links INTEGER NOT NULL DEFAULT 1,
    show_files INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('admin', 'moderator', 'member')),
    joined_at TEXT NOT NULL,
    PRIMARY KEY(group_id, user_id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL REFERENCES profiles(id),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS blobs (
    id TEXT PRIMARY KEY,
    sha256 TEXT UNIQUE NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    plain_size INTEGER NOT NULL,
    stored_size INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS blob_chunks (
    blob_id TEXT NOT NULL REFERENCES blobs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    plain_size INTEGER NOT NULL,
    stored_size INTEGER NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    PRIMARY KEY(blob_id, chunk_index)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('text', 'image', 'video', 'file')),
    blob_id TEXT REFERENCES blobs(id),
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    replied_to TEXT REFERENCES messages(id) ON DELETE SET NULL,
    media_group_id TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    is_edited INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS messages_topic_created_idx ON messages(topic_id, created_at);

  CREATE TABLE IF NOT EXISTS message_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id),
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(message_id, user_id, emoji)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS media_ratings (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    created_at TEXT NOT NULL,
    UNIQUE(message_id, user_id)
  ) STRICT;

`);

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export function seedLocalWorkspace() {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO profiles
      (id, username, display_name, status, can_create_groups, created_at)
    VALUES (?, 'local', 'Mi espacio', 'Nodo local', 1, ?)
  `).run(LOCAL_USER_ID, now);

  const existing = db.prepare('SELECT id FROM groups ORDER BY created_at LIMIT 1').get();
  if (existing) return;

  const groupId = randomUUID();
  const topicId = randomUUID();
  const createWorkspace = db.transaction(() => {
    db.prepare(`
      INSERT INTO groups (id, name, description, created_by, is_public, created_at)
      VALUES (?, 'Mi espacio local', 'Datos guardados solamente en este equipo', ?, 0, ?)
    `).run(groupId, LOCAL_USER_ID, now);
    db.prepare(`
      INSERT INTO group_members (group_id, user_id, role, joined_at)
      VALUES (?, ?, 'admin', ?)
    `).run(groupId, LOCAL_USER_ID, now);
    db.prepare(`
      INSERT INTO topics (id, group_id, name, description, created_by, position, created_at)
      VALUES (?, ?, 'General', 'Tema local principal', ?, 0, ?)
    `).run(topicId, groupId, LOCAL_USER_ID, now);
  });
  createWorkspace();
}

export function booleanize(row, fields) {
  if (!row) return row;
  const output = { ...row };
  for (const field of fields) output[field] = Boolean(output[field]);
  return output;
}

export { db };
