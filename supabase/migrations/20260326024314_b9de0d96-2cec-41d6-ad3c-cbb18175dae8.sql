
-- Add new columns to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_payment_id text;

-- Update existing rows: set payment_status based on payment_method
UPDATE public.orders SET payment_status = 'pending' WHERE payment_status IS NULL OR payment_status = '';

-- Create payment_events table
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  stripe_payment_id text,
  event_type text NOT NULL,
  event_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view payment events
CREATE POLICY "Admins can view payment events"
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role inserts (edge functions use service role)
CREATE POLICY "Service role can insert payment events"
  ON public.payment_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow anon/authenticated to insert (for edge function with anon key fallback)
CREATE POLICY "Edge functions can insert payment events"
  ON public.payment_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
