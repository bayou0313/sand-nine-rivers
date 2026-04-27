-- Orders: additive columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_zip text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS trustlevel_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_failure_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;

-- payment_failures table
CREATE TABLE IF NOT EXISTS public.payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text,
  customer_phone text,
  stripe_payment_intent_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_failures'
      AND policyname = 'payment_failures_service_manage'
  ) THEN
    CREATE POLICY payment_failures_service_manage
      ON public.payment_failures
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Partial index on stripe_payment_intent_id
CREATE INDEX IF NOT EXISTS payment_failures_stripe_pi_idx
  ON public.payment_failures (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;