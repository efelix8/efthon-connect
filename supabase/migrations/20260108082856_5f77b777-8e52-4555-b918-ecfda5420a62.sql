-- Create music_tracks table for user-uploaded songs
CREATE TABLE public.music_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Bilinmeyen Sanatçı',
  file_url TEXT NOT NULL,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

-- Everyone can view tracks
CREATE POLICY "Anyone can view music tracks"
ON public.music_tracks
FOR SELECT
USING (true);

-- Anyone can insert tracks (since we use anonymous users)
CREATE POLICY "Anyone can upload music tracks"
ON public.music_tracks
FOR INSERT
WITH CHECK (true);

-- Create storage bucket for music files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('music', 'music', true, 52428800, ARRAY['audio/mpeg', 'audio/mp3']);

-- Storage policies
CREATE POLICY "Anyone can view music files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'music');

CREATE POLICY "Anyone can upload music files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'music');

-- Enable realtime for music_tracks
ALTER PUBLICATION supabase_realtime ADD TABLE public.music_tracks;