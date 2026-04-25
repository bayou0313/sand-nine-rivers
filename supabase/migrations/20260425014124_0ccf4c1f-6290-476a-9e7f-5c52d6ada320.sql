-- Path B Phase 3a — driver portal auth foundation

-- drivers table additions: PIN credential + login telemetry
ALTER TABLE public.drivers
  ADD COLUMN pin_hash text,
  ADD COLUMN pin_set_at timestamptz,
  ADD COLUMN last_login_at timestamptz;

-- driver_sessions table: opaque session tokens (SHA-256 hashed), 30-day TTL
CREATE TABLE public.driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address text,
  user_agent text
);

CREATE INDEX idx_driver_sessions_driver_id ON public.driver_sessions(driver_id);
CREATE INDEX idx_driver_sessions_token_hash ON public.driver_sessions(session_token_hash);
CREATE INDEX idx_driver_sessions_active ON public.driver_sessions(driver_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.driver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_driver_sessions"
  ON public.driver_sessions
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);