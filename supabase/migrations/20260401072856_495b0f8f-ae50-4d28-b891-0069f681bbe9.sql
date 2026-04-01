
-- Add status_reason column
ALTER TABLE city_pages ADD COLUMN IF NOT EXISTS status_reason text;

-- Create waitlist leads table
CREATE TABLE IF NOT EXISTS waitlist_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  city_slug text NOT NULL,
  city_name text NOT NULL,
  customer_name text,
  customer_email text NOT NULL,
  customer_phone text,
  notified_at timestamptz,
  converted boolean DEFAULT false
);

ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_waitlist"
  ON waitlist_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow public read of waitlist city pages
DROP POLICY IF EXISTS "public_read_active_city_pages" ON city_pages;
CREATE POLICY "public_read_active_and_waitlist_city_pages"
  ON city_pages
  FOR SELECT
  TO public
  USING (status IN ('active', 'waitlist'));
