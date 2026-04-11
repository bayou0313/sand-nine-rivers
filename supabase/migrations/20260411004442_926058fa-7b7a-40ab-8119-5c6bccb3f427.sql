-- Add pricing breakdown columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS base_unit_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS distance_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS processing_fee numeric(10,2);

-- Add review tracking columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS review_request_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_request_sent_at timestamptz;

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  order_id uuid REFERENCES public.orders(id),
  order_number text,
  customer_name text,
  customer_email text,
  rating integer,
  feedback text,
  sent_to_gmb boolean DEFAULT false,
  review_request_sent_at timestamptz,
  review_submitted_at timestamptz
);

-- Add validation trigger for rating (1-5) instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_review_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5) THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_review_rating_trigger
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_review_rating();

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_manage_reviews"
  ON public.reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon can insert (for the review submission page)
CREATE POLICY "anon_insert_reviews"
  ON public.reviews
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admin can read reviews
CREATE POLICY "admins_read_reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add global settings for review system
INSERT INTO public.global_settings (key, value, description, is_public)
VALUES
  ('pricing_mode', 'transparent', 'Pricing display mode: transparent or baked_in', false),
  ('gmb_review_url', '', 'Google My Business review URL', false),
  ('review_request_enabled', 'false', 'Enable automated review request emails', false),
  ('review_threshold', '4', 'Minimum star rating to redirect to GMB', false)
ON CONFLICT (key) DO NOTHING;