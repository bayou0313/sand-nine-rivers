
-- Orders table: fraud/billing columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_name text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_zip text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_country text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_matches_delivery boolean DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_status text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS call_verified_at timestamptz DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS call_verified_by text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fraud_score integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fraud_signals jsonb DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_attempts integer DEFAULT 0;

-- Delivery leads table: fraud/offer tracking columns
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS user_agent text DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS browser_geolat numeric DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS browser_geolng numeric DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS geo_matches_address boolean DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS fraud_score integer DEFAULT 0;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS fraud_signals jsonb DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS submission_count integer DEFAULT 1;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS pre_order_id uuid DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS offer_sent_at timestamptz DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS declined_at timestamptz DEFAULT NULL;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS calculated_price numeric DEFAULT NULL;

-- Blocked IPs table
CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  reason text,
  blocked_at timestamptz DEFAULT now(),
  blocked_by text
);
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_manage_blocked_ips" ON blocked_ips FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Global settings: business hours
INSERT INTO global_settings (key, value, is_public) VALUES
('business_hours_start', '07:00', true),
('business_hours_end', '17:00', true),
('business_days', 'Monday-Saturday', true),
('response_time_hours', '2', true)
ON CONFLICT (key) DO NOTHING;
