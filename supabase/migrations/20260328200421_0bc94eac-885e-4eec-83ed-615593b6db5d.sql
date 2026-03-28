
-- ============================================================
-- 1. ORDERS TABLE — Drop all existing policies and recreate
-- ============================================================
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can read back recent orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can read own order by token" ON public.orders;

-- Admins can read all orders
CREATE POLICY "admins_read_all_orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can insert orders (anon checkout flow)
CREATE POLICY "customers_insert_orders"
ON public.orders FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can update orders
CREATE POLICY "admins_update_orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete orders
CREATE POLICY "admins_delete_orders"
ON public.orders FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. PAYMENT_EVENTS TABLE — Drop permissive policies, keep admin + service_role
-- ============================================================
DROP POLICY IF EXISTS "Admins can view payment events" ON public.payment_events;
DROP POLICY IF EXISTS "Edge functions can insert payment events" ON public.payment_events;
DROP POLICY IF EXISTS "Service role can insert payment events" ON public.payment_events;

-- Admins read
CREATE POLICY "admins_read_payment_events"
ON public.payment_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Service role insert (webhook uses service_role key)
CREATE POLICY "service_role_insert_payment_events"
ON public.payment_events FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================
-- 3. USER_ROLES TABLE — Keep admin read, ensure no other access
-- ============================================================
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

CREATE POLICY "admins_read_user_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4. Add lookup_token columns for one-time order status checks
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lookup_token uuid UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lookup_token_used boolean NOT NULL DEFAULT false;

-- ============================================================
-- 5. Drop old get_order_status RPC (replaced by edge function)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_order_status(uuid, uuid);
