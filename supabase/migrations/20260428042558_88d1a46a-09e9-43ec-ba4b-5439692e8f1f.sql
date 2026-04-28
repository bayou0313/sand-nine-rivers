-- Truck-driver assignment history (versioned)
CREATE TABLE IF NOT EXISTS public.truck_driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE RESTRICT,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_truck_driver_assignments_truck_time
  ON public.truck_driver_assignments (truck_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_truck_driver_assignments_driver
  ON public.truck_driver_assignments (driver_id) WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_truck_driver_assignments_active
  ON public.truck_driver_assignments (truck_id) WHERE effective_to IS NULL;

ALTER TABLE public.truck_driver_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
    WHERE polname = 'tda_service_manage'
      AND polrelid = 'public.truck_driver_assignments'::regclass) THEN
    CREATE POLICY tda_service_manage ON public.truck_driver_assignments
      AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy
    WHERE polname = 'tda_admin_manage'
      AND polrelid = 'public.truck_driver_assignments'::regclass) THEN
    CREATE POLICY tda_admin_manage ON public.truck_driver_assignments
      AS PERMISSIVE FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Refinement 1: Separate DOT Inspection Expiry from Registration Expiry
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS dot_expiry date;

-- Refinement 2: Partial unique index on truck name (case-insensitive, active only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trucks_name_active_unique
  ON public.trucks (LOWER(name))
  WHERE status <> 'inactive';