ALTER TABLE visitor_sessions 
ADD COLUMN IF NOT EXISTS stripe_link_clicked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_link_clicked_at timestamptz;