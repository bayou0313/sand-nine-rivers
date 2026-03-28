
-- Add confirmation token column
ALTER TABLE public.orders ADD COLUMN confirmation_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Drop the overly permissive anon read policy
DROP POLICY "Anon can read back recent orders" ON public.orders;

-- Create a new policy that requires the confirmation token
CREATE POLICY "Anon can read own order by token"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (confirmation_token = (current_setting('request.headers', true)::json->>'x-confirmation-token')::uuid);
