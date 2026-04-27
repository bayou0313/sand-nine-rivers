-- Slice A.7 — Pricing model correction

-- 1. Add columns to pits
ALTER TABLE public.pits
  ADD COLUMN IF NOT EXISTS base_delivery_fee numeric NOT NULL DEFAULT 120;

ALTER TABLE public.pits
  ADD COLUMN IF NOT EXISTS free_miles integer NOT NULL DEFAULT 15;

-- 2. Backfill (no-op if defaults already populated)
UPDATE public.pits SET base_delivery_fee = 120 WHERE base_delivery_fee = 0;
UPDATE public.pits SET free_miles = 15 WHERE free_miles = 0;

-- 3. Drop pricing columns from hubs (now live on pits)
ALTER TABLE public.hubs DROP COLUMN IF EXISTS free_miles;
ALTER TABLE public.hubs DROP COLUMN IF EXISTS base_delivery_fee;

-- 4. Drop columns from hub_truck_class_rates that don't fit the new model
ALTER TABLE public.hub_truck_class_rates DROP COLUMN IF EXISTS extra_mile_surcharge;
ALTER TABLE public.hub_truck_class_rates DROP COLUMN IF EXISTS free_miles_override;

-- 5. Replace hub_save_rates RPC
CREATE OR REPLACE FUNCTION public.hub_save_rates(
  p_hub_id uuid,
  p_rates  jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row             jsonb;
  v_truck_class_id  uuid;
  v_per_mile_rate   numeric;
  v_bonus_pct       numeric;
  v_count           integer := 0;
BEGIN
  IF p_hub_id IS NULL THEN
    RAISE EXCEPTION 'p_hub_id is required';
  END IF;

  IF p_rates IS NULL OR jsonb_typeof(p_rates) <> 'array' THEN
    RAISE EXCEPTION 'p_rates must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rates) LOOP
    v_truck_class_id := (v_row->>'truck_class_id')::uuid;
    v_per_mile_rate  := COALESCE((v_row->>'per_mile_rate')::numeric, 0);
    v_bonus_pct      := COALESCE((v_row->>'driver_extra_mile_bonus_pct')::numeric, 0);

    IF v_truck_class_id IS NULL THEN
      RAISE EXCEPTION 'truck_class_id is required for each rate row';
    END IF;

    INSERT INTO public.hub_truck_class_rates (
      hub_id, truck_class_id, per_mile_rate,
      driver_extra_mile_bonus_pct, updated_at
    )
    VALUES (
      p_hub_id, v_truck_class_id, v_per_mile_rate,
      v_bonus_pct, now()
    )
    ON CONFLICT (hub_id, truck_class_id) DO UPDATE SET
      per_mile_rate               = EXCLUDED.per_mile_rate,
      driver_extra_mile_bonus_pct = EXCLUDED.driver_extra_mile_bonus_pct,
      updated_at                  = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_count, 'hub_id', p_hub_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hub_save_rates(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_save_rates(uuid, jsonb) TO service_role;
