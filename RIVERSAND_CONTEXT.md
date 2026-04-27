# RIVERSAND_CONTEXT.md
Version: 1.14 (2026-04-26)
Last synced: 2026-04-26

## Companion documents
- CORE_FLOW_REFERENCE.md — customer-facing source snapshot (pages, customer components, lib, customer-flow edge functions). Regenerated 2026-04-24, supersedes April 1 snapshot.
- LMT_REFERENCE.md — operator-facing source snapshot (Leads.tsx shell, drivers/*, schedule/*, LeadsSetup2FA, full leads-auth). New as of 2026-04-24.
- RIVERSAND_FORM_GUIDELINES_v1.1_2026-04-24.md — canonical form entry reference (labels, inputs, validation, case handling) for all operator and customer-facing forms.
- RIVERSAND_FOLLOWUPS.md — deferred technical follow-ups (P2 server-side normalization, P3 UX polish).
- SECURITY_ROADMAP.md — Security posture, known gaps, and hardening roadmap.
- INCIDENT_RESPONSE.md — Response runbooks for credential, breach, payment, and outage incidents.
- PHASE_3_PLAN.md — Driver portal phase planning (3a shipped, 3b/3c pending).
- FLEETWORK_MIGRATION_PLAN.md — Migration plan for driver portal to fleetwork.net.
- WAYS_LMT_UNIFICATION_v2_pit_driven.md — multi-storefront pit-driven catalog architecture (Block 1 applied 2026-04-26).
- LMT_BLOCK_1_SCHEMA_PROMPT.md — propose-only Lovable prompt for Block 1 schema migration (executed 2026-04-26).
- PROJECT_BRIEF_v1.0_2026-04-25.md — strategic-level brief covering full digital stack.

## Project identity
- Repo: bayou0313/sand-nine-rivers
- Live site: riversand.net
- Driver portal production home (planned): fleetwork.net — migration target after Phase 3c validated. See FLEETWORK_MIGRATION_PLAN.md.
- Parent business: Ways Materials LLC (WAYS trademark)
- Supabase project: lclbexhytmpfxzcztzva
- Stripe: live mode

## Tech stack constraints
- React + TypeScript + Vite
- Supabase (auth + DB + edge functions)
- Stripe live mode — never expose secrets client-side
- Google Maps Distance Matrix — all distance calcs server-side via leads-auth
- NO haversine distances anywhere, no fallback
- Tailwind + shadcn/ui — do not install new UI libs
- framer-motion available, date-fns available, lucide-react for icons

## Brand tokens
- BRAND_NAVY: #0D2137
- BRAND_GOLD: #C07A00
- CARD_BORDER: defined in this project
- Fonts: Bebas Neue (font-display) for all-caps titles, Inter (font-sans) for body
- Forbidden: DM Sans
- Rule: text color never matches background

## Core tables (partial — do not modify schema without approval)
- orders (id, order_number, customer_name, customer_phone, customer_email, delivery_address, delivery_date, delivery_notes, price, quantity, payment_method, payment_status, status, pit_id, distance_miles, created_at, updated_at)
- Order status enum: pending | confirmed | en_route | delivered | cancelled
- Payment status: paid | unpaid | refunded (and variations)

## Block 1 schema additions (live as of 2026-04-26)

Block 1 of the unification work is applied. The following schema additions are live and queryable but not yet wired into application code:

New tables (all with RLS):
- products — master catalog (sand, dirt, rock, soil, mulch, gravel)
- pit_inventory — pit × product × price (sellable rows)
- pit_zip_distances — cached driving distances pit→ZIP
- customers_v2 — phone-keyed unified customer identity (separate from existing public.customers; rename deferred to later block)
- addresses — customer address book (FK to customers_v2)
- storefronts — registry of storefronts (RS, WM, etc.)
- app_configurations — per-storefront pricing and UI config
- order_items — multi-product order line items

Column additions to existing tables:
- pits: min_trip_charge, saturday_only, vendor_relationship
- orders: source_platform (default 'RS'), stripe_account_id, material_total, delivery_fee, fuel_surcharge, trustlevel_fee, discounts_total
- delivery_leads: source_platform, requested_product_id, requested_quantity, quoted_price, quote_sent_at, quote_accepted, converted_order_id
- zip_tax_rates: city, state, county, lat, lng, population, in_service_pit_ids

Status: tables empty, no data seeded yet. Block 2 (seed catalog data) is the next unification step.

## Admin routes
- /leads — password-gated via leads-auth edge function
- /admin — Supabase Auth via user_roles table

## Edge functions (do not modify without approval)
- leads-auth (large, multi-action)
- stripe-webhook, send-email, generate-invoice, create-checkout-link
- abandonment-emails

## Hard rules for any work
- No haversine
- No new tables or columns without explicit approval
- No new top-level routes without approval
- No demo/fake data in production code
- No new npm dependencies without approval
- Respect the scope fence in any task brief

## Data access patterns

- All /leads data reads MUST route through the leads-auth edge function. The /leads session is password-gated (sessionStorage, anon Supabase role). Direct supabase.from(...) reads from the browser fail silently because orders and similar tables have RLS policies requiring authenticated admin JWT claims. Anon reads return [] with no error.

- All /admin data reads use Supabase Auth session (admin JWT) and CAN use direct supabase.from(...) reads against RLS-protected tables.

- When adding a new tab or feature to /leads that needs DB data: add a new read action to leads-auth, do not use direct client queries.

- This pattern caught a Slice 1 Schedule regression (April 2026) — future sessions should flag any proposed direct-read pattern on /leads.

## Version gate protocol
Future task briefs check this file's Version line. If the task specifies a minimum version higher than what's in this file, the task author must update this file first.

## Changelog
- v1.13 (2026-04-25) — Committed fleetwork.net as driver portal production home (migration after Phase 3c). Added SECURITY_ROADMAP, INCIDENT_RESPONSE, PHASE_3_PLAN, FLEETWORK_MIGRATION_PLAN as companion documents.
- v1.12 (2026-04-24) — Split reference into two docs: CORE_FLOW_REFERENCE.md (customer flow, regenerated) and LMT_REFERENCE.md (operator surface, new). Both supersede April 1 snapshot. Reflects Phase 0/1/2 work, Schedule Slice 1, 2FA Slice 1a, DriverModal Phase 1 polish, and P1 form cleanup (CityPage waitlist + OutOfAreaModal + ContactForm + WhatsAppButton).
- v1.11 (2026-04-24) — Added reference to RIVERSAND_FORM_GUIDELINES_v1.1 as canonical form reference doc.

