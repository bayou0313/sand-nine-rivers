-- Phase 0: Drivers foundation schema
-- New drivers table + two nullable columns on orders. No data migration needed.

CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  truck_number text,
  payment_type text DEFAULT 'per_load',  -- 'per_load' | 'hourly' | 'flat_day'
  payment_rate numeric DEFAULT 0,
  license_expires_on date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger using existing helper
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index on active flag for the common list query
CREATE INDEX idx_drivers_active ON public.drivers(active) WHERE active = true;

-- Unique constraint on phone to prevent duplicate active driver records
CREATE UNIQUE INDEX idx_drivers_phone_unique ON public.drivers(phone) WHERE active = true;

-- Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Service role full access (leads-auth edge function operates as service role)
CREATE POLICY "service_manage_drivers"
  ON public.drivers
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Admin JWT read access (matches riversand admins_read_* pattern)
CREATE POLICY "admins_read_drivers"
  ON public.drivers
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add driver_id + driver_workflow_status to orders (both nullable, no default)
ALTER TABLE public.orders
  ADD COLUMN driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN driver_workflow_status text;

-- Index for querying orders by driver
CREATE INDEX idx_orders_driver_id ON public.orders(driver_id) WHERE driver_id IS NOT NULL;