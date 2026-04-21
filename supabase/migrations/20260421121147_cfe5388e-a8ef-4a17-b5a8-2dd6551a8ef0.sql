ALTER TABLE public.pits
  ADD COLUMN delivery_hours jsonb;

COMMENT ON COLUMN public.pits.delivery_hours IS
  'Per-day-of-week delivery window. Keys are day-of-week strings ("0"=Sun ... "6"=Sat). Each value is { "open": "HH:MM", "close": "HH:MM" } in 24h local time. Missing keys = day not configured. NULL = no hours configured for any day.';