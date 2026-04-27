-- LMT UNIFICATION — BLOCK 1: ADDITIVE SCHEMA EXTENSIONS

-- 1. products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  sub_category text,
  unit text NOT NULL,
  weight_per_unit numeric,
  description text,
  use_cases text[],
  image_urls text[],
  long_description_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products (category);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_anon_select ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY products_admin_write ON public.products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY products_service_manage ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. pit_inventory
CREATE TABLE public.pit_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pit_id uuid NOT NULL REFERENCES public.pits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  price_per_unit numeric NOT NULL,
  wholesale_cost numeric,
  min_quantity numeric NOT NULL DEFAULT 1,
  max_quantity_per_load numeric,
  available boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pit_id, product_id)
);
CREATE INDEX pit_inventory_pit_idx ON public.pit_inventory (pit_id);
CREATE INDEX pit_inventory_product_idx ON public.pit_inventory (product_id);
CREATE INDEX pit_inventory_available_idx ON public.pit_inventory (available) WHERE available = true;
ALTER TABLE public.pit_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY pit_inventory_anon_select ON public.pit_inventory FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pit_inventory_admin_write ON public.pit_inventory FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY pit_inventory_service_manage ON public.pit_inventory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER pit_inventory_set_updated_at BEFORE UPDATE ON public.pit_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. zip_tax_rates extension
ALTER TABLE public.zip_tax_rates
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN county text,
  ADD COLUMN lat numeric,
  ADD COLUMN lng numeric,
  ADD COLUMN population integer,
  ADD COLUMN in_service_pit_ids uuid[];

-- 4. pit_zip_distances
CREATE TABLE public.pit_zip_distances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pit_id uuid NOT NULL REFERENCES public.pits(id) ON DELETE CASCADE,
  zip text NOT NULL,
  driving_miles numeric NOT NULL,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pit_id, zip)
);
CREATE INDEX pit_zip_distances_zip_idx ON public.pit_zip_distances (zip);
CREATE INDEX pit_zip_distances_pit_idx ON public.pit_zip_distances (pit_id);
ALTER TABLE public.pit_zip_distances ENABLE ROW LEVEL SECURITY;
CREATE POLICY pit_zip_distances_anon_select ON public.pit_zip_distances FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pit_zip_distances_admin_write ON public.pit_zip_distances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY pit_zip_distances_service_manage ON public.pit_zip_distances FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. customers_v2
CREATE TABLE public.customers_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  email text,
  name text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  first_storefront text,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  notes text,
  trust_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_v2_email_idx ON public.customers_v2 (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE public.customers_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_v2_service_manage ON public.customers_v2 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER customers_v2_set_updated_at BEFORE UPDATE ON public.customers_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. addresses
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers_v2(id) ON DELETE CASCADE,
  formatted_address text NOT NULL,
  street text,
  city text,
  state text,
  zip text,
  lat numeric,
  lng numeric,
  is_primary boolean NOT NULL DEFAULT false,
  delivery_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_customer_idx ON public.addresses (customer_id);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY addresses_service_manage ON public.addresses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. storefronts
CREATE TABLE public.storefronts (
  id text PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL,
  stripe_account_id text,
  support_email text,
  support_phone text,
  brand_name text,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY storefronts_anon_select ON public.storefronts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY storefronts_admin_write ON public.storefronts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY storefronts_service_manage ON public.storefronts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. app_configurations
CREATE TABLE public.app_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id text NOT NULL REFERENCES public.storefronts(id) ON DELETE RESTRICT,
  pit_ids uuid[] NOT NULL DEFAULT '{}',
  product_ids uuid[],
  pricing_mode text NOT NULL DEFAULT 'baked',
  per_mile_rate numeric NOT NULL,
  free_miles numeric NOT NULL DEFAULT 0,
  saturday_surcharge numeric NOT NULL DEFAULT 0,
  processing_fee_pct numeric NOT NULL DEFAULT 0,
  min_trip_charge numeric,
  branding_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ui_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storefront_id)
);
ALTER TABLE public.app_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_configurations_anon_select ON public.app_configurations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY app_configurations_admin_write ON public.app_configurations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY app_configurations_service_manage ON public.app_configurations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER app_configurations_set_updated_at BEFORE UPDATE ON public.app_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. order_items (strict service_role only)
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  pit_id uuid REFERENCES public.pits(id),
  quantity numeric NOT NULL,
  unit text NOT NULL,
  price_per_unit numeric NOT NULL,
  subtotal numeric NOT NULL,
  weight_total numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);
CREATE INDEX order_items_product_idx ON public.order_items (product_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_service_manage ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- COLUMN ADDITIONS — pits
ALTER TABLE public.pits
  ADD COLUMN min_trip_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN saturday_only boolean NOT NULL DEFAULT false,
  ADD COLUMN vendor_relationship text;

-- COLUMN ADDITIONS — orders
ALTER TABLE public.orders
  ADD COLUMN source_platform text NOT NULL DEFAULT 'RS',
  ADD COLUMN stripe_account_id text,
  ADD COLUMN material_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN fuel_surcharge numeric NOT NULL DEFAULT 0,
  ADD COLUMN trustlevel_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN discounts_total numeric NOT NULL DEFAULT 0;
CREATE INDEX orders_source_platform_idx ON public.orders (source_platform);
CREATE INDEX orders_customer_id_idx ON public.orders (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX orders_pit_id_idx ON public.orders (pit_id) WHERE pit_id IS NOT NULL;

-- COLUMN ADDITIONS — delivery_leads
ALTER TABLE public.delivery_leads
  ADD COLUMN source_platform text NOT NULL DEFAULT 'RS',
  ADD COLUMN requested_product_id uuid REFERENCES public.products(id),
  ADD COLUMN requested_quantity numeric,
  ADD COLUMN quoted_price numeric,
  ADD COLUMN quote_sent_at timestamptz,
  ADD COLUMN quote_accepted boolean,
  ADD COLUMN converted_order_id uuid REFERENCES public.orders(id);
CREATE INDEX delivery_leads_source_platform_idx ON public.delivery_leads (source_platform);