-- Add is_public column to global_settings
ALTER TABLE public.global_settings ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Mark all frontend-accessible keys as public
UPDATE public.global_settings SET is_public = true WHERE key IN (
  'site_mode', 'stripe_mode', 'stripe_test_banner',
  'default_base_price', 'default_free_miles', 'default_extra_per_mile', 'default_max_distance', 'saturday_surcharge',
  'brand_palette', 'brand_primary', 'brand_accent', 'brand_background',
  'primary_color', 'accent_color',
  'phone', 'site_name'
) OR key LIKE 'seo_%';

-- Replace the overly permissive public read policy
DROP POLICY IF EXISTS public_read_settings ON public.global_settings;
CREATE POLICY public_read_settings ON public.global_settings
  FOR SELECT TO public
  USING (is_public = true);