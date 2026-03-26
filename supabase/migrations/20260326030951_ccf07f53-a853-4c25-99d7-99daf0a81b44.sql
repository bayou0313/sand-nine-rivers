
-- Add delivery scheduling columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_date date,
ADD COLUMN IF NOT EXISTS delivery_day_of_week text,
ADD COLUMN IF NOT EXISTS saturday_surcharge boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS saturday_surcharge_amount integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_window text NOT NULL DEFAULT '8:00 AM – 5:00 PM',
ADD COLUMN IF NOT EXISTS same_day_requested boolean NOT NULL DEFAULT false;
