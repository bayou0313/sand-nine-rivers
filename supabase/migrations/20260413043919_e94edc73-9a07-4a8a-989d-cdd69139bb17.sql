CREATE TABLE IF NOT EXISTS public.zip_tax_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code text NOT NULL UNIQUE,
  tax_region_name text NOT NULL,
  state_rate decimal(6,4) NOT NULL DEFAULT 0.05,
  local_rate decimal(6,4) NOT NULL DEFAULT 0,
  combined_rate decimal(6,4) NOT NULL,
  state_code text NOT NULL DEFAULT 'LA',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.zip_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_zip_tax_rates" ON public.zip_tax_rates
  FOR SELECT TO public USING (true);

CREATE POLICY "service_manage_zip_tax_rates" ON public.zip_tax_rates
  FOR ALL TO service_role USING (true) WITH CHECK (true);