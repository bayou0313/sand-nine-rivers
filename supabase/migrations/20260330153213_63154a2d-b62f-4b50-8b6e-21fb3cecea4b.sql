
ALTER TABLE city_pages
ADD COLUMN IF NOT EXISTS multi_pit_coverage boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS competing_pit_ids uuid[] DEFAULT NULL;
