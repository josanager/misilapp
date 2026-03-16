-- PHASE 1: SECURITY & GROUP CREATION
-- 1. Add can_create_groups to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_create_groups BOOLEAN DEFAULT false;

-- 2. Update RLS policy for group creation
-- Drop the old policy
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;

-- Create the new strict policy
CREATE POLICY "Only authorized users can create groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.can_create_groups = true
  )
);

-- PHASE 3: EMOJI REACTIONS
-- 1. Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- 2. Enable RLS on message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for message_reactions
-- View reactions: Users can view reactions in their groups
CREATE POLICY "Users can view reactions in their groups"
ON public.message_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.topics t ON m.topic_id = t.id
    JOIN public.groups g ON t.group_id = g.id
    WHERE m.id = message_reactions.message_id
    AND is_group_member(g.id, auth.uid())
  )
);

-- Add reactions: Only group members can add reactions
CREATE POLICY "Users can add reactions in their groups"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.topics t ON m.topic_id = t.id
    JOIN public.groups g ON t.group_id = g.id
    WHERE m.id = message_id
    AND is_group_member(g.id, auth.uid())
  )
);

-- Delete reactions: Users can only delete their own reactions
CREATE POLICY "Users can delete their own reactions"
ON public.message_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Enable realtime for message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
