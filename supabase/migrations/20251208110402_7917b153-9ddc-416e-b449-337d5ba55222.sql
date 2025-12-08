-- Create a view that exposes only safe user columns (excludes ip_hash and auth_user_id)
CREATE VIEW public.users_public AS
  SELECT id, nickname, last_seen_at, created_at, profile_id
  FROM public.users;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.users_public TO authenticated;

-- Update the users table RLS policy to restrict direct table access to owner only
DROP POLICY "Users are viewable by authenticated users" ON public.users;

CREATE POLICY "Users can only view their own row" ON public.users
  FOR SELECT USING (auth_user_id = auth.uid());