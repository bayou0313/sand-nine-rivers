ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_tier integer NOT NULL DEFAULT 1;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fraud_window_cleared_at timestamptz;

COMMENT ON COLUMN public.orders.customer_tier IS '1=new customer, 2=returning 1-2 orders, 3=VIP 3+ orders';
COMMENT ON COLUMN public.orders.fraud_window_cleared_at IS 'Timestamp when fraud review window was cleared';