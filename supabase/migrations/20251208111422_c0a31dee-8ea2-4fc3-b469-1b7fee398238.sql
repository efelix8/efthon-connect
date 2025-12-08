-- Fix: Prevent users from un-deleting messages by restricting updates to non-deleted messages only

-- Drop the existing update policy
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- Create new policy that only allows updates on non-deleted messages
CREATE POLICY "Users can update their own undeleted messages" ON public.messages
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = messages.user_id AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = messages.user_id AND u.auth_user_id = auth.uid()
    )
  );