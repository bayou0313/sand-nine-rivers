
-- FIX 1: Drop stale unscoped anon UPDATE policy on visitor_sessions
-- (service_role_updates_sessions already handles this securely)
DROP POLICY IF EXISTS "anon_update_own_session" ON public.visitor_sessions;

-- FIX 2: Drop permissive direct INSERT on orders
-- (create_order RPC handles all order creation with validation)
DROP POLICY IF EXISTS "customers_insert_orders" ON public.orders;
