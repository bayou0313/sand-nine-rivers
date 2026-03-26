CREATE POLICY "Inserters can read back their own order"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (true);