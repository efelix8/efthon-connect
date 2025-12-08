-- Fix users_public view: Make it SECURITY DEFINER so authenticated users can see other users' public info
DROP VIEW IF EXISTS public.users_public;

CREATE VIEW public.users_public 
WITH (security_invoker = false)
AS
SELECT 
  id,
  nickname,
  profile_id,
  created_at,
  last_seen_at
FROM public.users;

-- Grant access to authenticated users
GRANT SELECT ON public.users_public TO authenticated;

-- Add a comment explaining the view's purpose
COMMENT ON VIEW public.users_public IS 'Public view of users table excluding sensitive fields (ip_hash, auth_user_id). Safe for authenticated users to query.';