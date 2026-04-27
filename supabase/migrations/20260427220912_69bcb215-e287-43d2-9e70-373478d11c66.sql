-- Slice A completion: Truck class corrections
-- Adds max_yards and max_tons columns, renames classes to real WAYS fleet,
-- and backfills capacity values.
-- NOTE: capacity_tons is DEPRECATED in favor of max_tons. Kept for backward
-- compatibility (mirrors drivers.active vs drivers.status pattern).
-- Scheduled for removal in Slice D after Truck Classes UI is wired.

BEGIN;

ALTER TABLE public.truck_classes ADD COLUMN IF NOT EXISTS max_yards numeric;
ALTER TABLE public.truck_classes ADD COLUMN IF NOT EXISTS max_tons numeric;

UPDATE public.truck_classes SET name='Small',       max_yards=3,  max_tons=4,  capacity_tons=4  WHERE name='Pickup';
UPDATE public.truck_classes SET name='Single Axle', max_yards=9,  max_tons=10, capacity_tons=10 WHERE name='Single-Axle Dump';
UPDATE public.truck_classes SET name='Tandem Axle', max_yards=12, max_tons=15, capacity_tons=15 WHERE name='Tandem Dump';
UPDATE public.truck_classes SET name='Triaxle',     max_yards=18, max_tons=20, capacity_tons=20 WHERE name='Tri-Axle Dump';

-- Fail loudly if any expected row is missing
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.truck_classes
  WHERE name IN ('Small','Single Axle','Tandem Axle','Triaxle');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 renamed truck_classes rows, found %', v_count;
  END IF;
END $$;

COMMIT;