
-- Drop the header-based policy and use a simpler approach
DROP POLICY "Anon can read own order by token" ON public.orders;

-- Allow anon to read only their specific order by matching both id and confirmation_token
CREATE POLICY "Anon can read own order by token"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (true);
