-- Blocklist table
CREATE TABLE IF NOT EXISTS public.fraud_blocklist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  value text NOT NULL,
  reason text,
  blocked_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(type, value)
);

ALTER TABLE public.fraud_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_fraud_blocklist" ON public.fraud_blocklist
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fraud events log
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid,
  order_id uuid,
  ip_address text,
  phone text,
  email text,
  event_type text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_fraud_events" ON public.fraud_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Payment attempt tracking
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text,
  session_id uuid,
  email text,
  phone text,
  amount numeric,
  status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_payment_attempts" ON public.payment_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_blocklist_type_value ON public.fraud_blocklist(type, value);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ip ON public.payment_attempts(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_events_ip ON public.fraud_events(ip_address, created_at);