-- =====================================================================
-- COMBINED MIGRATION: Holidays system + Holiday notification system
-- =====================================================================

-- 1. PITS TABLE: holiday surcharge + holiday load limit
ALTER TABLE public.pits
  ADD COLUMN IF NOT EXISTS holiday_surcharge_override numeric,
  ADD COLUMN IF NOT EXISTS holiday_load_limit integer;

COMMENT ON COLUMN public.pits.holiday_surcharge_override IS 'Per-PIT flat $ surcharge for holiday delivery. Null = $0 (no global fallback).';
COMMENT ON COLUMN public.pits.holiday_load_limit IS 'Max loads this PIT can deliver on a holiday. Null = no limit.';

-- 2. HOLIDAYS TABLE
CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  surcharge_override numeric,
  is_closed boolean NOT NULL DEFAULT false,
  is_federal boolean NOT NULL DEFAULT false,
  -- Notification & operator decision
  confirmation_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  notification_10day_sent boolean NOT NULL DEFAULT false,
  notification_10day_sent_at timestamptz,
  notification_7day_sent boolean NOT NULL DEFAULT false,
  notification_7day_sent_at timestamptz,
  operator_decision_at timestamptz,
  operator_decision_by text,
  customer_visible boolean NOT NULL DEFAULT false,  -- flips true only via email-confirm endpoint
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_token ON public.holidays(confirmation_token);

-- 3. RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Public banner reads only customer_visible holidays
DROP POLICY IF EXISTS public_read_visible_holidays ON public.holidays;
CREATE POLICY public_read_visible_holidays
  ON public.holidays
  FOR SELECT
  USING (customer_visible = true);

-- Service role full access
DROP POLICY IF EXISTS service_manage_holidays ON public.holidays;
CREATE POLICY service_manage_holidays
  ON public.holidays
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_holidays_updated_at ON public.holidays;
CREATE TRIGGER trg_holidays_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SEED: federal pre-confirmed Open (admin-visible, customer-hidden); non-federal unconfirmed
INSERT INTO public.holidays (holiday_date, name, is_federal, is_closed, operator_decision_at, operator_decision_by) VALUES
  -- 2025 Federal (pre-confirmed Open)
  ('2025-01-01', 'New Year''s Day',              true,  false, now(), 'system_seed'),
  ('2025-01-20', 'Martin Luther King Jr. Day',   true,  false, now(), 'system_seed'),
  ('2025-02-17', 'Presidents'' Day',             true,  false, now(), 'system_seed'),
  ('2025-05-26', 'Memorial Day',                 true,  false, now(), 'system_seed'),
  ('2025-06-19', 'Juneteenth',                   true,  false, now(), 'system_seed'),
  ('2025-07-04', 'Independence Day',             true,  false, now(), 'system_seed'),
  ('2025-09-01', 'Labor Day',                    true,  false, now(), 'system_seed'),
  ('2025-11-11', 'Veterans Day',                 true,  false, now(), 'system_seed'),
  ('2025-11-27', 'Thanksgiving Day',             true,  false, now(), 'system_seed'),
  ('2025-12-25', 'Christmas Day',                true,  false, now(), 'system_seed'),
  -- 2025 Non-federal (unconfirmed)
  ('2025-03-04', 'Mardi Gras',                   false, false, NULL,  NULL),
  ('2025-04-18', 'Good Friday',                  false, false, NULL,  NULL),
  ('2025-12-24', 'Christmas Eve',                false, false, NULL,  NULL),
  ('2025-12-31', 'New Year''s Eve',              false, false, NULL,  NULL),
  -- 2026 Federal
  ('2026-01-01', 'New Year''s Day',              true,  false, now(), 'system_seed'),
  ('2026-01-19', 'Martin Luther King Jr. Day',   true,  false, now(), 'system_seed'),
  ('2026-02-16', 'Presidents'' Day',             true,  false, now(), 'system_seed'),
  ('2026-05-25', 'Memorial Day',                 true,  false, now(), 'system_seed'),
  ('2026-06-19', 'Juneteenth',                   true,  false, now(), 'system_seed'),
  ('2026-07-04', 'Independence Day',             true,  false, now(), 'system_seed'),
  ('2026-09-07', 'Labor Day',                    true,  false, now(), 'system_seed'),
  ('2026-11-11', 'Veterans Day',                 true,  false, now(), 'system_seed'),
  ('2026-11-26', 'Thanksgiving Day',             true,  false, now(), 'system_seed'),
  ('2026-12-25', 'Christmas Day',                true,  false, now(), 'system_seed'),
  -- 2026 Non-federal
  ('2026-02-17', 'Mardi Gras',                   false, false, NULL,  NULL),
  ('2026-04-03', 'Good Friday',                  false, false, NULL,  NULL),
  ('2026-12-24', 'Christmas Eve',                false, false, NULL,  NULL),
  ('2026-12-31', 'New Year''s Eve',              false, false, NULL,  NULL),
  -- 2027 Federal
  ('2027-01-01', 'New Year''s Day',              true,  false, now(), 'system_seed'),
  ('2027-01-18', 'Martin Luther King Jr. Day',   true,  false, now(), 'system_seed'),
  ('2027-02-15', 'Presidents'' Day',             true,  false, now(), 'system_seed'),
  ('2027-05-31', 'Memorial Day',                 true,  false, now(), 'system_seed'),
  ('2027-06-19', 'Juneteenth',                   true,  false, now(), 'system_seed'),
  ('2027-07-04', 'Independence Day',             true,  false, now(), 'system_seed'),
  ('2027-09-06', 'Labor Day',                    true,  false, now(), 'system_seed'),
  ('2027-11-11', 'Veterans Day',                 true,  false, now(), 'system_seed'),
  ('2027-11-25', 'Thanksgiving Day',             true,  false, now(), 'system_seed'),
  ('2027-12-25', 'Christmas Day',                true,  false, now(), 'system_seed'),
  -- 2027 Non-federal
  ('2027-02-09', 'Mardi Gras',                   false, false, NULL,  NULL),
  ('2027-03-26', 'Good Friday',                  false, false, NULL,  NULL),
  ('2027-12-24', 'Christmas Eve',                false, false, NULL,  NULL),
  ('2027-12-31', 'New Year''s Eve',              false, false, NULL,  NULL)
ON CONFLICT (holiday_date) DO NOTHING;

-- 5. GLOBAL_SETTINGS: only the recipient list, no surcharge fallbacks
INSERT INTO public.global_settings (key, value, description, is_public) VALUES
  ('notification_recipients', 'cmo@haulogix.com', 'Comma-separated list of email recipients for operational alerts (holidays, etc.)', false)
ON CONFLICT (key) DO NOTHING;