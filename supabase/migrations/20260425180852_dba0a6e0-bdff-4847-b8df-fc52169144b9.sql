-- Path B Phase 3b — driver workflow states + payment capture
-- Additive only. No data backfill required.

-- Workflow state transition timestamps (one column per transition)
ALTER TABLE public.orders ADD COLUMN acknowledged_at       timestamptz;
ALTER TABLE public.orders ADD COLUMN at_pit_at             timestamptz;
ALTER TABLE public.orders ADD COLUMN loaded_at             timestamptz;
ALTER TABLE public.orders ADD COLUMN workflow_delivered_at timestamptz;

-- Driver payment capture at at_pit step
ALTER TABLE public.orders ADD COLUMN driver_collected_cash  numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN driver_collected_check numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN driver_collected_card  numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN driver_collected_at    timestamptz;

-- Index for /leads "in progress" queries
CREATE INDEX idx_orders_driver_workflow
  ON public.orders(driver_id, driver_workflow_status)
  WHERE driver_workflow_status IS NOT NULL;