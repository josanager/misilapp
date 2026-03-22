-- =============================================
-- 007: Media Ratings & View Count
-- Adds rating system for multimedia content
-- and view tracking for media messages
-- =============================================

-- 1. Media Ratings Table
CREATE TABLE IF NOT EXISTS public.media_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_ratings_message ON public.media_ratings(message_id);
CREATE INDEX IF NOT EXISTS idx_media_ratings_user ON public.media_ratings(user_id);

-- 2. View count column on messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Index for sorting by views (only media)
CREATE INDEX IF NOT EXISTS idx_messages_view_count ON public.messages(view_count DESC)
  WHERE type IN ('image', 'video');

-- 3. RLS Policies for media_ratings
ALTER TABLE public.media_ratings ENABLE ROW LEVEL SECURITY;

-- View: group members can see ratings
CREATE POLICY "media_ratings_viewable_by_group_members" ON public.media_ratings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.topics t ON m.topic_id = t.id
      JOIN public.group_members gm ON gm.group_id = t.group_id
      WHERE m.id = media_ratings.message_id AND gm.user_id = auth.uid()
    )
  );

-- Insert: group members can rate
CREATE POLICY "media_ratings_insertable_by_group_members" ON public.media_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.topics t ON m.topic_id = t.id
      JOIN public.group_members gm ON gm.group_id = t.group_id
      WHERE m.id = message_id AND gm.user_id = auth.uid()
    )
  );

-- Update: users can update their own rating
CREATE POLICY "media_ratings_updatable_by_owner" ON public.media_ratings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Delete: users can delete their own rating
CREATE POLICY "media_ratings_deletable_by_owner" ON public.media_ratings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Enable realtime for media_ratings
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_ratings;
