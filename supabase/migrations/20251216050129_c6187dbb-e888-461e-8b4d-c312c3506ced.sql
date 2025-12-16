-- Add password column to rooms table for password-protected rooms
ALTER TABLE public.rooms ADD COLUMN password_hash text;

-- Create function to verify room password
CREATE OR REPLACE FUNCTION public.verify_room_password(room_slug text, entered_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.rooms
  WHERE slug = room_slug;
  
  IF stored_hash IS NULL THEN
    RETURN true; -- No password required
  END IF;
  
  RETURN stored_hash = entered_password;
END;
$$;