-- ============================================================================
-- WAYS → LMT MIGRATION v2 — SLICE A.8 PART 2
-- Markup Floor + Cost Change Tracking
-- Single transaction, idempotent guards
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1 — global_settings: defaults for markup floor + cost change threshold
-- ----------------------------------------------------------------------------
INSERT INTO public.global_settings (key, value) VALUES
  ('default_minimum_markup_pct', '0.25'),
  ('default_minimum_markup_dollars', '25'),
  ('cost_change_notification_threshold', '0.05')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PART 2 — products: per-product overrides (nullable; NULL = use global)
-- No CHECK constraints — 0 is a valid explicit "no floor" value.
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS minimum_markup_pct numeric NULL,
  ADD COLUMN IF NOT EXISTS minimum_markup_dollars numeric NULL;

-- ----------------------------------------------------------------------------
-- PART 3 — pricing_overrides: audit log for sub-floor pricing decisions
-- Scope: per hub_pit_products row (hub × pit × product commercial layer)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_pit_product_id uuid NOT NULL
    REFERENCES public.hub_pit_products(id) ON DELETE CASCADE,
  attempted_price numeric NOT NULL,
  cost_at_time numeric NOT NULL,
  minimum_required numeric NOT NULL,
  override_reason text,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_overrides_hub_pit_product_id_idx
  ON public.pricing_overrides(hub_pit_product_id);
CREATE INDEX IF NOT EXISTS pricing_overrides_created_at_idx
  ON public.pricing_overrides(created_at DESC);

ALTER TABLE public.pricing_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pricing_overrides'
      AND policyname = 'pricing_overrides_service_manage'
  ) THEN
    CREATE POLICY pricing_overrides_service_manage
      ON public.pricing_overrides
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pricing_overrides'
      AND policyname = 'pricing_overrides_admin_read'
  ) THEN
    CREATE POLICY pricing_overrides_admin_read
      ON public.pricing_overrides
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- PART 4 — cost_change_events: notification + review queue for cost movements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_change_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pit_id uuid NOT NULL
    REFERENCES public.pits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL
    REFERENCES public.products(id) ON DELETE CASCADE,
  pit_inventory_id uuid NOT NULL
    REFERENCES public.pit_inventory(id) ON DELETE CASCADE,
  old_cost numeric,
  new_cost numeric NOT NULL,
  change_amount numeric,
  change_pct numeric,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text,
  status text NOT NULL DEFAULT 'pending_review',
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cost_change_events_status_check'
  ) THEN
    ALTER TABLE public.cost_change_events
      ADD CONSTRAINT cost_change_events_status_check
      CHECK (status IN ('pending_review', 'reviewed', 'dismissed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cost_change_events_status_idx
  ON public.cost_change_events(status);
CREATE INDEX IF NOT EXISTS cost_change_events_changed_at_idx
  ON public.cost_change_events(changed_at DESC);
CREATE INDEX IF NOT EXISTS cost_change_events_pit_inventory_id_idx
  ON public.cost_change_events(pit_inventory_id);

ALTER TABLE public.cost_change_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cost_change_events'
      AND policyname = 'cost_change_events_service_manage'
  ) THEN
    CREATE POLICY cost_change_events_service_manage
      ON public.cost_change_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cost_change_events'
      AND policyname = 'cost_change_events_admin_manage'
  ) THEN
    CREATE POLICY cost_change_events_admin_manage
      ON public.cost_change_events
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- PART 5 — Trigger: track_pit_inventory_cost_change
-- Fires AFTER UPDATE OF cost_per_unit on pit_inventory.
-- Logs an event when |change_pct| >= threshold, OR when prior cost was
-- NULL/0 (first-cost-set — change_pct=NULL but still logged).
-- Does NOT swallow exceptions.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_pit_inventory_cost_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold     numeric;
  v_change_amount numeric;
  v_change_pct    numeric;
BEGIN
  -- Only act when cost_per_unit actually changed
  IF NEW.cost_per_unit IS NOT DISTINCT FROM OLD.cost_per_unit THEN
    RETURN NEW;
  END IF;

  -- Read threshold (default 0.05 if missing/unparseable)
  SELECT COALESCE(NULLIF(value, '')::numeric, 0.05)
    INTO v_threshold
  FROM public.global_settings
  WHERE key = 'cost_change_notification_threshold'
  LIMIT 1;

  IF v_threshold IS NULL THEN
    v_threshold := 0.05;
  END IF;

  -- Compute change_amount (NULL old → NULL amount)
  IF OLD.cost_per_unit IS NULL THEN
    v_change_amount := NULL;
  ELSE
    v_change_amount := NEW.cost_per_unit - OLD.cost_per_unit;
  END IF;

  -- Compute change_pct, handling NULL/0 baseline
  IF OLD.cost_per_unit IS NULL OR OLD.cost_per_unit = 0 THEN
    v_change_pct := NULL;
  ELSE
    v_change_pct := v_change_amount / OLD.cost_per_unit;
  END IF;

  -- Log if first-cost-set (NULL pct) OR threshold exceeded
  IF v_change_pct IS NULL OR ABS(v_change_pct) >= v_threshold THEN
    INSERT INTO public.cost_change_events (
      pit_id,
      product_id,
      pit_inventory_id,
      old_cost,
      new_cost,
      change_amount,
      change_pct,
      changed_at,
      status
    ) VALUES (
      NEW.pit_id,
      NEW.product_id,
      NEW.id,
      OLD.cost_per_unit,
      NEW.cost_per_unit,
      v_change_amount,
      v_change_pct,
      now(),
      'pending_review'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_pit_inventory_cost_change_trg ON public.pit_inventory;
CREATE TRIGGER track_pit_inventory_cost_change_trg
  AFTER UPDATE OF cost_per_unit ON public.pit_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.track_pit_inventory_cost_change();