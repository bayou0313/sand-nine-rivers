BEGIN;

-- =============================================================================
-- 1. TRUCK_CLASSES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.truck_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capacity_tons numeric,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.truck_classes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY truck_classes_service_manage ON public.truck_classes FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY truck_classes_admin_read ON public.truck_classes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. HUBS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  lat numeric,
  lng numeric,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY hubs_service_manage ON public.hubs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY hubs_admin_read ON public.hubs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. HUB_TRUCK_CLASS_RATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hub_truck_class_rates (
  hub_id uuid NOT NULL,
  truck_class_id uuid NOT NULL,
  per_mile_rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_id, truck_class_id)
);
ALTER TABLE public.hub_truck_class_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY hub_truck_class_rates_service_manage ON public.hub_truck_class_rates FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY hub_truck_class_rates_admin_read ON public.hub_truck_class_rates FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. HUB_PITS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hub_pits (
  hub_id uuid NOT NULL,
  pit_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_id, pit_id)
);
ALTER TABLE public.hub_pits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY hub_pits_service_manage ON public.hub_pits FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY hub_pits_admin_read ON public.hub_pits FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 5. TRUCKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hub_id uuid,
  class_id uuid,
  surecam_device_id text,
  license_plate text,
  vin text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY trucks_service_manage ON public.trucks FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY trucks_admin_read ON public.trucks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 6. DRIVER_COMPENSATION
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.driver_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  comp_type text NOT NULL,
  rate numeric NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_compensation ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY driver_compensation_service_manage ON public.driver_compensation FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY driver_compensation_admin_read ON public.driver_compensation FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 7. DRIVER_GOALS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.driver_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  goal_type text NOT NULL,
  target_value numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_goals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY driver_goals_service_manage ON public.driver_goals FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY driver_goals_admin_read ON public.driver_goals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 8. TRUCK_SESSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.truck_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS truck_sessions_active_unique
  ON public.truck_sessions (truck_id) WHERE ended_at IS NULL;
ALTER TABLE public.truck_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY truck_sessions_service_manage ON public.truck_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY truck_sessions_admin_read ON public.truck_sessions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- COLUMN ADDITIONS
-- =============================================================================

-- pit_inventory
ALTER TABLE public.pit_inventory ADD COLUMN IF NOT EXISTS cost_per_unit numeric;
ALTER TABLE public.pit_inventory ADD COLUMN IF NOT EXISTS cost_per_truck numeric DEFAULT 0;
ALTER TABLE public.pit_inventory ADD COLUMN IF NOT EXISTS smart_offers_ref text;

-- drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('active','inactive','on_leave','terminated'));
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS primary_hub_id uuid;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS secondary_hub_ids uuid[];
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS employment_entity text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_class text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS hire_date date;

-- backfill drivers.status from existing active boolean
UPDATE public.drivers
SET status = CASE WHEN active THEN 'active' ELSE 'inactive' END
WHERE status IS NULL OR status = 'active';

-- pits, products, orders
ALTER TABLE public.pits ADD COLUMN IF NOT EXISTS min_distance numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS truck_session_id uuid;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- 4 truck classes
INSERT INTO public.truck_classes (name, capacity_tons, description) VALUES
  ('Pickup', 1, 'Pickup truck for small loads'),
  ('Single-Axle Dump', 7, 'Single-axle dump truck'),
  ('Tandem Dump', 15, 'Tandem-axle dump truck'),
  ('Tri-Axle Dump', 22, 'Tri-axle dump truck')
ON CONFLICT (name) DO NOTHING;

-- 1 hub
INSERT INTO public.hubs (name, address, status) VALUES
  ('New Orleans Hub', 'New Orleans, LA', 'active')
ON CONFLICT (name) DO NOTHING;

-- 4 hub × class rates @ $4.49/mile
INSERT INTO public.hub_truck_class_rates (hub_id, truck_class_id, per_mile_rate)
SELECT h.id, tc.id, 4.49
FROM public.hubs h
CROSS JOIN public.truck_classes tc
WHERE h.name = 'New Orleans Hub'
ON CONFLICT (hub_id, truck_class_id) DO NOTHING;

-- attach all existing active pits to the New Orleans Hub
INSERT INTO public.hub_pits (hub_id, pit_id, priority)
SELECT h.id, p.id, 100
FROM public.hubs h
CROSS JOIN public.pits p
WHERE h.name = 'New Orleans Hub'
  AND p.status = 'active'
ON CONFLICT (hub_id, pit_id) DO NOTHING;

COMMIT;