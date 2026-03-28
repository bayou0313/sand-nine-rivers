
-- Drop the overly permissive policy
DROP POLICY "Anon can read own order by token" ON public.orders;

-- Create a security definer function to look up order by id + token
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid, p_token uuid)
RETURNS TABLE(payment_status text, order_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.payment_status, o.order_number
  FROM public.orders o
  WHERE o.id = p_order_id AND o.confirmation_token = p_token
  LIMIT 1;
$$;
