import{v as l}from"./index-Xws7fOVv.js";const _="v1.01";async function y(){try{const{data:r}=await l.from("global_settings").select("value").eq("key","docs_current_version").maybeSingle();return r?.value||_}catch{return _}}function p(){try{return sessionStorage.getItem("leads_pw")||""}catch{return""}}const E=`## 1. Architecture Overview

**Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + Supabase (Lovable Cloud)

**Frontend:** Single-page application (SPA). No server-side rendering.

**Backend:** Supabase (Lovable Cloud)
- PostgreSQL database with Row Level Security (RLS) policies on all tables
- 13+ Edge Functions (Deno runtime) — auto-deploy on GitHub push to main
- Storage bucket: \`assets\` (public read, service role write)
- Auth: email/password for admin only — no customer authentication

**GitHub:** \`bayou0313/sand-nine-rivers\`
**Hosting:** Lovable Cloud
**Supabase Project ID:** \`lclbexhytmpfxzcztzva\`

### External Services

| Service | Purpose | Key Detail |
|---------|---------|------------|
| Stripe | Payments (dual live/test mode) | Account: \`acct_1TH4PcPuKuZka3yZ\`, Payout: JPMorgan Chase \`---5952\` |
| Google Maps Platform | Places Autocomplete, Distance Matrix, Geocoding | Browser key: \`AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI\` (restricted to riversand.net) |
| Resend | Transactional email | From: \`orders@riversand.net\` |
| Anthropic Claude API | City page AI content generation | Used in \`generate-city-page\` edge function |
| GTM / GA4 | Analytics via dataLayer pushes | Container: GTM-KPKFPCXM. Excluded from \`/leads\` and \`/admin\` |
| IndexNow | Bing search index submission | Runs via pg_cron 6am/6pm UTC |

### Key Architectural Decisions

- **All business config in \`global_settings\` table** — no hardcoded values in source. PITs and pages read from DB, not env vars.
- **PIT-level overrides cascade over global defaults** — a NULL value on any PIT pricing field means "inherit from global_settings". Applies to: base_price, free_miles, price_per_extra_mile, max_distance, saturday_surcharge.
- **Distance calculations always use Google Distance Matrix API (driving mode)** — NEVER haversine for billing. \`avoid=ferries\`, \`language=en\` forced. Haversine only as fallback on API failure and pre-filter for top-5 PIT candidates.
- **Visitor sessions tracked from first page view** — enables abandonment email sequences before any checkout is started.
- **Baked pricing mode ACTIVE** — PIT base_price includes 3.5% card processing fee baked in. COD orders receive discount back to \`primary_price\` (pre-bake price). See Section 8.
- **No customer authentication** — admin only via Supabase Auth + \`user_roles\` table. \`/leads\` uses separate LEADS_PASSWORD secret.
- **Northshore deliveries: +3 phantom miles** — St. Tammany Parish orders have 3 miles added to billed distance for Causeway toll cost recovery.
`,f="## 2. Routing & Pages\n\n| Route | Component | Purpose |\n|-------|-----------|---------|\n| `/` | Index.tsx / HomeMobile.tsx | Landing page (mobile/desktop split via useIsMobile) |\n| `/order` | Order.tsx / OrderMobile.tsx | Checkout wizard with day-aware PIT routing |\n| `/order?reschedule=true&token=` | Order.tsx | Reschedule mode for existing orders |\n| `/leads` | Leads.tsx | LMT admin dashboard (password: LEADS_PASSWORD) |\n| `/admin` | Admin.tsx | Authenticated admin (Supabase Auth, has_role('admin')) |\n| `/admin/login` | AdminLogin.tsx | Admin sign-in |\n| `/review/:token` | Review.tsx | Customer review collection (24hr post-delivery) |\n| `/:citySlug` | CityPage.tsx | Programmatic SEO city pages (37 active cities) |\n| `/*` | NotFound.tsx | 404 |\n\n**Mobile detection:** 3-signal approach (viewport <768px, touch <1024px, UA string) with `?force_desktop=1` override.\n",h=`## 3. Database Schema (18 tables)

### Table: \`blocked_ips\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| ip_address | text | NO | — |
| reason | text | YES | — |
| blocked_by | text | YES | — |
| blocked_at | timestamptz | YES | now() |

### Table: \`city_pages\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| city_name | text | NO | — |
| city_slug | text | NO | — |
| state | text | NO | 'LA' |
| pit_id | uuid | YES | — |
| zip_codes | text[] | YES | — |
| lat | numeric | YES | — |
| lng | numeric | YES | — |
| distance_from_pit | numeric | YES | — |
| status | text | YES | 'draft' |
| status_reason | text | YES | — |
| base_price | numeric | YES | — |
| meta_title | text | YES | — |
| meta_description | text | YES | — |
| h1_text | text | YES | — |
| content | text | YES | — |
| hero_intro | text | YES | — |
| local_expertise | text | YES | — |
| local_uses | text | YES | — |
| delivery_details | text | YES | — |
| why_choose_intro | text | YES | — |
| local_address | text | YES | — |
| local_city | text | YES | — |
| local_zip | text | YES | — |
| faq_items | jsonb | YES | — |
| competing_pit_ids | uuid[] | YES | — |
| multi_pit_coverage | bool | YES | false |
| needs_regen | bool | YES | false |
| regen_reason | text | YES | — |
| price_changed | bool | YES | false |
| pit_reassigned | bool | YES | false |
| prompt_version | text | YES | — |
| region | text | YES | — |
| page_views | int | YES | 0 |
| last_viewed_at | timestamptz | YES | — |
| content_generated_at | timestamptz | YES | — |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

### Table: \`customers\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| email | text | NO | — |
| name | text | YES | — |
| phone | text | YES | — |
| company | text | YES | — |
| first_order_date | date | YES | — |
| last_order_date | date | YES | — |
| total_orders | int | YES | 0 |
| total_spent | numeric | YES | 0 |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

### Table: \`delivery_leads\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| created_at | timestamptz | NO | now() |
| address | text | NO | — |
| customer_name | text | NO | — |
| customer_email | text | YES | — |
| customer_phone | text | YES | — |
| distance_miles | numeric | YES | — |
| nearest_pit_id | uuid | YES | — |
| nearest_pit_name | text | YES | — |
| nearest_pit_distance | numeric | YES | — |
| calculated_price | numeric | YES | — |
| ip_address | text | YES | — |
| user_agent | text | YES | — |
| browser_geolat | numeric | YES | — |
| browser_geolng | numeric | YES | — |
| geo_matches_address | bool | YES | — |
| fraud_score | int | YES | 0 |
| fraud_signals | jsonb | YES | — |
| submission_count | int | YES | 1 |
| pre_order_id | uuid | YES | — |
| offer_sent_at | timestamptz | YES | — |
| declined_at | timestamptz | YES | — |
| stage | text | YES | 'new' |
| contacted | bool | NO | false |
| lead_number | text | YES | — |
| notes | text | YES | — |

### Table: \`fraud_blocklist\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| type | text | NO | — |
| value | text | NO | — |
| reason | text | YES | — |
| blocked_by | text | YES | 'admin' |
| created_at | timestamptz | YES | now() |
| expires_at | timestamptz | YES | — |

### Table: \`fraud_events\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| event_type | text | NO | — |
| ip_address | text | YES | — |
| email | text | YES | — |
| phone | text | YES | — |
| order_id | uuid | YES | — |
| session_id | uuid | YES | — |
| details | jsonb | YES | — |
| created_at | timestamptz | YES | now() |

### Table: \`global_settings\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| key | text | NO | — |
| value | text | NO | — |
| description | text | YES | — |
| is_public | bool | NO | false |
| updated_at | timestamptz | YES | now() |

### Table: \`notifications\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| type | text | NO | — |
| title | text | NO | — |
| message | text | NO | — |
| entity_type | text | YES | — |
| entity_id | text | YES | — |
| read | bool | NO | false |
| created_at | timestamptz | YES | now() |

### Table: \`orders\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| order_number | text | YES | — |
| customer_id | uuid | YES | — |
| customer_name | text | NO | — |
| customer_email | text | YES | — |
| customer_phone | text | NO | — |
| company_name | text | YES | — |
| customer_tier | int | NO | 1 |
| delivery_address | text | NO | — |
| delivery_date | date | YES | — |
| delivery_day_of_week | text | YES | — |
| delivery_window | text | NO | '8:00 AM – 5:00 PM' |
| same_day_requested | bool | NO | false |
| pit_id | uuid | YES | — |
| distance_miles | numeric | NO | — |
| billed_distance_miles | numeric | YES | — |
| is_northshore | bool | YES | false |
| quantity | int | NO | 1 |
| base_unit_price | numeric | YES | — |
| distance_fee | numeric | YES | — |
| processing_fee | numeric | YES | — |
| price | numeric | NO | — |
| discount_amount | numeric | YES | 0 |
| tax_rate | numeric | NO | 0 |
| tax_amount | numeric | NO | 0 |
| state_tax_rate | numeric | YES | — |
| state_tax_amount | numeric | YES | — |
| parish_tax_rate | numeric | YES | — |
| parish_tax_amount | numeric | YES | — |
| saturday_surcharge | bool | NO | false |
| saturday_surcharge_amount | int | NO | 0 |
| sunday_surcharge | bool | NO | false |
| sunday_surcharge_amount | int | NO | 0 |
| payment_method | text | NO | 'COD' |
| payment_status | text | NO | 'pending' |
| payment_attempts | int | YES | 0 |
| stripe_payment_id | text | YES | — |
| stripe_customer_id | text | YES | — |
| card_brand | text | YES | — |
| card_last4 | text | YES | — |
| card_authorization_accepted | bool | YES | false |
| card_authorization_timestamp | timestamptz | YES | — |
| capture_status | text | YES | — |
| capture_attempted_at | timestamptz | YES | — |
| cash_collected | bool | YES | false |
| cash_collected_at | timestamptz | YES | — |
| cash_collected_by | text | YES | — |
| billing_name | text | YES | — |
| billing_address | text | YES | — |
| billing_zip | text | YES | — |
| billing_country | text | YES | — |
| billing_matches_delivery | bool | YES | — |
| delivery_terms_accepted | bool | YES | false |
| delivery_terms_timestamp | timestamptz | YES | — |
| call_verified_at | timestamptz | YES | — |
| call_verified_by | text | YES | — |
| fraud_score | int | YES | 0 |
| fraud_signals | jsonb | YES | — |
| fraud_window_cleared_at | timestamptz | YES | — |
| review_status | text | YES | — |
| review_request_sent | bool | YES | false |
| review_request_sent_at | timestamptz | YES | — |
| confirmation_token | uuid | NO | gen_random_uuid() |
| lookup_token | uuid | YES | gen_random_uuid() |
| lookup_token_used | bool | NO | false |
| reschedule_token | uuid | YES | — |
| reschedule_token_used | bool | YES | false |
| last_confirmation_sent_at | timestamptz | YES | — |
| lead_reference | text | YES | — |
| status | text | NO | 'pending' |
| cancelled_at | timestamptz | YES | — |
| notes | text | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### Table: \`payment_attempts\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| ip_address | text | YES | — |
| session_id | uuid | YES | — |
| email | text | YES | — |
| phone | text | YES | — |
| amount | numeric | YES | — |
| status | text | YES | — |
| created_at | timestamptz | YES | now() |

### Table: \`payment_events\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| order_id | uuid | YES | — |
| event_id | text | NO | — |
| event_type | text | NO | — |
| stripe_payment_id | text | YES | — |
| created_at | timestamptz | NO | now() |

### Table: \`pits\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| address | text | NO | — |
| lat | numeric | NO | — |
| lon | numeric | NO | — |
| status | text | NO | 'active' |
| is_default | bool | NO | false |
| is_pickup_only | bool | NO | false |
| base_price | numeric | YES | — |
| free_miles | numeric | YES | — |
| price_per_extra_mile | numeric | YES | — |
| max_distance | numeric | YES | — |
| operating_days | int[] | YES | — |
| same_day_cutoff | text | YES | — |
| saturday_load_limit | int | YES | — |
| saturday_surcharge_override | numeric | YES | — |
| sunday_load_limit | int | YES | — |
| sunday_surcharge | numeric | YES | — |
| served_cities | jsonb | YES | — |
| notes | text | YES | '' |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### Table: \`reviews\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| order_id | uuid | YES | — |
| order_number | text | YES | — |
| customer_name | text | YES | — |
| customer_email | text | YES | — |
| rating | int | YES | — |
| feedback | text | YES | — |
| sent_to_gmb | bool | YES | false |
| review_request_sent_at | timestamptz | YES | — |
| review_submitted_at | timestamptz | YES | — |
| created_at | timestamptz | YES | now() |

### Table: \`tax_rates\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| state_code | text | NO | — |
| state_name | text | NO | — |
| county_parish | text | NO | — |
| jurisdiction_type | text | NO | 'parish' |
| state_rate | numeric | NO | — |
| local_rate | numeric | NO | — |
| combined_rate | numeric | NO | — |
| effective_date | date | NO | — |
| updated_at | timestamptz | YES | now() |

### Table: \`user_roles\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| role | app_role enum | NO | — |

### Table: \`visitor_sessions\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| session_token | text | NO | — |
| ip_address | text | YES | — |
| ip_org | text | YES | — |
| ip_city | text | YES | — |
| ip_zip | text | YES | — |
| ip_is_business | bool | YES | false |
| geo_city | text | YES | — |
| geo_region | text | YES | — |
| geo_country | text | YES | — |
| geo_zip | text | YES | — |
| entry_page | text | YES | — |
| entry_city_page | text | YES | — |
| entry_city_name | text | YES | — |
| referrer | text | YES | — |
| delivery_address | text | YES | — |
| address_lat | numeric | YES | — |
| address_lng | numeric | YES | — |
| nearest_pit_id | uuid | YES | — |
| nearest_pit_name | text | YES | — |
| calculated_price | numeric | YES | — |
| serviceable | bool | YES | — |
| customer_name | text | YES | — |
| customer_email | text | YES | — |
| customer_phone | text | YES | — |
| stage | text | YES | 'visited' |
| visit_count | int | YES | 1 |
| order_id | uuid | YES | — |
| order_number | text | YES | — |
| stripe_link_clicked | bool | YES | false |
| stripe_link_clicked_at | timestamptz | YES | — |
| email_1hr_sent | bool | YES | false |
| email_24hr_sent | bool | YES | false |
| email_48hr_sent | bool | YES | false |
| email_72hr_sent | bool | YES | false |
| email_1hr_sent_at | timestamptz | YES | — |
| email_24hr_sent_at | timestamptz | YES | — |
| email_48hr_sent_at | timestamptz | YES | — |
| email_72hr_sent_at | timestamptz | YES | — |
| last_seen_at | timestamptz | YES | now() |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

### Table: \`waitlist_leads\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| city_name | text | NO | — |
| city_slug | text | NO | — |
| customer_name | text | YES | — |
| customer_email | text | NO | — |
| customer_phone | text | YES | — |
| converted | bool | YES | false |
| notified_at | timestamptz | YES | — |
| created_at | timestamptz | YES | now() |

### Table: \`zip_tax_rates\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| zip_code | text | NO | — |
| tax_region_name | text | NO | — |
| state_code | text | NO | 'LA' |
| state_rate | numeric | NO | 0.05 |
| local_rate | numeric | NO | 0 |
| combined_rate | numeric | NO | — |
| created_at | timestamptz | YES | now() |
`,x="## 7. Edge Functions Inventory\n\n| Function | Purpose | verify_jwt |\n|----------|---------|------------|\n| `leads-auth` | Admin authentication, lead CRUD, fraud checks, order cancellation | false |\n| `stripe-webhook` | Payment intent lifecycle, card capture, order resolution | false |\n| `create-payment-intent` | Auth-hold or immediate-capture based on customer_tier | false |\n| `create-checkout-link` | Stripe Checkout Session for abandonment recovery | false |\n| `capture-payments` | Manual capture for Tier-1 orders post-delivery | false |\n| `create-refund` | Stripe refund + order status update | false |\n| `generate-invoice` | PDF invoice (monochrome layout, separated taxes) | false |\n| `send-email` | Resend transactional dispatcher (branded templates) | false |\n| `email-inbound` | Resend webhook → forward to dispatch (loop prevention) | false |\n| `abandonment-emails` | Hourly pg_cron (1h/24h/48h/72h sequences with discounts) | false |\n| `generate-city-page` | Claude 4.5 Haiku content generation (Lander v4) | false |\n| `generate-sitemap` | Live sitemap.xml from city_pages | false |\n| `submit-sitemap` | Daily IndexNow + GSC ping | false |\n| `get-maps-key` | Returns scoped GOOGLE_MAPS_BROWSER_KEY | false |\n| `get-order-status` | Public order lookup by token | false |\n| `generate-docs` | (DEPRECATED — replaced by client-side generator) | false |\n",v=`## 8. Pricing Engine

**Formula (per pit):**
\`\`\`ts
const distanceFee = Math.max(0, (miles - free_miles) * price_per_extra_mile);
const subtotal = base_price + distanceFee;
const total = Math.max(base_price, subtotal);
\`\`\`

**Northshore toll recovery:** ZIPs in St. Tammany Parish add +3 phantom miles before formula.

**Surcharges:**
- Saturday: \`saturday_surcharge_override\` per pit (default $50, weekend card-only)
- Sunday: \`sunday_surcharge\` per pit (default $75, weekend card-only)

**Pricing modes (global_settings.pricing_mode):**
- \`baked\` (default): card and COD pay identical totals; processing fee absorbed via \`(base + distance) * 1.035\`
- \`transparent\`: explicit 3.5% + $0.30 processing fee disclosed on card payments

**Tax priority chain (create_order RPC):**
1. \`zip_tax_rates\` lookup by zip_code
2. \`tax_rates\` lookup by parish (LA only)
3. Client-sent rate (last resort)

**Discounts:** \`?discount=N\` URL parameter (loyalty/abandonment); never produces negative totals.
`,w=`## 9. Order Flow

1. **Address** — Google Places Autocomplete (US-only, type=address)
2. **Mismatch check** — AddressMismatchDialog if user input drifts from geocoded locality
3. **Distance** — Distance Matrix from address string to all active pits → closest wins
4. **Quantity** — 1–10 loads with real-time cubic yard calc
5. **Date** — DeliveryDatePicker (60-day window, per-date pit assignment, weekend surcharges)
6. **Contact** — Name/phone/email with red-border validation on \`formAttempted\`
7. **Payment selection** — PAY NOW (Stripe) vs PAY AT DELIVERY (cash/check, weekday only)
8. **Authorization** — 10-point delivery agreement + card auth checkbox
9. **Submission** — \`create_order\` RPC (atomic order + customer upsert + tax calc)
10. **Confirmation** — OrderConfirmation.tsx (authoritative summary, lookup token URL)

**Mobile flow:** OrderMobile.tsx consolidates all steps into a single state-based component tree with popstate back-navigation handling.
`,Y=`## 10. Session & Abandonment

**visitor_sessions** captures every visit with IP enrichment (ipapi.co), B2B detection regex, geo data, entry page/city, and serviceability flag.

**Abandonment sequence (hourly pg_cron \`0 * * * *\`):**
- 1hr: gentle nudge ("Still need that sand?")
- 24hr: $10 discount offer
- 48hr: $20 discount + Stripe Checkout link
- 72hr: final $25 + sales human follow-up

Discounts enforced server-side via Stripe Checkout Session metadata (never client-side params).

**Stage progression:** \`visited\` → \`address_entered\` → \`payment_selected\` → \`order_placed\` (or \`abandoned\` after 1hr without progression).
`,N=`## 12. Admin Dashboard (/leads)

**Authentication:** sessionStorage-persisted password (LEADS_PASSWORD secret, key: \`leads_pw\`).

**Tabs:**
1. **Overview** — Operations Center: 6-section real-time dashboard with Hot Prospects logic
2. **Orders** — 15-section management hub for Stripe/COD/Check (lifecycle, invoicing, refunds, cancellation)
3. **Leads** — Out-of-area capture, fraud signals, conversion attempts
4. **Customers** — Lifecycle metrics, total spend, resend confirmations
5. **Schedule** — 90-day horizontal nav (7 past + 83 future), color-coded by status
6. **Pits** — Geolocation-guarded CRUD, pickup-only flag, mandatory pricing
7. **City Pages** — Generation queue monitoring (30s auto-poll)
8. **Finances** — P&L, tax breakdown, ZIP intelligence
9. **Live Visitors** — Real-time funnel analysis (30-day retention)
10. **Settings** — Brand profile, email config, tax rates, site_mode toggle

**Real-time alerts:** Supabase Realtime on \`notifications\` table (leads/payments/fraud, 7-day purge).
`,O=`## 15. Design System & Brand

**Typography:**
- \`font-display\` (Bebas Neue): all-caps section titles
- \`font-sans\` (Inter): body, subheadings, all standard text
- **Never:** DM Sans (explicitly rejected)

**Color contrast:** Strict rule — text color never matches its background. CTAs use ghost button variants on varying backgrounds.

**Brand palettes (5 CMO-approved):**
1. WAYS Core (Navy #0D2137 / Gold #C07A00) — default
2. Mississippi Mud (Earthy Browns)
3. Bayou Green
4. Delta Sunset
5. Levee Stone

City pages get deterministic palette assignment via slug hash.

**Admin dashboard tokens:** \`T.*\` (cardBg, cardBorder, textPrimary, textSecond, etc.) — never raw hex in components except brand constants.

**Motion:** framer-motion fade/slide for section entries, wizard step shifts, hover scaling.

**PDF invoices:** Monochrome professional layout with absolute-positioned status indicators (PAID IN FULL, etc.) and combined distance/fees/separated-taxes breakdown.
`,T="## 16. Utility Libraries\n\n| File | Purpose |\n|------|---------|\n| `src/lib/pits.ts` | **PROTECTED** — core pricing engine, findAllPitDistances |\n| `src/lib/google-maps.ts` | **PROTECTED** — Maps API loader |\n| `src/hooks/useGoogleMaps.ts` | **PROTECTED** — autocomplete hook |\n| `src/lib/cart.ts` | localStorage cart persistence (24hr TTL) |\n| `src/lib/format.ts` | Currency, distance, date formatters |\n| `src/lib/textFormat.ts` | formatProperName + corporate designator standardization |\n| `src/lib/session.ts` | visitor_sessions wrapper |\n| `src/lib/analytics.ts` | GTM dataLayer push with No-Track guard |\n| `src/lib/palettes.ts` | 5 brand palettes + slug-hash assignment |\n| `src/hooks/useBusinessSettings.ts` | global_settings cache (module-level) |\n| `src/hooks/useBrandPalette.ts` | Per-page palette selection |\n| `src/hooks/use-countdown.ts` | Same-day cutoff timer |\n",D=`## 17. Secrets & Environment

**Supabase Vault secrets (server-side only):**
- ANTHROPIC_API_KEY — Claude API for city page generation
- STRIPE_SECRET_KEY / STRIPE_TEST_SECRET_KEY — payment processing
- STRIPE_WEBHOOK_SECRET / STRIPE_TEST_WEBHOOK_SECRET — webhook signature validation
- RESEND_API_KEY — transactional email
- RESEND_WEBHOOK_SECRET — inbound email validation
- LEADS_PASSWORD — admin dashboard auth
- GOOGLE_MAPS_SERVER_KEY — distance matrix from edge functions
- GOOGLE_MAPS_BROWSER_KEY — scoped to riversand.net for places autocomplete
- LOVABLE_API_KEY — Lovable AI Gateway
- GMAIL_USER / GMAIL_APP_PASSWORD — fallback notification channel

**Public env (committed to .env, safe in browser):**
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY (anon key)
- VITE_SUPABASE_PROJECT_ID
- VITE_GOOGLE_MAPS_KEY (scoped browser key — exception to no-hardcoded policy)
`,C=`## 20. Known Issues & Pending Work

**In progress:**
- Day-aware PIT routing for weekdays (fix weekday onSelect handler)
- Dynamic pricing by booking percentage
- Google Flights-style price calendar on date picker

**Planned:**
- Saturday pickup feature (/pickup page)
- is_pickup_only PIT flag (DB column exists, UI wiring pending)
- Pickup order management in admin
- Homepage pickup section

**Architecture (do before scaling):**
- tenant_id + operation_id columns on all tables
- Move public keys (Maps browser, Stripe publishable, GTM ID) to global_settings
- Tenant setup checklist documentation

**Future (Phase 2):**
- QR code order verification system
- Yard operator scanning workflow
- 7-day pickup / Littlewoods location
- ways.us master brand integration
- Multi-tenant replication system
`,k=`## 21. SEO Issues & Crawl Fixes

- **Trailing slash policy:** strict no-trailing-slash, enforced via canonical tags + Vercel rewrites
- **Sitemap:** real-time generation via \`generate-sitemap\` edge function with daily IndexNow submission
- **Legacy redirects:** \`/<city>-la/river-sand-delivery\` → \`/<city>\` (static HTML + React)
- **Hybrid prerender:** \`scripts/prerender-cities.mjs\` generates static HTML shells with full SEO meta for GitHub Pages
- **WebSite JSON-LD:** SearchAction maps to /order parameters
- **Region classification:** city_pages.region auto-populated with Parish from Google Geocoding
- **Priority market:** New Orleans is #1 SEO target (specific geocoding override)
- **City voice v4:** AI prompt requires exact local references (street, ZIP, Parish), real pricing, no generic filler

**Common crawl issues addressed:**
- 301 chains eliminated
- Duplicate H1s removed
- Single canonical per page
- alt text on all hero images
- Lazy loading on below-fold imagery
- Mobile-friendly viewport on all pages
`,P=`## 22. DriveDigits Roadmap & WAYS Architecture

### Phase Plan

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | **CURRENT** | riversand.net polish + Merchant Center setup + UI cleanup |
| Phase 2 | Planned | DriveDigits MVP — driver PWA, job acceptance, Stripe hold-to-capture |
| Phase 3 | Blocked by Phase 2 | Integrate DriveDigits with riversand.net — driver acceptance triggers Stripe capture |

### DriveDigits Feature Scope (Phase 2)

Sequential and parallel dispatch · Cancel/swap/resequence controls · Twilio SMS + WhatsApp + Email · Driver pay $30 flat <20mi then per-mile · Stripe hold → capture on acceptance · 5+ driver drag-drop board · PWA · Settlement · Onboarding

### WAYS Product Catalog

River sand · mason sand · concrete sand · fill sand · fill dirt · batture dirt · spillway dirt · topsoil · garden soil · landscaping mulch · crushed concrete · pea gravel · limestone (all sizes) · asphalt millings · road gravel · driveway gravel · washed gravel

**Minimum order:** 2 yards or 3 tons.
`,A=`## 23. /leads UI Design System

**Mandatory brand constants** — every tab MUST import these:

\`\`\`ts
const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const POSITIVE   = "#059669";
const ALERT_RED  = "#DC2626";
const WARN_YELLOW= "#D97706";

const T = {
  cardBg:      "#FFFFFF",
  cardBorder:  "#E5E7EB",
  textPrimary: "#111827",
  textSecond:  "#6B7280",
  pageBg:      "#F9FAFB",
};

const STATUS_COLORS: Record<string,{bg:string;text:string}> = {
  pending:   { bg: '#F3F4F6', text: '#6B7280' },
  confirmed: { bg: '#EFF6FF', text: '#3B82F6' },
  cancelled: { bg: '#FEF2F2', text: '#EF4444' },
  paid:      { bg: '#ECFDF5', text: '#059669' },
  captured:  { bg: '#ECFDF5', text: '#059669' },
  en_route:  { bg: '#EFF6FF', text: '#3B82F6' },
  delivered: { bg: '#ECFDF5', text: '#059669' },
  cod:       { bg: '#FDF8F0', text: '#C07A00' },
  active:    { bg: '#ECFDF5', text: '#059669' },
  inactive:  { bg: '#F3F4F6', text: '#6B7280' },
  draft:     { bg: '#F3F4F6', text: '#6B7280' },
  new:       { bg: '#F3F4F6', text: '#0D2137' },
  called:    { bg: '#EFF6FF', text: '#1A6BB8' },
  quoted:    { bg: '#FDF8F0', text: '#F59E0B' },
  won:       { bg: '#ECFDF5', text: '#22C55E' },
  lost:      { bg: '#F3F4F6', text: '#999999' },
};
\`\`\`

### 23.1 Page shell

\`\`\`tsx
<div className="min-h-screen" style={{ backgroundColor: T.pageBg }}>
  <header className="border-b" style={{ backgroundColor: BRAND_NAVY, borderColor: BRAND_NAVY }}>
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <h1 className="text-white font-display text-2xl tracking-wide">RIVERSAND LMT</h1>
      <button onClick={logout} className="text-white/80 hover:text-white text-sm">Sign out</button>
    </div>
  </header>
  <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
</div>
\`\`\`

### 23.2 Tab navigation

\`\`\`tsx
<nav className="flex gap-6 border-b mb-6" style={{ borderColor: T.cardBorder }}>
  {tabs.map(t => (
    <button
      key={t.id}
      onClick={() => setTab(t.id)}
      className="pb-3 text-sm font-medium transition-colors"
      style={{
        color: tab === t.id ? BRAND_GOLD : T.textSecond,
        borderBottom: tab === t.id ? \`2px solid \${BRAND_GOLD}\` : "2px solid transparent",
      }}
    >{t.label}</button>
  ))}
</nav>
\`\`\`

### 23.3 Card container

\`\`\`tsx
<div
  className="rounded-xl border shadow-sm p-6 mb-6"
  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}
>
  <h3 className="font-display uppercase tracking-wide text-sm mb-4" style={{ color: T.textPrimary }}>
    Section title
  </h3>
  {/* content */}
</div>
\`\`\`

### 23.4 Metric cards (4-up)

\`\`\`tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  {metrics.map(m => (
    <div key={m.label} className="rounded-xl border p-5"
      style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
      <div style={LABEL_STYLE}>{m.label}</div>
      <div style={{ ...NUM_STYLE, color: m.color || T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {loading ? '—' : m.value}
      </div>
      {m.sub && <div style={SUB_STYLE}>{m.sub}</div>}
    </div>
  ))}
</div>
\`\`\`

### 23.5 Status pill

\`\`\`tsx
function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >{status}</span>
  );
}
\`\`\`

### 23.6 Order number (always BRAND_GOLD + tabular)

\`\`\`tsx
<span style={{ color: BRAND_GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
  #{order.order_number}
</span>
\`\`\`
`,L=`### 23.7 Loading states

\`\`\`tsx
import { Loader2 } from "lucide-react";

// Full-tab loader
if (loading) return (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
    <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
  </div>
);

// Card skeleton (3 placeholder cards)
{loading && Array.from({ length: 3 }).map((_, i) => (
  <div key={i} className="rounded-xl border p-5 animate-pulse"
    style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
    <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
    <div className="h-7 w-16 bg-gray-200 rounded" />
  </div>
))}
\`\`\`

**Rules:**
- Always Loader2 from lucide-react with animate-spin (BRAND_GOLD).
- Never show 0-count stats while loading — show \`—\`.
- Disable all inputs + show spinner in submit button during save operations.

### 23.8 Empty states

\`\`\`tsx
{!loading && rows.length === 0 && (
  <div className="rounded-xl border p-12 text-center"
    style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
    <div className="text-4xl mb-2">📭</div>
    <p className="font-medium" style={{ color: T.textPrimary }}>No records yet</p>
    <p className="text-xs mt-1" style={{ color: T.textSecond }}>
      They'll appear here as soon as they come in.
    </p>
  </div>
)}
\`\`\`

### 23.9 Search / filter bar (sticky)

\`\`\`tsx
<div className="sticky top-0 z-10 -mx-6 px-6 py-3 mb-4 border-b"
  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
  <div className="flex items-center gap-3">
    <Search size={16} style={{ color: T.textSecond }} />
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Search…"
      className="flex-1 outline-none text-sm"
      style={{ color: T.textPrimary }}
    />
    {query && (
      <button onClick={() => setQuery("")}>
        <X size={14} style={{ color: T.textSecond }} />
      </button>
    )}
  </div>
</div>
\`\`\`

### 23.10 Buttons

\`\`\`tsx
// Primary (BRAND_GOLD)
<button
  className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50"
  style={{ backgroundColor: BRAND_GOLD }}
>{loading ? <Loader2 className="animate-spin" size={14}/> : "Save"}</button>

// Secondary (outline)
<button
  className="px-4 py-2 rounded-lg text-sm font-medium"
  style={{ border: \`1px solid \${T.cardBorder}\`, color: T.textPrimary, backgroundColor: T.cardBg }}
>Cancel</button>

// Destructive
<button
  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
  style={{ backgroundColor: ALERT_RED }}
>Delete</button>
\`\`\`

### 23.11 Tables

\`\`\`tsx
<div className="overflow-x-auto rounded-xl border"
  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
  <table className="min-w-full text-sm">
    <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
      <tr>
        {cols.map(c => (
          <th key={c} className="px-4 py-3 text-left font-medium"
            style={{ color: T.textSecond, ...LABEL_STYLE }}>{c}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(r => (
        <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors"
          style={{ borderColor: T.cardBorder }}>
          {/* cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
\`\`\`

### 23.12 Modals

\`\`\`tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl p-6">
    <DialogHeader>
      <DialogTitle className="font-display uppercase tracking-wide">
        Modal Title
      </DialogTitle>
    </DialogHeader>
    {/* content */}
    <DialogFooter className="mt-6 flex justify-end gap-2">
      <button>Cancel</button>
      <button>Save</button>
    </DialogFooter>
  </DialogContent>
</Dialog>
\`\`\`

### 23.13 Responsive breakpoints
- Mobile-first; use \`md:\` (≥768px) for 2-up grids and \`lg:\` (≥1024px) for 4-up.
- Sticky elements collapse on mobile; horizontal scroll for tables.

### 23.14 Toasts
\`\`\`ts
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
toast({ title: "Saved", description: "Settings updated." });
toast({ title: "Error", description: err.message, variant: "destructive" });
\`\`\`
Position: top-right (sonner default). Never block UI.

### 23.15 Form validation
- Red border on invalid + helper text below.
- Trigger validation only after first submit attempt (\`formAttempted\` pattern).
- Disable submit while saving; show spinner inline.

### 23.16 Action menus
\`\`\`tsx
<DropdownMenu>
  <DropdownMenuTrigger><MoreVertical size={16}/></DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={resend}>Resend confirmation</DropdownMenuItem>
    <DropdownMenuItem onClick={cancel} className="text-red-600">Cancel order</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
\`\`\`
`,I=`## 24. Data Flow Diagrams

### Customer Order Flow

\`\`\`
Homepage → Enter Address → [Google Places API]
     ↓
DeliveryEstimator → [leads-auth: calculate_distances] → [Google Distance Matrix API]
     ↓
findBestPitDriving() → Best PIT + Price
  ↓ (out of area)              ↓ (in area)
OutOfAreaModal              /order page
delivery_lead row           (URL params: address, distance, price, pit_id, etc.)
                                    ↓
              Step 1: Address confirm + customer info
                                    ↓
              Step 2: Delivery date + quantity + payment method
                                    ↓
              Step 3: Review & Submit
                                    ↓
┌─── Stripe ──────────────────────────────────┐  ┌─── COD ──────────────────────────────┐
│ create_order RPC → DB                       │  │ create_order RPC → DB                │
│ create-checkout-link → Stripe Checkout      │  │ send-email → customer + dispatch     │
│ stripe-webhook → paid → confirmation email  │  │ → OrderConfirmation ($ animation)    │
└─────────────────────────────────────────────┘  └──────────────────────────────────────┘
\`\`\`

### Session & Abandonment Flow

\`\`\`
Page Load → initSession() → leads-auth: session_init → checkFraudInternal()
     ↓ (progressive updateSession calls)
visited → entered_address → got_price → started_checkout → reached_payment → completed_order
                                      ↘ got_out_of_area → delivery_lead created

     ↓ (if abandoned — pg_cron hourly)

COLD: 1hr → 24hr → 48hr → 108hr ($10 off Stripe link)
HOT:  (stripe_link_clicked) → 24hr ($10 off + countdown timer)
STOP: once session.order_id is populated
\`\`\`

### Admin Access Flow

\`\`\`
/leads  → leads-auth: authenticate → LEADS_PASSWORD validation
       → All /leads operations → leads-auth [action] → service_role → DB

/admin  → Supabase Auth (email/password) → user_roles table → RLS enforcement
\`\`\`
`;function d(r){return String(r??"").replace(/\|/g,"\\|").replace(/\n/g," ")}function u(r,a){const i=a instanceof Error?a.message:String(a);return`
> ⚠️ **${r} fetch failed:** ${i}
`}async function R(){const r=p();if(r)try{const{data:a,error:i}=await l.functions.invoke("leads-auth",{body:{password:r,action:"list_settings"}});if(i)throw i;if(a&&a.ok===!1)throw new Error(a.error||"list_settings failed");const t=a?.settings??[];if(t.length===0)return`## 4. Global Settings (Live)

*(no settings found)*
`;const e=`## 4. Global Settings (Live — full, via service role)

**Total keys:** ${t.length}

| Key | Value | Public | Description |
|-----|-------|--------|-------------|
`,o=t.map(s=>`| ${d(s.key)} | ${d(s.value)} | ${s.is_public?"✓":""} | ${d(s.description??"")} |`).join(`
`);return e+o+`
`}catch(a){console.warn("[docs] list_settings via leads-auth failed, falling back to anon:",a)}try{const{data:a,error:i}=await l.from("global_settings").select("key, value, description, is_public").order("key",{ascending:!0}).limit(1e4);if(i)throw i;const t=a??[],e=r?`> ⚠️ Service-role fetch failed; showing only public rows.

`:"> ℹ️ Showing only `is_public = true` rows. Sign in to /leads (sets `sessionStorage.leads_pw`) to see all keys.\n\n";if(t.length===0)return`## 4. Global Settings (Live)

${e}*(no public settings)*
`;const o=`## 4. Global Settings (Live — public-only)

${e}**Total keys:** ${t.length}

| Key | Value | Description |
|-----|-------|-------------|
`,s=t.map(n=>`| ${d(n.key)} | ${d(n.value)} | ${d(n.description??"")} |`).join(`
`);return o+s+`
`}catch(a){return`## 4. Global Settings (Live)
${u("global_settings",a)}`}}async function F(){try{const{data:r,error:a}=await l.from("pits").select("*").order("name",{ascending:!0}).limit(1e4);if(a)throw a;const i=r??[];if(i.length===0)return`## 5. Active PITs (Live)

*(no pits found)*
`;let t=`## 5. Active PITs (Live)

**Total PITs:** ${i.length}

`;for(const e of i)t+=`### ${e.name} ${e.status!=="active"?`(${e.status})`:""}

`,t+=`- **Address:** ${e.address}
`,t+=`- **Coordinates:** ${e.lat}, ${e.lon}
`,t+=`- **Base Price:** $${e.base_price??"—"} | **Free Miles:** ${e.free_miles??"—"} | **$/extra mile:** $${e.price_per_extra_mile??"—"}
`,t+=`- **Max Distance:** ${e.max_distance??"—"} mi
`,t+=`- **Operating Days:** ${Array.isArray(e.operating_days)?e.operating_days.join(","):"—"}
`,t+=`- **Saturday Surcharge Override:** $${e.saturday_surcharge_override??"—"} | **Sunday Surcharge:** $${e.sunday_surcharge??"—"}
`,t+=`- **Sat Load Limit:** ${e.saturday_load_limit??"—"} | **Sun Load Limit:** ${e.sunday_load_limit??"—"}
`,t+=`- **Same-Day Cutoff:** ${e.same_day_cutoff??"—"}
`,t+=`- **Default:** ${e.is_default} | **Pickup Only:** ${e.is_pickup_only}
`,e.notes&&(t+=`- **Notes:** ${e.notes}
`),t+=`
`;return t}catch(r){return`## 5. Active PITs (Live)
${u("pits",r)}`}}async function B(){try{const{data:r,error:a}=await l.from("zip_tax_rates").select("zip_code, tax_region_name, combined_rate, state_rate, local_rate").order("zip_code",{ascending:!0}).limit(1e4);if(a)throw a;const i=r??[];if(i.length===0)return`## 6. Service ZIP Codes (Live)

*(no ZIPs found)*
`;const t=new Map;for(const s of i){const n=s.tax_region_name||"Unknown";t.has(n)||t.set(n,{zips:[],rate:s.combined_rate}),t.get(n).zips.push(s.zip_code)}const e=[...t.entries()].sort(([s],[n])=>s.localeCompare(n));let o=`## 6. Service ZIP Codes (Live)

**Total ZIPs:** ${i.length}

### By Parish/Region

| Parish/Region | ZIP Count | Combined Rate |
|---------------|-----------|---------------|
`;for(const[s,n]of e)o+=`| ${d(s)} | ${n.zips.length} | ${(n.rate*100).toFixed(3)}% |
`;return o+=`
**Full ZIP list (comma-separated):**

${i.map(s=>s.zip_code).join(", ")}
`,o}catch(r){return`## 6. Service ZIP Codes (Live)
${u("zip_tax_rates",r)}`}}async function $(){try{const{data:r,error:a}=await l.from("city_pages").select("city_slug, status, region, page_views").limit(1e4);if(a)throw a;const i=r??[];if(i.length===0)return`## 11. City Pages & SEO (Live)

*(no city pages found)*
`;const t={};for(const o of i){const s=o.status||"unknown";t[s]||(t[s]=[]),t[s].push(o.city_slug)}Object.values(t).forEach(o=>o.sort());let e=`## 11. City Pages & SEO (Live)

**Total pages:** ${i.length}

`;for(const o of Object.keys(t).sort())e+=`### ${o.charAt(0).toUpperCase()+o.slice(1)} (${t[o].length})

`,e+=t[o].map(s=>`\`${s}\``).join(", ")+`

`;return e}catch(r){return`## 11. City Pages & SEO (Live)
${u("city_pages",r)}`}}async function z(){try{const{count:r,error:a}=await l.from("fraud_blocklist").select("*",{count:"exact",head:!0});if(a)throw a;return`## 13. Fraud System (Live)

**Active blocklist entries:** ${r??0}

See \`mem://features/lead-and-fraud-management\` for full architecture.
`}catch(r){return`## 13. Fraud System (Live)
${u("fraud_blocklist",r)}`}}async function M(){try{const{count:r,error:a}=await l.from("reviews").select("*",{count:"exact",head:!0});if(a)throw a;return`## 14. Review Collection (Live)

**Total reviews captured:** ${r??0}

Automated 24hr post-delivery requests; 4+ stars redirect to Google My Business.
`}catch(r){return`## 14. Review Collection (Live)
${u("reviews",r)}`}}async function G(){const r=p();if(r)try{const{data:a,error:i}=await l.functions.invoke("leads-auth",{body:{password:r,action:"get_order_stats"}});if(i)throw i;if(a&&a.ok===!1)throw new Error(a.error||"get_order_stats failed");const t=a?.stats??{};let e=`## 18. Live Order Stats (via service role)

`;e+=`**Total orders:** ${t.total??0}
`,e+=`**Total revenue (gross):** $${Number(t.revenue??0).toFixed(2)}

`,e+=`### By Status

`;for(const[o,s]of Object.entries(t.byStatus??{}).sort())e+=`- ${o}: ${s}
`;e+=`
### By Payment Method

`;for(const[o,s]of Object.entries(t.byMethod??{}).sort())e+=`- ${o}: ${s}
`;e+=`
### By Payment Status

`;for(const[o,s]of Object.entries(t.byPayStatus??{}).sort())e+=`- ${o}: ${s}
`;return t.latest&&(e+=`
**Latest order:** ${t.latest}
`),e+`
`}catch(a){return console.warn("[docs] get_order_stats via leads-auth failed:",a),`## 18. Live Order Stats

> ⚠️ Service-role fetch failed: ${a instanceof Error?a.message:String(a)}

Anon role cannot read \`orders\` (RLS: admin-only). Sign in to /leads to populate.
`}return"## 18. Live Order Stats\n\n> ℹ️ Anon role cannot read `orders` (RLS: admin-only). Sign in to /leads (sets `sessionStorage.leads_pw`) and re-export to populate this section.\n"}async function U(){const r=p();if(r)try{const{data:a,error:i}=await l.functions.invoke("leads-auth",{body:{password:r,action:"get_session_stats"}});if(i)throw i;if(a&&a.ok===!1)throw new Error(a.error||"get_session_stats failed");const t=a?.stats??{};let e=`## 19. Live Session Stats (via service role)

`;e+=`**Total sessions:** ${t.total??0}
`,e+=`**Stripe link clicked:** ${t.stripeLinkClicked??0}

`,e+=`### Email touch counts

`,e+=`- 1hr sent: ${t.email_1hr_sent??0}
`,e+=`- 24hr sent: ${t.email_24hr_sent??0}
`,e+=`- 48hr sent: ${t.email_48hr_sent??0}
`,e+=`- 72hr sent: ${t.email_72hr_sent??0}

`,e+=`### By Stage

`;for(const[o,s]of Object.entries(t.byStage??{}).sort())e+=`- ${o}: ${s}
`;return e+`
`}catch(a){return console.warn("[docs] get_session_stats via leads-auth failed:",a),`## 19. Live Session Stats

> ⚠️ Service-role fetch failed: ${a instanceof Error?a.message:String(a)}

Anon role cannot read \`visitor_sessions\` (RLS: admin-only).
`}return"## 19. Live Session Stats\n\n> ℹ️ Anon role cannot read `visitor_sessions` (RLS: admin-only). Sign in to /leads (sets `sessionStorage.leads_pw`) and re-export to populate this section.\n"}async function H(){const[r,a,i,t,e,o,s,n]=await Promise.all([R(),F(),B(),$(),z(),M(),G(),U()]),S=[`# RIVERSAND.NET — COMPLETE PROJECT DOCUMENTATION

*Version: __DOC_VERSION__ — Year 1, Build 01*
*Generated: ${new Date().toISOString()} — Live database snapshot*
*Supabase Project: lclbexhytmpfxzcztzva*
*GitHub: bayou0313/sand-nine-rivers*

---

`,E,f,h,r,a,i,x,v,w,Y,t,N,e,o,O,T,D,s,n,C,k,P,A+`

`+L,I].join(`
---

`);let m=_;const g=p();if(g)try{const{data:c,error:b}=await l.functions.invoke("leads-auth",{body:{action:"increment_doc_version",password:g,newDocLength:String(S.length)}});if(b)throw b;if(c?.ok===!1)throw new Error(c.error||"version bump failed");c?.version&&(m=c.version)}catch(c){console.warn("[docs] increment_doc_version failed:",c);try{m=await y()}catch{}}else m=await y();return S.replace("__DOC_VERSION__",m)}export{_ as DOC_VERSION,H as generateProjectDocs,y as getCurrentDocsVersion};
