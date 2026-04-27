BEGIN;

-- ─── 1. hubs: hub-level pricing defaults ─────────────────────────────────────
ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS free_miles integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS base_delivery_fee numeric NOT NULL DEFAULT 0;

-- ─── 2. hub_truck_class_rates: rate matrix expansion ─────────────────────────
ALTER TABLE public.hub_truck_class_rates
  ADD COLUMN IF NOT EXISTS extra_mile_surcharge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_miles_override integer,
  ADD COLUMN IF NOT EXISTS driver_extra_mile_bonus_pct numeric NOT NULL DEFAULT 0;

-- 2a. driver_extra_mile_bonus_pct range check (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.hub_truck_class_rates'::regclass
      AND conname = 'hub_truck_class_rates_driver_bonus_pct_range'
  ) THEN
    ALTER TABLE public.hub_truck_class_rates
      ADD CONSTRAINT hub_truck_class_rates_driver_bonus_pct_range
      CHECK (driver_extra_mile_bonus_pct >= 0 AND driver_extra_mile_bonus_pct <= 1);
  END IF;
END $$;

-- ─── 3. hub_truck_class_rates: updated_at audit column + trigger ─────────────
ALTER TABLE public.hub_truck_class_rates
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_hub_truck_class_rates_updated_at ON public.hub_truck_class_rates;
CREATE TRIGGER update_hub_truck_class_rates_updated_at
  BEFORE UPDATE ON public.hub_truck_class_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 4. hub_pits: status column + CHECK (idempotent) ─────────────────────────
ALTER TABLE public.hub_pits
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.hub_pits'::regclass
      AND conname = 'hub_pits_status_valid'
  ) THEN
    ALTER TABLE public.hub_pits
      ADD CONSTRAINT hub_pits_status_valid
      CHECK (status IN ('active', 'paused'));
  END IF;
END $$;

-- ─── 5. truck_classes: status column + CHECK (idempotent) ────────────────────
ALTER TABLE public.truck_classes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.truck_classes'::regclass
      AND conname = 'truck_classes_status_valid'
  ) THEN
    ALTER TABLE public.truck_classes
      ADD CONSTRAINT truck_classes_status_valid
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- ─── 6. hub_save_rates RPC: atomic multi-row rate save ───────────────────────
CREATE OR REPLACE FUNCTION public.hub_save_rates(
  p_hub_id uuid,
  p_rates  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row              jsonb;
  v_truck_class_id   uuid;
  v_per_mile_rate    numeric;
  v_extra_surcharge  numeric;
  v_free_override    integer;
  v_bonus_pct        numeric;
  v_count            integer := 0;
BEGIN
  IF p_hub_id IS NULL THEN
    RAISE EXCEPTION 'p_hub_id is required';
  END IF;

  IF p_rates IS NULL OR jsonb_typeof(p_rates) <> 'array' THEN
    RAISE EXCEPTION 'p_rates must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rates)
  LOOP
    v_truck_class_id  := (v_row->>'truck_class_id')::uuid;
    v_per_mile_rate   := COALESCE((v_row->>'per_mile_rate')::numeric, 0);
    v_extra_surcharge := COALESCE((v_row->>'extra_mile_surcharge')::numeric, 0);
    v_free_override   := NULLIF(v_row->>'free_miles_override', '')::integer;
    v_bonus_pct       := COALESCE((v_row->>'driver_extra_mile_bonus_pct')::numeric, 0);

    IF v_truck_class_id IS NULL THEN
      RAISE EXCEPTION 'truck_class_id is required for each rate row';
    END IF;

    INSERT INTO public.hub_truck_class_rates (
      hub_id, truck_class_id, per_mile_rate,
      extra_mile_surcharge, free_miles_override, driver_extra_mile_bonus_pct,
      updated_at
    )
    VALUES (
      p_hub_id, v_truck_class_id, v_per_mile_rate,
      v_extra_surcharge, v_free_override, v_bonus_pct,
      now()
    )
    ON CONFLICT (hub_id, truck_class_id) DO UPDATE
      SET per_mile_rate                = EXCLUDED.per_mile_rate,
          extra_mile_surcharge         = EXCLUDED.extra_mile_surcharge,
          free_miles_override          = EXCLUDED.free_miles_override,
          driver_extra_mile_bonus_pct  = EXCLUDED.driver_extra_mile_bonus_pct,
          updated_at                   = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_count, 'hub_id', p_hub_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hub_save_rates(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_save_rates(uuid, jsonb) TO service_role;

COMMIT;