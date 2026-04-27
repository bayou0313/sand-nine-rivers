-- WAYS_TO_LMT_MIGRATION Step 1: Schema additions (additive only)

-- A. Create payment_failures table FIRST (so FK target exists)
CREATE TABLE public.payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text,
  customer_phone text,
  stripe_payment_intent_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_failures_service_manage
  ON public.payment_failures
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY payment_failures_admin_select
  ON public.payment_failures
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX payment_failures_email_idx
  ON public.payment_failures (lower(customer_email))
  WHERE customer_email IS NOT NULL;

CREATE INDEX payment_failures_phone_idx
  ON public.payment_failures (customer_phone)
  WHERE customer_phone IS NOT NULL;

CREATE INDEX payment_failures_unresolved_idx
  ON public.payment_failures (created_at DESC)
  WHERE resolved_at IS NULL;

-- B. Add 4 new columns to orders (trustlevel_fee skipped — already present)
ALTER TABLE public.orders
  ADD COLUMN stripe_checkout_session_id text,
  ADD COLUMN delivery_zip text,
  ADD COLUMN payment_failure_id uuid,
  ADD COLUMN coupon_code text;

-- C. FK constraint on orders.payment_failure_id → payment_failures.id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_failure_id_fkey
  FOREIGN KEY (payment_failure_id) REFERENCES public.payment_failures(id);