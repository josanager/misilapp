-- =============================================
-- Chat Latino - Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  public_key TEXT,
  status TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_viewable_by_everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_editable_by_owner" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- 2. GROUPS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_public ON groups(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_viewable_by_members" ON groups
  FOR SELECT USING (
    is_public = true OR
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "groups_insertable_by_authenticated" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_updatable_by_admin" ON groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 3. GROUP MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_viewable" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "group_members_insertable_by_admin" ON group_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "group_members_deletable_by_admin" ON group_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- =============================================
-- 4. JOIN REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_group ON join_requests(group_id, status);

ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "join_requests_viewable_by_admin_and_requester" ON join_requests
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = join_requests.group_id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "join_requests_insertable" ON join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "join_requests_updatable_by_admin" ON join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = join_requests.group_id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- =============================================
-- 5. TOPICS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_group ON topics(group_id, position);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics_viewable_by_members" ON topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = topics.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "topics_insertable_by_members" ON topics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = topics.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "topics_updatable_by_admin" ON topics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = topics.group_id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- =============================================
-- 6. MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'file')),
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  replied_to UUID REFERENCES messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Messages viewable by group members (via topic → group membership)
CREATE POLICY "messages_viewable_by_members" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM topics t
      JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = messages.topic_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insertable_by_members" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM topics t
      JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = messages.topic_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_deletable_by_owner_or_admin" ON messages
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM topics t
      JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = messages.topic_id AND gm.user_id = auth.uid() AND gm.role IN ('admin', 'moderator')
    )
  );

-- =============================================
-- 7. USER SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'es'
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_viewable_by_owner" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_editable_by_owner" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 8. ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE join_requests;

-- =============================================
-- DONE! Your Chat Latino database is ready.
-- =============================================
