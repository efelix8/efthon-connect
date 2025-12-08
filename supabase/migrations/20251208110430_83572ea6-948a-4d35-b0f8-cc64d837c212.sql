-- Drop the existing view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.users_public;

CREATE VIEW public.users_public 
WITH (security_invoker = true) AS
  SELECT id, nickname, last_seen_at, created_at, profile_id
  FROM public.users;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.users_public TO authenticated;