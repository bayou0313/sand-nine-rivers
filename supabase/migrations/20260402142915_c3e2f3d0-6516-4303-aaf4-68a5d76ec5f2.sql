CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text DEFAULT NULL,
  entity_id text DEFAULT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON public.notifications FOR SELECT TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;