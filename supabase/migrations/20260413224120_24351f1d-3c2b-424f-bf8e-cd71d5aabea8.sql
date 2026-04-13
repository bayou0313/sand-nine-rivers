ALTER TABLE public.visitor_sessions
ADD COLUMN IF NOT EXISTS email_48hr_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_48hr_sent_at timestamptz;