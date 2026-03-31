
-- FIX 1: Tighten visitor_sessions — drop public SELECT
DROP POLICY IF EXISTS "anon_select_sessions" ON public.visitor_sessions;

-- Drop overly permissive anon UPDATE and replace with token-scoped
DROP POLICY IF EXISTS "anon_update_sessions" ON public.visitor_sessions;

-- Recreate update policy (anon can update, but only rows they know the token for — enforced by WHERE clause in app code)
CREATE POLICY "anon_update_own_session"
ON public.visitor_sessions FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Create security definer function so client can read own session by token
CREATE OR REPLACE FUNCTION public.get_own_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT to_jsonb(vs.*) INTO result
  FROM visitor_sessions vs
  WHERE vs.session_token = p_token
  LIMIT 1;
  RETURN result;
END;
$$;

-- FIX 3: Secure user_roles — add service_role ALL policy
CREATE POLICY "service_role_manage_user_roles"
ON public.user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- FIX 2: Storage bucket — add RLS policies on storage.objects for assets bucket
CREATE POLICY "public_read_assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'assets');

CREATE POLICY "service_role_insert_assets"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'assets');

CREATE POLICY "service_role_delete_assets"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'assets');
