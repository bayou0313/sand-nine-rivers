

## Plan: Generate System Documentation (Markdown File)

### What
Create a comprehensive `SYSTEM_DOCUMENTATION.md` file saved to `/mnt/documents/` covering the full architecture, database schema, edge functions, frontend structure, integrations, and data flows.

### Document Outline

1. **System Overview** — River Sand: same-day bulk river sand delivery platform
2. **Technology Stack** — React/Vite/TypeScript/Tailwind, Lovable Cloud (Supabase), Vercel hosting
3. **Frontend Architecture**
   - Pages: Index, Order, CityPage, Leads (admin dashboard), Admin, AdminLogin, NotFound
   - Key components: Navbar, Hero, DeliveryEstimator, DeliveryDatePicker, OutOfAreaModal, ContactForm, FAQ, etc.
   - Shared libraries: `pits.ts` (Haversine, pricing), `session.ts` (visitor tracking), `analytics.ts` (GTM dataLayer), `format.ts` (phone/currency/tax)
   - Routing diagram
4. **Database Schema** — All 7 tables with columns, types, defaults, RLS policies:
   - `orders`, `pits`, `delivery_leads`, `city_pages`, `visitor_sessions`, `global_settings`, `payment_events`, `user_roles`
5. **Database Functions & Triggers** — `create_order`, `generate_order_number`, `generate_lead_number`, `increment_visit_count`, `increment_city_page_views`, `has_role`, etc.
6. **Edge Functions** — All 10 functions with purpose, auth method, and key integrations:
   - `leads-auth` (admin CRUD hub), `send-email`, `abandonment-emails`, `create-checkout-link`, `stripe-webhook`, `generate-city-page`, `generate-sitemap`, `generate-invoice`, `get-order-status`, `create-payment-intent`
7. **Key Integrations** — Stripe payments, Google Maps/Places API, Resend email, Lovable AI Gateway, GTM analytics
8. **Security Model** — RLS policies summary, LEADS_PASSWORD auth for admin, service_role patterns, SECURITY DEFINER RPCs
9. **Programmatic City Pages System** — Discovery → AI content generation → SEO rendering flow
10. **Deployment** — Vercel config, sitemap rewrite, edge function auto-deploy

### Implementation
Single `code--exec` to write the markdown file to `/mnt/documents/SYSTEM_DOCUMENTATION.md`, then present as artifact.

### Files Changed
| File | Change |
|---|---|
| `/mnt/documents/SYSTEM_DOCUMENTATION.md` | New — full system documentation |

