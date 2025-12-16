-- Add delivered_at column to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- Create message_reads table to track who has read which message
CREATE TABLE IF NOT EXISTS public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS on message_reads
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view read receipts for messages in their rooms
CREATE POLICY "Users can view read receipts"
ON public.message_reads
FOR SELECT
TO authenticated
USING (true);

-- Allow users to mark messages as read
CREATE POLICY "Users can mark messages as read"
ON public.message_reads
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = message_reads.user_id
    AND u.auth_user_id = auth.uid()
  )
);

-- Enable realtime for message_reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;