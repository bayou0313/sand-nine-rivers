ALTER TABLE public.visitor_sessions ADD COLUMN ip_org text;
ALTER TABLE public.visitor_sessions ADD COLUMN ip_city text;
ALTER TABLE public.visitor_sessions ADD COLUMN ip_zip text;
ALTER TABLE public.visitor_sessions ADD COLUMN ip_is_business boolean DEFAULT false;