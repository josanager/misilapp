CREATE TABLE IF NOT EXISTS relay_rooms (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relay_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES relay_rooms(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS relay_messages_room_created_idx
  ON relay_messages(room_id, created_at);

CREATE INDEX IF NOT EXISTS relay_messages_expiry_idx
  ON relay_messages(expires_at);
