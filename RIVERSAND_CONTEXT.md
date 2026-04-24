# RIVERSAND_CONTEXT.md
Version: 1.09 (2026-04-24)
Last synced: 2026-04-24

## Project identity
- Repo: bayou0313/sand-nine-rivers
- Live site: riversand.net
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

## Version gate protocol
Future task briefs check this file's Version line. If the task specifies a minimum version higher than what's in this file, the task author must update this file first.
