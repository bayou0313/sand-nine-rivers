ALTER TABLE public.city_pages
  ADD COLUMN IF NOT EXISTS last_regen_reason text,
  ADD COLUMN IF NOT EXISTS last_regen_at timestamptz;