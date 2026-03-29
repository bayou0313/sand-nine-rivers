
CREATE TABLE public.delivery_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  address text NOT NULL,
  distance_miles numeric,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  contacted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.delivery_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a lead
CREATE POLICY "anon_insert_leads" ON public.delivery_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Admins can view leads
CREATE POLICY "admins_read_leads" ON public.delivery_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update leads
CREATE POLICY "admins_update_leads" ON public.delivery_leads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service role can select (for edge function)
CREATE POLICY "service_role_select_leads" ON public.delivery_leads
  FOR SELECT TO service_role USING (true);

-- Service role can update (for edge function)
CREATE POLICY "service_role_update_leads" ON public.delivery_leads
  FOR UPDATE TO service_role USING (true);
