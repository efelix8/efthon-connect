-- Add cover_url column to music_tracks table
ALTER TABLE public.music_tracks ADD COLUMN IF NOT EXISTS cover_url TEXT;