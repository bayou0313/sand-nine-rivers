
-- Drop the overly permissive public SELECT policy
DROP POLICY "Inserters can read back their own order" ON public.orders;

-- Replace with a time-limited policy (only orders created in the last 5 minutes)
CREATE POLICY "Anon can read back recent orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '5 minutes');
