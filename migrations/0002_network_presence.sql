CREATE TABLE IF NOT EXISTS network_nodes (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('windows', 'macos')),
  app_version TEXT NOT NULL,
  quota_bytes INTEGER NOT NULL DEFAULT 0 CHECK(quota_bytes >= 0),
  used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(used_bytes >= 0),
  storage_healthy INTEGER NOT NULL DEFAULT 0 CHECK(storage_healthy IN (0, 1)),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS network_nodes_presence_idx
  ON network_nodes(last_seen_at, storage_healthy);

CREATE INDEX IF NOT EXISTS network_nodes_platform_idx
  ON network_nodes(platform, last_seen_at);
