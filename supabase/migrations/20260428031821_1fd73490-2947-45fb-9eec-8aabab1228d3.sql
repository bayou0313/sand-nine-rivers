
-- Slice A.9 — Schema Integrity Patch
-- Tier 1 RESTRICT FKs (11) + Tier 2 CASCADE FKs (10) + status columns on pit_inventory & hub_pit_products

DO $$
BEGIN
  -- ============================================================
  -- TIER 1 — RESTRICT (transactional parents, soft-delete-only)
  -- ============================================================

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_drivers_primary_hub_id' AND conrelid = 'public.drivers'::regclass) THEN
    ALTER TABLE public.drivers ADD CONSTRAINT fk_drivers_primary_hub_id
      FOREIGN KEY (primary_hub_id) REFERENCES public.hubs(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trucks_hub_id' AND conrelid = 'public.trucks'::regclass) THEN
    ALTER TABLE public.trucks ADD CONSTRAINT fk_trucks_hub_id
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trucks_class_id' AND conrelid = 'public.trucks'::regclass) THEN
    ALTER TABLE public.trucks ADD CONSTRAINT fk_trucks_class_id
      FOREIGN KEY (class_id) REFERENCES public.truck_classes(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_driver_id' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ADD CONSTRAINT fk_orders_driver_id
      FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_pit_id' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ADD CONSTRAINT fk_orders_pit_id
      FOREIGN KEY (pit_id) REFERENCES public.pits(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_customer_id' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ADD CONSTRAINT fk_orders_customer_id
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pit_inventory_pit_id' AND conrelid = 'public.pit_inventory'::regclass) THEN
    ALTER TABLE public.pit_inventory ADD CONSTRAINT fk_pit_inventory_pit_id
      FOREIGN KEY (pit_id) REFERENCES public.pits(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pit_inventory_product_id' AND conrelid = 'public.pit_inventory'::regclass) THEN
    ALTER TABLE public.pit_inventory ADD CONSTRAINT fk_pit_inventory_product_id
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_change_events_pit_id' AND conrelid = 'public.cost_change_events'::regclass) THEN
    ALTER TABLE public.cost_change_events ADD CONSTRAINT fk_cost_change_events_pit_id
      FOREIGN KEY (pit_id) REFERENCES public.pits(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_change_events_product_id' AND conrelid = 'public.cost_change_events'::regclass) THEN
    ALTER TABLE public.cost_change_events ADD CONSTRAINT fk_cost_change_events_product_id
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pricing_overrides_hpp_id' AND conrelid = 'public.pricing_overrides'::regclass) THEN
    ALTER TABLE public.pricing_overrides ADD CONSTRAINT fk_pricing_overrides_hpp_id
      FOREIGN KEY (hub_pit_product_id) REFERENCES public.hub_pit_products(id) ON DELETE RESTRICT;
  END IF;

  -- ============================================================
  -- TIER 2 — CASCADE (junction/child rows)
  -- ============================================================

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hub_pits_hub_id' AND conrelid = 'public.hub_pits'::regclass) THEN
    ALTER TABLE public.hub_pits ADD CONSTRAINT fk_hub_pits_hub_id
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hub_pits_pit_id' AND conrelid = 'public.hub_pits'::regclass) THEN
    ALTER TABLE public.hub_pits ADD CONSTRAINT fk_hub_pits_pit_id
      FOREIGN KEY (pit_id) REFERENCES public.pits(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_htcr_hub_id' AND conrelid = 'public.hub_truck_class_rates'::regclass) THEN
    ALTER TABLE public.hub_truck_class_rates ADD CONSTRAINT fk_htcr_hub_id
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_htcr_truck_class_id' AND conrelid = 'public.hub_truck_class_rates'::regclass) THEN
    ALTER TABLE public.hub_truck_class_rates ADD CONSTRAINT fk_htcr_truck_class_id
      FOREIGN KEY (truck_class_id) REFERENCES public.truck_classes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hpp_hub_id' AND conrelid = 'public.hub_pit_products'::regclass) THEN
    ALTER TABLE public.hub_pit_products ADD CONSTRAINT fk_hpp_hub_id
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hpp_pit_id' AND conrelid = 'public.hub_pit_products'::regclass) THEN
    ALTER TABLE public.hub_pit_products ADD CONSTRAINT fk_hpp_pit_id
      FOREIGN KEY (pit_id) REFERENCES public.pits(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hpp_product_id' AND conrelid = 'public.hub_pit_products'::regclass) THEN
    ALTER TABLE public.hub_pit_products ADD CONSTRAINT fk_hpp_product_id
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_driver_compensation_driver_id' AND conrelid = 'public.driver_compensation'::regclass) THEN
    ALTER TABLE public.driver_compensation ADD CONSTRAINT fk_driver_compensation_driver_id
      FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_driver_goals_driver_id' AND conrelid = 'public.driver_goals'::regclass) THEN
    ALTER TABLE public.driver_goals ADD CONSTRAINT fk_driver_goals_driver_id
      FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_change_events_pit_inventory_id' AND conrelid = 'public.cost_change_events'::regclass) THEN
    ALTER TABLE public.cost_change_events ADD CONSTRAINT fk_cost_change_events_pit_inventory_id
      FOREIGN KEY (pit_inventory_id) REFERENCES public.pit_inventory(id) ON DELETE CASCADE;
  END IF;

  -- ============================================================
  -- STATUS COLUMNS — pit_inventory & hub_pit_products
  -- ============================================================

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'pit_inventory' AND column_name = 'status') THEN
    ALTER TABLE public.pit_inventory ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pit_inventory_status_check' AND conrelid = 'public.pit_inventory'::regclass) THEN
    ALTER TABLE public.pit_inventory ADD CONSTRAINT pit_inventory_status_check
      CHECK (status IN ('active','inactive','archived'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'hub_pit_products' AND column_name = 'status') THEN
    ALTER TABLE public.hub_pit_products ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_pit_products_status_check' AND conrelid = 'public.hub_pit_products'::regclass) THEN
    ALTER TABLE public.hub_pit_products ADD CONSTRAINT hub_pit_products_status_check
      CHECK (status IN ('active','inactive','archived'));
  END IF;
END $$;
