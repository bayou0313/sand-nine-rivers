CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code text NOT NULL,
  state_name text NOT NULL,
  county_parish text NOT NULL,
  jurisdiction_type text NOT NULL DEFAULT 'parish',
  state_rate decimal(6,4) NOT NULL,
  local_rate decimal(6,4) NOT NULL,
  combined_rate decimal(6,4) NOT NULL,
  effective_date date NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(state_code, county_parish)
);

INSERT INTO public.tax_rates (state_code, state_name, county_parish, jurisdiction_type, state_rate, local_rate, combined_rate, effective_date) VALUES
('LA', 'Louisiana', 'Orleans Parish', 'parish', 0.05, 0.05, 0.10, '2025-01-01'),
('LA', 'Louisiana', 'Jefferson Parish', 'parish', 0.05, 0.0475, 0.0975, '2025-01-01'),
('LA', 'Louisiana', 'St. Bernard Parish', 'parish', 0.05, 0.05, 0.10, '2025-01-01'),
('LA', 'Louisiana', 'St. Charles Parish', 'parish', 0.05, 0.0555, 0.1055, '2025-01-01'),
('LA', 'Louisiana', 'Plaquemines Parish', 'parish', 0.05, 0.05, 0.10, '2025-01-01')
ON CONFLICT (state_code, county_parish) DO NOTHING;