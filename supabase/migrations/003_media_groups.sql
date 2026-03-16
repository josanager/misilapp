-- Migration to support media groups
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS media_group_id UUID;

COMMENT ON COLUMN public.messages.media_group_id IS 'UUID shared by messages that belong to the same media group (grid)';
