-- 1. Add DELETE policy for groups (Only authorized admins)
DROP POLICY IF EXISTS "Only authorized users can delete groups" ON public.groups;

CREATE POLICY "Only authorized users can delete groups"
ON public.groups FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.can_create_groups = true
  )
);

-- Note: In Supabase, if we created tables with REFERENCES groups(id) ON DELETE CASCADE, 
-- deleting the group will automatically delete its topics and members.
-- Let's ensure topics and group_members have CASCADE (they usually do if we used standard references, but we alter to be safe)

ALTER TABLE public.topics
DROP CONSTRAINT IF EXISTS topics_group_id_fkey,
ADD CONSTRAINT topics_group_id_fkey
FOREIGN KEY (group_id)
REFERENCES public.groups(id)
ON DELETE CASCADE;

ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_group_id_fkey,
ADD CONSTRAINT group_members_group_id_fkey
FOREIGN KEY (group_id)
REFERENCES public.groups(id)
ON DELETE CASCADE;

ALTER TABLE public.join_requests
DROP CONSTRAINT IF EXISTS join_requests_group_id_fkey,
ADD CONSTRAINT join_requests_group_id_fkey
FOREIGN KEY (group_id)
REFERENCES public.groups(id)
ON DELETE CASCADE;
