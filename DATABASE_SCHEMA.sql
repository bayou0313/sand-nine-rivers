-- ============================================================================
-- DATABASE_SCHEMA.sql — riversand.net
-- Complete database structure as executable SQL
-- Generated: March 30, 2026
-- ============================================================================

-- ============================================================================
-- 1. CUSTOM TYPES & ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- ============================================================================
-- 3. TABLE DEFINITIONS
-- ============================================================================

-- ── pits ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pits (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                        text        NOT NULL,
  address                     text        NOT NULL,
  lat                         numeric     NOT NULL,
  lon                         numeric     NOT NULL,
  status                      text        NOT NULL DEFAULT 'active',
  is_default                  boolean     NOT NULL DEFAULT false,
  base_price                  numeric,
  free_miles                  numeric,
  price_per_extra_mile        numeric,
  max_distance                numeric,
  operating_days              integer[],
  saturday_surcharge_override numeric,
  same_day_cutoff             text,
  served_cities               jsonb,
  notes                       text        DEFAULT '',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── city_pages ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.city_pages (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_name            text        NOT NULL,
  city_slug            text        NOT NULL,
  state                text        NOT NULL DEFAULT 'LA',
  region               text,
  pit_id               uuid        REFERENCES public.pits(id),
  lat                  numeric,
  lng                  numeric,
  distance_from_pit    numeric,
  base_price           numeric,
  zip_codes            text[],
  status               text        DEFAULT 'draft',
  meta_title           text,
  meta_description     text,
  h1_text              text,
  hero_intro           text,
  why_choose_intro     text,
  delivery_details     text,
  local_uses           text,
  local_expertise      text,
  faq_items            jsonb,
  content              text,
  prompt_version       text,
  pit_reassigned       boolean     DEFAULT false,
  price_changed        boolean     DEFAULT false,
  regen_reason         text,
  multi_pit_coverage   boolean     DEFAULT false,
  competing_pit_ids    uuid[],
  page_views           integer     DEFAULT 0,
  last_viewed_at       timestamptz,
  content_generated_at timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  CONSTRAINT city_pages_city_slug_unique UNIQUE (city_slug)
);

-- ── orders ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id                        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number              text        UNIQUE,
  customer_name             text        NOT NULL,
  customer_email            text,
  customer_phone            text        NOT NULL,
  delivery_address          text        NOT NULL,
  distance_miles            numeric     NOT NULL,
  price                     numeric     NOT NULL,
  quantity                  integer     NOT NULL DEFAULT 1,
  delivery_date             date,
  delivery_day_of_week      text,
  delivery_window           text        NOT NULL DEFAULT '8:00 AM – 5:00 PM',
  same_day_requested        boolean     NOT NULL DEFAULT false,
  saturday_surcharge        boolean     NOT NULL DEFAULT false,
  saturday_surcharge_amount integer     NOT NULL DEFAULT 0,
  tax_rate                  numeric     NOT NULL DEFAULT 0,
  tax_amount                numeric     NOT NULL DEFAULT 0,
  discount_amount           numeric     DEFAULT 0,
  payment_method            text        NOT NULL DEFAULT 'COD',
  payment_status            text        NOT NULL DEFAULT 'pending',
  status                    text        NOT NULL DEFAULT 'pending',
  stripe_payment_id         text,
  confirmation_token        uuid        NOT NULL DEFAULT gen_random_uuid(),
  lookup_token              uuid        DEFAULT gen_random_uuid(),
  lookup_token_used         boolean     NOT NULL DEFAULT false,
  notes                     text,
  lead_reference            text,
  cash_collected            boolean     DEFAULT false,
  cash_collected_at         timestamptz,
  cash_collected_by         text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ── delivery_leads ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_leads (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_number        text,
  customer_name      text        NOT NULL,
  customer_email     text,
  customer_phone     text,
  address            text        NOT NULL,
  distance_miles     numeric,
  nearest_pit_id     uuid,
  nearest_pit_name   text,
  nearest_pit_distance numeric,
  stage              text        DEFAULT 'new',
  contacted          boolean     NOT NULL DEFAULT false,
  ip_address         text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── visitor_sessions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token    text        NOT NULL UNIQUE,
  stage            text        DEFAULT 'visited',
  delivery_address text,
  address_lat      numeric,
  address_lng      numeric,
  nearest_pit_id   uuid        REFERENCES public.pits(id),
  nearest_pit_name text,
  calculated_price numeric,
  serviceable      boolean,
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  order_id         uuid,
  order_number     text,
  visit_count      integer     DEFAULT 1,
  email_1hr_sent   boolean     DEFAULT false,
  email_1hr_sent_at  timestamptz,
  email_24hr_sent  boolean     DEFAULT false,
  email_24hr_sent_at timestamptz,
  email_72hr_sent  boolean     DEFAULT false,
  email_72hr_sent_at timestamptz,
  last_seen_at     timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── global_settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.global_settings (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text        NOT NULL UNIQUE,
  value       text        NOT NULL,
  description text,
  updated_at  timestamptz DEFAULT now()
);

-- ── payment_events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id          text        NOT NULL UNIQUE,
  event_type        text        NOT NULL,
  order_id          uuid        REFERENCES public.orders(id),
  stripe_payment_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── user_roles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_roles (
  id      uuid      NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role  NOT NULL,
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Primary keys and unique constraints create indexes automatically.
-- Additional composite index:
CREATE UNIQUE INDEX IF NOT EXISTS city_pages_city_slug_pit_id_key
  ON public.city_pages USING btree (city_slug, pit_id);

-- Unique indexes (created by constraints above, listed for completeness):
-- pits_pkey                          ON pits (id)
-- city_pages_pkey                    ON city_pages (id)
-- city_pages_city_slug_unique        ON city_pages (city_slug)
-- orders_pkey                        ON orders (id)
-- orders_order_number_key            ON orders (order_number)
-- orders_lookup_token_key            ON orders (lookup_token)
-- delivery_leads_pkey                ON delivery_leads (id)
-- visitor_sessions_pkey              ON visitor_sessions (id)
-- visitor_sessions_session_token_key ON visitor_sessions (session_token)
-- global_settings_pkey               ON global_settings (id)
-- global_settings_key_key            ON global_settings (key)
-- payment_events_pkey                ON payment_events (id)
-- payment_events_event_id_key        ON payment_events (event_id)
-- user_roles_pkey                    ON user_roles (id)
-- user_roles_user_id_role_key        ON user_roles (user_id, role)

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

-- ── pits ──

ALTER TABLE public.pits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_pits ON public.pits;
CREATE POLICY public_read_pits ON public.pits
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS service_manage_pits ON public.pits;
CREATE POLICY service_manage_pits ON public.pits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── city_pages ──

ALTER TABLE public.city_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_active_city_pages ON public.city_pages;
CREATE POLICY public_read_active_city_pages ON public.city_pages
  FOR SELECT TO public USING (status = 'active');

DROP POLICY IF EXISTS service_manage_city_pages ON public.city_pages;
CREATE POLICY service_manage_city_pages ON public.city_pages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── orders ──

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_read_all_orders ON public.orders;
CREATE POLICY admins_read_all_orders ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS customers_insert_orders ON public.orders;
CREATE POLICY customers_insert_orders ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS admins_update_orders ON public.orders;
CREATE POLICY admins_update_orders ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admins_delete_orders ON public.orders;
CREATE POLICY admins_delete_orders ON public.orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── delivery_leads ──

ALTER TABLE public.delivery_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_insert_leads ON public.delivery_leads;
CREATE POLICY anon_insert_leads ON public.delivery_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS admins_read_leads ON public.delivery_leads;
CREATE POLICY admins_read_leads ON public.delivery_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admins_update_leads ON public.delivery_leads;
CREATE POLICY admins_update_leads ON public.delivery_leads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS service_role_select_leads ON public.delivery_leads;
CREATE POLICY service_role_select_leads ON public.delivery_leads
  FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS service_role_update_leads ON public.delivery_leads;
CREATE POLICY service_role_update_leads ON public.delivery_leads
  FOR UPDATE TO service_role USING (true);

-- ── visitor_sessions ──

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_insert_sessions ON public.visitor_sessions;
CREATE POLICY anon_insert_sessions ON public.visitor_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS anon_update_sessions ON public.visitor_sessions;
CREATE POLICY anon_update_sessions ON public.visitor_sessions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_select_sessions ON public.visitor_sessions;
CREATE POLICY anon_select_sessions ON public.visitor_sessions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS service_read_sessions ON public.visitor_sessions;
CREATE POLICY service_read_sessions ON public.visitor_sessions
  FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS service_update_sessions ON public.visitor_sessions;
CREATE POLICY service_update_sessions ON public.visitor_sessions
  FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS admins_read_sessions ON public.visitor_sessions;
CREATE POLICY admins_read_sessions ON public.visitor_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── global_settings ──

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_settings ON public.global_settings;
CREATE POLICY public_read_settings ON public.global_settings
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS service_manage_settings ON public.global_settings;
CREATE POLICY service_manage_settings ON public.global_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── payment_events ──

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_read_payment_events ON public.payment_events;
CREATE POLICY admins_read_payment_events ON public.payment_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS service_role_insert_payment_events ON public.payment_events;
CREATE POLICY service_role_insert_payment_events ON public.payment_events
  FOR INSERT TO service_role WITH CHECK (true);

-- ── user_roles ──

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_read_user_roles ON public.user_roles;
CREATE POLICY admins_read_user_roles ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- ── has_role ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ── create_order ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_order(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_order_number text;
  v_lookup_token uuid;
  v_confirmation_token uuid;
BEGIN
  INSERT INTO public.orders (
    customer_name, customer_email, customer_phone, delivery_address,
    distance_miles, price, quantity, notes, delivery_date, delivery_day_of_week,
    saturday_surcharge, saturday_surcharge_amount, delivery_window,
    same_day_requested, tax_rate, tax_amount, payment_method, payment_status,
    lead_reference
  ) VALUES (
    p_data->>'customer_name',
    NULLIF(p_data->>'customer_email', ''),
    p_data->>'customer_phone',
    p_data->>'delivery_address',
    (p_data->>'distance_miles')::numeric,
    (p_data->>'price')::numeric,
    COALESCE((p_data->>'quantity')::int, 1),
    NULLIF(p_data->>'notes', ''),
    NULLIF(p_data->>'delivery_date', '')::date,
    p_data->>'delivery_day_of_week',
    COALESCE((p_data->>'saturday_surcharge')::boolean, false),
    COALESCE((p_data->>'saturday_surcharge_amount')::int, 0),
    COALESCE(p_data->>'delivery_window', '8:00 AM – 5:00 PM'),
    COALESCE((p_data->>'same_day_requested')::boolean, false),
    COALESCE((p_data->>'tax_rate')::numeric, 0),
    COALESCE((p_data->>'tax_amount')::numeric, 0),
    COALESCE(p_data->>'payment_method', 'COD'),
    COALESCE(p_data->>'payment_status', 'pending'),
    NULLIF(p_data->>'lead_reference', '')
  )
  RETURNING id, order_number, lookup_token, confirmation_token
  INTO v_id, v_order_number, v_lookup_token, v_confirmation_token;

  RETURN jsonb_build_object(
    'id', v_id,
    'order_number', v_order_number,
    'lookup_token', v_lookup_token,
    'confirmation_token', v_confirmation_token
  );
END;
$$;

-- ── increment_city_page_views ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_city_page_views(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE city_pages
  SET page_views = page_views + 1,
      last_viewed_at = now()
  WHERE city_slug = p_slug AND status = 'active';
END;
$$;

-- ── increment_visit_count ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_visit_count(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE visitor_sessions
  SET visit_count = visit_count + 1,
      last_seen_at = now()
  WHERE session_token = p_token;
END;
$$;

-- ── generate_order_number ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.order_number := 'RS-' || to_char(now(), 'YY') || '-' || nextval('public.order_number_seq');
  RETURN NEW;
END;
$$;

-- ── generate_lead_number ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_lead_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_str text;
  state_str text;
  zip_str text;
  next_seq integer;
  new_number text;
BEGIN
  year_str := to_char(NOW(), 'YY');
  state_str := UPPER(COALESCE(
    (regexp_match(NEW.address, ',\s+([A-Z]{2})\s+\d{5}'))[1], 'XX'));
  zip_str := COALESCE(
    (regexp_match(NEW.address, '\b(\d{5})\b'))[1],
    '00000');
  SELECT COUNT(*) + 1 INTO next_seq
  FROM public.delivery_leads
  WHERE lead_number LIKE
    'RS-' || year_str || '-' || state_str || '-' || zip_str || '-%';
  new_number := 'RS-' || year_str || '-' ||
    state_str || '-' || zip_str || '-' ||
    LPAD(next_seq::text, 5, '0');
  NEW.lead_number := new_number;
  RETURN NEW;
END;
$$;

-- ── update_updated_at_column ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── update_settings_updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Orders: auto-generate order_number
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Orders: auto-update updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Delivery Leads: auto-generate lead_number
DROP TRIGGER IF EXISTS set_lead_number ON public.delivery_leads;
CREATE TRIGGER set_lead_number
  BEFORE INSERT ON public.delivery_leads
  FOR EACH ROW EXECUTE FUNCTION public.generate_lead_number();

-- Global Settings: auto-update updated_at
DROP TRIGGER IF EXISTS update_global_settings_updated_at ON public.global_settings;
CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_settings_updated_at();

-- PITs: auto-update updated_at
DROP TRIGGER IF EXISTS update_pits_updated_at ON public.pits;
CREATE TRIGGER update_pits_updated_at
  BEFORE UPDATE ON public.pits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Visitor Sessions: auto-update updated_at
DROP TRIGGER IF EXISTS update_visitor_sessions_updated_at ON public.visitor_sessions;
CREATE TRIGGER update_visitor_sessions_updated_at
  BEFORE UPDATE ON public.visitor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- City Pages: auto-update updated_at
DROP TRIGGER IF EXISTS update_city_pages_updated_at ON public.city_pages;
CREATE TRIGGER update_city_pages_updated_at
  BEFORE UPDATE ON public.city_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. SEED DATA — global_settings
-- ============================================================================

INSERT INTO public.global_settings (key, value, description) VALUES
  ('default_base_price',       '195.00',                                                                                                                  'Default base price per 9-yard load'),
  ('default_extra_per_mile',   '5.00',                                                                                                                    'Default extra cost per mile beyond free radius'),
  ('default_free_miles',       '15',                                                                                                                      'Default free delivery radius in miles'),
  ('default_max_distance',     '30',                                                                                                                      'Default maximum delivery distance in miles'),
  ('phone',                    '1-855-GOT-WAYS',                                                                                                          'Contact phone number'),
  ('saturday_surcharge',       '35.00',                                                                                                                   'Saturday delivery surcharge — global always'),
  ('site_name',                'River Sand',                                                                                                               'Site display name'),
  ('seo_canonical',            'https://riversand.net/',                                                                                                   'Canonical URL'),
  ('seo_canonical_url',        'https://riversand.net/',                                                                                                   'Canonical URL'),
  ('seo_checklist',            '{}',                                                                                                                      'Manual SEO checklist state as JSON'),
  ('seo_ga4_id',               '',                                                                                                                        'Google Analytics 4 Measurement ID'),
  ('seo_ga4_property_id',      '',                                                                                                                        'GA4 property ID'),
  ('seo_gbp_reviews_enabled',  'false',                                                                                                                   'Show Google reviews on landing page'),
  ('seo_gbp_url',              '',                                                                                                                        'Google Business Profile URL'),
  ('seo_gsc_id',               '',                                                                                                                        'Google Search Console verification ID'),
  ('seo_gtm_id',               'GTM-KPKFPCXM',                                                                                                           'GTM container ID'),
  ('seo_h1',                   'Same-Day River Sand Delivery in New Orleans',                                                                              'Homepage H1 tag'),
  ('seo_meta_description',     'Order river sand delivery in New Orleans today. Same-day dispatch, 9 cubic yards, instant online pricing. Local operation — not a national broker. Call 1-855-GOT-WAYS.', 'Homepage meta description'),
  ('seo_meta_title',           'Same-Day River Sand Delivery | New Orleans, LA | River Sand',                                                              'Homepage meta title tag'),
  ('seo_og_description',       'Get your exact delivery price instantly. River sand dispatched same day in Greater New Orleans. Order online in under 2 minutes.', 'Open Graph description'),
  ('seo_og_image',             '',                                                                                                                        'Open Graph image URL'),
  ('seo_og_image_url',         '',                                                                                                                        'OG image URL'),
  ('seo_og_title',             'Same-Day River Sand Delivery — New Orleans, LA',                                                                           'Open Graph title'),
  ('seo_robots',               'index, follow',                                                                                                            'Robots meta tag content'),
  ('seo_schema_faq',           'true',                                                                                                                     'Enable FAQPage schema markup'),
  ('seo_schema_local_business','true',                                                                                                                     'LocalBusiness schema toggle'),
  ('seo_schema_localbusiness', 'true',                                                                                                                     'Enable LocalBusiness schema markup'),
  ('seo_schema_product',       'true',                                                                                                                     'Enable Product schema markup'),
  ('seo_show_google_reviews',  'false',                                                                                                                    'Show Google Reviews'),
  ('seo_sitemap_url',          'https://riversand.net/sitemap.xml',                                                                                        'Sitemap URL')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
