-- Add image_url column to messages table for photo attachments
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add created_by column to rooms table to track who created the room
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat images
CREATE POLICY "Chat images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own chat images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Update RLS policy for rooms to allow authenticated users to insert new rooms
CREATE POLICY "Authenticated users can create rooms"
ON public.rooms FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  (SELECT COUNT(*) FROM public.rooms) < 10
);