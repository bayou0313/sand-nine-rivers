
-- FIX 1: Scope visitor_sessions UPDATE to service_role only
DROP POLICY IF EXISTS "anon_update_own_session" ON public.visitor_sessions;
DROP POLICY IF EXISTS "visitors_can_update_own_session" ON public.visitor_sessions;

CREATE POLICY "service_role_updates_sessions"
ON public.visitor_sessions FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- FIX 2: Tighten pits table — only expose active pits publicly, writes via service_role
DROP POLICY IF EXISTS "public_read_pits" ON public.pits;

CREATE POLICY "public_read_active_pits"
ON public.pits FOR SELECT
TO anon, authenticated
USING (status = 'active');

CREATE POLICY "service_role_manages_pits"
ON public.pits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
