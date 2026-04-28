-- Slice A.8 Part 1: Commercial Layer
-- 1. Add base_delivery_fee to hub_truck_class_rates
ALTER TABLE public.hub_truck_class_rates
  ADD COLUMN IF NOT EXISTS base_delivery_fee numeric NOT NULL DEFAULT 120;

-- 2. Create hub_pit_products table (per-hub × pit × product selling price)
CREATE TABLE IF NOT EXISTS public.hub_pit_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  pit_id uuid NOT NULL REFERENCES public.pits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_per_unit numeric NOT NULL CHECK (price_per_unit >= 0),
  is_available_in_hub boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hub_id, pit_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_pit_products_hub_available
  ON public.hub_pit_products (hub_id, is_available_in_hub);
CREATE INDEX IF NOT EXISTS idx_hub_pit_products_pit
  ON public.hub_pit_products (pit_id);
CREATE INDEX IF NOT EXISTS idx_hub_pit_products_product
  ON public.hub_pit_products (product_id);

ALTER TABLE public.hub_pit_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'hub_pit_products_service_manage'
      AND polrelid = 'public.hub_pit_products'::regclass
  ) THEN
    CREATE POLICY hub_pit_products_service_manage
      ON public.hub_pit_products
      AS PERMISSIVE FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'hub_pit_products_admin_manage'
      AND polrelid = 'public.hub_pit_products'::regclass
  ) THEN
    CREATE POLICY hub_pit_products_admin_manage
      ON public.hub_pit_products
      AS PERMISSIVE FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_hub_pit_products_updated_at
  ON public.hub_pit_products;
CREATE TRIGGER update_hub_pit_products_updated_at
  BEFORE UPDATE ON public.hub_pit_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Replace hub_save_rates RPC to handle base_delivery_fee
CREATE OR REPLACE FUNCTION public.hub_save_rates(
  p_hub_id uuid,
  p_rates  jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row              jsonb;
  v_truck_class_id   uuid;
  v_per_mile_rate    numeric;
  v_base_fee         numeric;
  v_bonus_pct        numeric;
  v_count            integer := 0;
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
    v_base_fee       := COALESCE((v_row->>'base_delivery_fee')::numeric, 120);
    v_bonus_pct      := COALESCE((v_row->>'driver_extra_mile_bonus_pct')::numeric, 0);

    IF v_truck_class_id IS NULL THEN
      RAISE EXCEPTION 'truck_class_id is required for each rate row';
    END IF;

    INSERT INTO public.hub_truck_class_rates (
      hub_id, truck_class_id, per_mile_rate, base_delivery_fee,
      driver_extra_mile_bonus_pct, updated_at
    )
    VALUES (
      p_hub_id, v_truck_class_id, v_per_mile_rate, v_base_fee,
      v_bonus_pct, now()
    )
    ON CONFLICT (hub_id, truck_class_id) DO UPDATE SET
      per_mile_rate               = EXCLUDED.per_mile_rate,
      base_delivery_fee           = EXCLUDED.base_delivery_fee,
      driver_extra_mile_bonus_pct = EXCLUDED.driver_extra_mile_bonus_pct,
      updated_at                  = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_count, 'hub_id', p_hub_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hub_save_rates(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_save_rates(uuid, jsonb) TO service_role;