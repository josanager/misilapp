-- User Presence Table
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline')),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_presence
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_presence_viewable_by_everyone" ON user_presence
  FOR SELECT USING (true);

CREATE POLICY "user_presence_editable_by_owner" ON user_presence
  FOR ALL USING (auth.uid() = user_id);

-- Add updated_at trigger for user_presence
CREATE OR REPLACE FUNCTION update_user_presence_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_presence_last_seen_trigger
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence_last_seen();
