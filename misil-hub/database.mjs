import path from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { HUB_DATA_DIR } from './config.mjs';

mkdirSync(HUB_DATA_DIR, { recursive: true, mode: 0o700 });
export const db = new Database(path.join(HUB_DATA_DIR, 'hub.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    client_message_id TEXT NOT NULL,
    sender_device_id TEXT NOT NULL REFERENCES devices(id),
    sender_username TEXT NOT NULL,
    sender_display_name TEXT NOT NULL,
    recipient_username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    delivered_at TEXT,
    UNIQUE(sender_device_id, client_message_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS messages_recipient_delivery_idx
    ON messages(recipient_username, delivered_at, created_at);
`);
