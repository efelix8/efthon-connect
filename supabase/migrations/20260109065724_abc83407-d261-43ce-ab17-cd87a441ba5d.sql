-- Add background_url column to rooms table for channel background images
ALTER TABLE public.rooms ADD COLUMN background_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.rooms.background_url IS 'URL for the channel background image with automatic 90% opacity overlay';