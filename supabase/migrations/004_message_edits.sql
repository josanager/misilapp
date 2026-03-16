-- Migration to support editing and deleting messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.messages.is_edited IS 'Flag to indicate if the message content has been modified';

-- Owner constraint for updates
CREATE POLICY "messages_updatable_by_owner" ON public.messages
  FOR UPDATE USING (
    auth.uid() = user_id
  );
