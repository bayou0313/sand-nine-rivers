ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS capture_status text DEFAULT null,
  ADD COLUMN IF NOT EXISTS capture_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_token uuid DEFAULT null,
  ADD COLUMN IF NOT EXISTS reschedule_token_used boolean DEFAULT false;