-- Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subscription)
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_insertable_by_owner" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_viewable_by_owner" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_deletable_by_owner" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_updatable_by_owner" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
