-- Slice A.5 follow-up: set default for pits.operating_days
-- Encoding confirmed via Slice A.5 verification: ISO weekday integers (Mon=1..Sun=7).
-- Affects only NEW pits inserted after this migration. Existing rows are unchanged.
ALTER TABLE public.pits
  ALTER COLUMN operating_days SET DEFAULT '{1,2,3,4,5}'::int[];