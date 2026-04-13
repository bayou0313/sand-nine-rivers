ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billed_distance_miles numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_northshore boolean DEFAULT false;