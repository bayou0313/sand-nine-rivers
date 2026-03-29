
ALTER TABLE public.pits
ADD COLUMN IF NOT EXISTS operating_days integer[] DEFAULT NULL;

ALTER TABLE public.pits
ADD COLUMN IF NOT EXISTS saturday_surcharge_override numeric DEFAULT NULL;

ALTER TABLE public.pits
ADD COLUMN IF NOT EXISTS same_day_cutoff text DEFAULT NULL;

ALTER TABLE public.pits
DROP COLUMN IF EXISTS operating_hours_open;

ALTER TABLE public.pits
DROP COLUMN IF EXISTS operating_hours_close;

ALTER TABLE public.pits
DROP COLUMN IF EXISTS saturday_available;
