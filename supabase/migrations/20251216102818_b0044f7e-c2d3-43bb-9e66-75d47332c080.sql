-- Create voice_rooms table
CREATE TABLE IF NOT EXISTS public.voice_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Voice rooms are viewable by authenticated users"
ON public.voice_rooms
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create voice rooms"
ON public.voice_rooms
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Create voice_room_participants table to track who's in which room
CREATE TABLE IF NOT EXISTS public.voice_room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_muted boolean NOT NULL DEFAULT false,
  is_deafened boolean NOT NULL DEFAULT false,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(voice_room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.voice_room_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for participants
CREATE POLICY "Participants are viewable by authenticated users"
ON public.voice_room_participants
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can join voice rooms"
ON public.voice_room_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = voice_room_participants.user_id
    AND u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own participation"
ON public.voice_room_participants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = voice_room_participants.user_id
    AND u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can leave voice rooms"
ON public.voice_room_participants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = voice_room_participants.user_id
    AND u.auth_user_id = auth.uid()
  )
);

-- Enable realtime for participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_participants;

-- Insert default voice rooms
INSERT INTO public.voice_rooms (name, slug) VALUES 
  ('Genel Ses', 'genel-ses'),
  ('Oyun', 'oyun'),
  ('Müzik', 'muzik')
ON CONFLICT (slug) DO NOTHING;