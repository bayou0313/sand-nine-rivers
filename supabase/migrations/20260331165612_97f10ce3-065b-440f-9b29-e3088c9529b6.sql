ALTER TABLE public.orders ADD COLUMN delivery_terms_accepted boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN delivery_terms_timestamp timestamptz;
ALTER TABLE public.orders ADD COLUMN card_authorization_accepted boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN card_authorization_timestamp timestamptz;