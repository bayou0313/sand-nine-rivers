
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_collected boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_collected_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_collected_by text;
