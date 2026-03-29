
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS nearest_pit_name text;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS nearest_pit_id uuid;
ALTER TABLE delivery_leads ADD COLUMN IF NOT EXISTS nearest_pit_distance numeric;
