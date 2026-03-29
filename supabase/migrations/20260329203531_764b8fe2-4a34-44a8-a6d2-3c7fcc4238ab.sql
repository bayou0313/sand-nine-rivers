
-- Create city_pages table
CREATE TABLE public.city_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  pit_id uuid REFERENCES public.pits(id) ON DELETE CASCADE,
  city_name text NOT NULL,
  city_slug text NOT NULL,
  state text NOT NULL DEFAULT 'LA',
  zip_codes text[],
  lat numeric,
  lng numeric,
  distance_from_pit numeric,
  base_price numeric,
  status text DEFAULT 'draft',
  meta_title text,
  meta_description text,
  h1_text text,
  content text,
  content_generated_at timestamptz,
  page_views integer DEFAULT 0,
  last_viewed_at timestamptz,
  UNIQUE(city_slug, pit_id),
  CONSTRAINT city_pages_status_check CHECK (status IN ('active', 'inactive', 'draft'))
);

-- Enable RLS
ALTER TABLE public.city_pages ENABLE ROW LEVEL SECURITY;

-- Public can read active pages
CREATE POLICY "public_read_active_city_pages"
ON public.city_pages FOR SELECT
USING (status = 'active');

-- Service role can do everything
CREATE POLICY "service_manage_city_pages"
ON public.city_pages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add served_cities to pits
ALTER TABLE public.pits
ADD COLUMN IF NOT EXISTS served_cities jsonb DEFAULT NULL;

-- RPC to increment page views (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.increment_city_page_views(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE city_pages
  SET page_views = page_views + 1,
      last_viewed_at = now()
  WHERE city_slug = p_slug AND status = 'active';
END;
$$;

-- Auto-update updated_at
CREATE TRIGGER update_city_pages_updated_at
BEFORE UPDATE ON public.city_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
