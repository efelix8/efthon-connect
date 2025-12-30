-- Allow room creators to update their own rooms
CREATE POLICY "Room creators can update their rooms"
ON public.rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = rooms.created_by
    AND u.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = rooms.created_by
    AND u.auth_user_id = auth.uid()
  )
);