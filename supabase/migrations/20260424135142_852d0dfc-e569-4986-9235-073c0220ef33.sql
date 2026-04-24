CREATE TABLE public.leads_totp_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads_totp_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_backup_codes"
  ON public.leads_totp_backup_codes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_backup_codes_unused
  ON public.leads_totp_backup_codes(used_at)
  WHERE used_at IS NULL;