ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS geo_city text,
  ADD COLUMN IF NOT EXISTS geo_region text,
  ADD COLUMN IF NOT EXISTS geo_country text,
  ADD COLUMN IF NOT EXISTS geo_zip text,
  ADD COLUMN IF NOT EXISTS entry_page text,
  ADD COLUMN IF NOT EXISTS entry_city_page text,
  ADD COLUMN IF NOT EXISTS entry_city_name text,
  ADD COLUMN IF NOT EXISTS referrer text;