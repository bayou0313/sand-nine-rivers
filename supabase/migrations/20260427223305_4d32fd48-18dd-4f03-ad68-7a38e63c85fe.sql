BEGIN;

-- 1. hubs
ALTER TABLE public.hubs ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.hubs ADD COLUMN IF NOT EXISTS contact_email text;

-- 2. pits (operating_days default deferred — column is integer[], encoding TBD)
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS vendor_notes text;
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS operating_hours_start time DEFAULT '07:00';
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS operating_hours_end   time DEFAULT '17:00';
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS closed_dates date[] DEFAULT '{}';

-- 3. products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active  boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS default_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS alternatives text[] DEFAULT '{}';

-- 4. trucks
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS make text;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS last_maintenance_date date;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS next_service_due_date date;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS insurance_provider text;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS insurance_policy_number text;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS insurance_expiry date;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS registration_state text DEFAULT 'LA';
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS registration_expiry date;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS dot_number text;

-- 5. truck_maintenance
CREATE TABLE IF NOT EXISTS public.truck_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  service_type text NOT NULL CHECK (service_type IN (
    'Oil Change','Brake Service','Tire Service','DOT Inspection',
    'Engine Repair','Transmission Service','Suspension/Steering',
    'Electrical','Body/Paint','Hydraulics','Cooling System','Other'
  )),
  description text,
  cost numeric DEFAULT 0,
  performed_by text,
  mileage_at_service integer,
  next_service_due date,
  parts_replaced text[] DEFAULT '{}',
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT truck_maintenance_other_requires_description
    CHECK (service_type <> 'Other'
           OR (description IS NOT NULL AND length(trim(description)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_truck_maintenance_truck_date
  ON public.truck_maintenance (truck_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_truck_maintenance_service_date
  ON public.truck_maintenance (service_date);
CREATE INDEX IF NOT EXISTS idx_truck_maintenance_service_type
  ON public.truck_maintenance (service_type);

ALTER TABLE public.truck_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS truck_maintenance_service_manage ON public.truck_maintenance;
CREATE POLICY truck_maintenance_service_manage
  ON public.truck_maintenance
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS truck_maintenance_admin_manage ON public.truck_maintenance;
CREATE POLICY truck_maintenance_admin_manage
  ON public.truck_maintenance
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_truck_maintenance_updated_at ON public.truck_maintenance;
CREATE TRIGGER trg_truck_maintenance_updated_at
  BEFORE UPDATE ON public.truck_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;