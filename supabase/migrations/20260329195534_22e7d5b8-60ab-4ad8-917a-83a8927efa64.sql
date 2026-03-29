
-- Visitor sessions for abandonment tracking
CREATE TABLE public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  session_token text UNIQUE NOT NULL,
  delivery_address text,
  address_lat numeric,
  address_lng numeric,
  nearest_pit_id uuid REFERENCES public.pits(id),
  nearest_pit_name text,
  calculated_price numeric,
  serviceable boolean,
  customer_name text,
  customer_email text,
  customer_phone text,
  stage text DEFAULT 'visited'
    CHECK (stage IN (
      'visited',
      'entered_address',
      'got_price',
      'got_out_of_area',
      'started_checkout',
      'reached_payment',
      'completed_order'
    )),
  visit_count integer DEFAULT 1,
  last_seen_at timestamptz DEFAULT now(),
  order_id uuid,
  order_number text,
  email_1hr_sent boolean DEFAULT false,
  email_24hr_sent boolean DEFAULT false,
  email_72hr_sent boolean DEFAULT false,
  email_1hr_sent_at timestamptz,
  email_24hr_sent_at timestamptz,
  email_72hr_sent_at timestamptz
);

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_sessions"
ON public.visitor_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_sessions"
ON public.visitor_sessions FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "service_read_sessions"
ON public.visitor_sessions FOR SELECT
TO service_role
USING (true);

CREATE POLICY "admins_read_sessions"
ON public.visitor_sessions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_update_sessions"
ON public.visitor_sessions FOR UPDATE
TO service_role
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_visitor_sessions_updated_at
BEFORE UPDATE ON public.visitor_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to increment visit count
CREATE OR REPLACE FUNCTION public.increment_visit_count(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE visitor_sessions
  SET visit_count = visit_count + 1,
      last_seen_at = now()
  WHERE session_token = p_token;
END;
$$;

-- Add discount_amount to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
