
-- Create global_settings table
CREATE TABLE public.global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_settings" ON public.global_settings FOR SELECT USING (true);
CREATE POLICY "service_manage_settings" ON public.global_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default global pricing
INSERT INTO public.global_settings (key, value, description) VALUES
  ('default_base_price', '195.00', 'Default base price per 9-yard load'),
  ('default_free_miles', '15', 'Default free delivery radius in miles'),
  ('default_extra_per_mile', '5.00', 'Default extra cost per mile beyond free radius'),
  ('default_max_distance', '30', 'Default maximum delivery distance in miles'),
  ('saturday_surcharge', '35.00', 'Saturday delivery surcharge — global always'),
  ('site_name', 'River Sand', 'Site display name'),
  ('phone', '1-855-GOT-WAYS', 'Contact phone number');

-- Create pits table
CREATE TABLE public.pits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text DEFAULT '',
  base_price numeric,
  free_miles numeric,
  price_per_extra_mile numeric,
  max_distance numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_pits" ON public.pits FOR SELECT USING (true);
CREATE POLICY "service_manage_pits" ON public.pits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default HQ PIT
INSERT INTO public.pits (name, address, lat, lon, status, is_default, notes) VALUES
  ('New Orleans HQ', 'Bridge City, LA', 29.9308, -90.1685, 'active', true, '');

-- Trigger for updated_at on pits
CREATE TRIGGER update_pits_updated_at
BEFORE UPDATE ON public.pits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on global_settings
CREATE OR REPLACE FUNCTION public.update_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_global_settings_updated_at
BEFORE UPDATE ON public.global_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_settings_updated_at();
