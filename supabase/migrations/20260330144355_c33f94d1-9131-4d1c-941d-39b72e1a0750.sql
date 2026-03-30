
-- First clean up any existing duplicates (keep closest PIT)
DELETE FROM city_pages a
USING city_pages b
WHERE a.city_slug = b.city_slug
  AND a.id != b.id
  AND a.distance_from_pit > b.distance_from_pit;

-- Handle exact ties (keep oldest)
DELETE FROM city_pages a
USING city_pages b
WHERE a.city_slug = b.city_slug
  AND a.id != b.id
  AND a.distance_from_pit = b.distance_from_pit
  AND a.created_at > b.created_at;

-- Add unique constraint
ALTER TABLE city_pages
ADD CONSTRAINT city_pages_city_slug_unique UNIQUE (city_slug);

-- Add flag columns
ALTER TABLE city_pages
ADD COLUMN IF NOT EXISTS pit_reassigned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS price_changed  boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS regen_reason   text DEFAULT NULL;
