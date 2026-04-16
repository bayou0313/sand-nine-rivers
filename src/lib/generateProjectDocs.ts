// =============================================================================
// CLIENT-SIDE PROJECT DOCUMENTATION GENERATOR
// =============================================================================
// Reads everything live from Supabase via the browser client. All hardcoded
// sections live as module-level constants so they cannot be silently dropped.
// =============================================================================

import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// TABLES TO INTROSPECT (order matters — appears in this order in the doc)
// -----------------------------------------------------------------------------
const SCHEMA_TABLES = [
  "orders", "pits", "global_settings", "visitor_sessions", "delivery_leads",
  "city_pages", "payment_events", "user_roles", "waitlist_leads", "zip_tax_rates",
  "fraud_blocklist", "fraud_events", "payment_attempts", "reviews",
  "customers", "notifications", "blocked_ips", "tax_rates",
] as const;

// -----------------------------------------------------------------------------
// STATIC SECTIONS — MODULE-LEVEL CONSTANTS (defined once, never recreated)
// -----------------------------------------------------------------------------

const SECTION_1_ARCHITECTURE = `## 1. Architecture Overview

**Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind v3 + shadcn/ui
**Backend:** Lovable Cloud (managed Supabase, project ref: lclbexhytmpfxzcztzva)
**Hosting:** GitHub Pages (frontend SPA shell at riversand.net) + Lovable Cloud (edge functions + DB)
**Payments:** Stripe (live + test modes via global_settings.stripe_mode)
**Email:** Resend (haulogix.com domain authority for dispatch)
**Maps:** Google Maps Distance Matrix + Places Autocomplete (proxied via edge functions)
**AI:** Anthropic Claude 4.5 Haiku (claude-haiku-4-5-20251001) for city page generation
**Analytics:** GTM-KPKFPCXM (with internal-traffic exclusion via No-Track system)

**Key principles:**
- Strict no-hardcoded-values policy (secrets in Supabase Vault, public config in global_settings)
- Address strings drive Maps Distance Matrix — never lat/lng for routing
- Closest active PIT wins for all geographic decisions
- Pricing formula: \`Math.max(base, base + (miles - free_miles) * extra_mile)\`
- Northshore (St. Tammany ZIPs) gets +3 phantom miles for toll recovery
- All phone links use E.164 format (tel:+18554689297)
- No trailing slashes on any route (canonical-enforced)
`;

const SECTION_2_ROUTING = `## 2. Routing & Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| \`/\` | Index.tsx / HomeMobile.tsx | Landing page (mobile/desktop split via useIsMobile) |
| \`/order\` | Order.tsx / OrderMobile.tsx | Checkout wizard with day-aware PIT routing |
| \`/order?reschedule=true&token=\` | Order.tsx | Reschedule mode for existing orders |
| \`/leads\` | Leads.tsx | LMT admin dashboard (password: LEADS_PASSWORD) |
| \`/admin\` | Admin.tsx | Authenticated admin (Supabase Auth, has_role('admin')) |
| \`/admin/login\` | AdminLogin.tsx | Admin sign-in |
| \`/review/:token\` | Review.tsx | Customer review collection (24hr post-delivery) |
| \`/:citySlug\` | CityPage.tsx | Programmatic SEO city pages (37 active cities) |
| \`/*\` | NotFound.tsx | 404 |

**Mobile detection:** 3-signal approach (viewport <768px, touch <1024px, UA string) with \`?force_desktop=1\` override.
`;

const SECTION_7_EDGE_FUNCTIONS = `## 7. Edge Functions Inventory

| Function | Purpose | verify_jwt |
|----------|---------|------------|
| \`leads-auth\` | Admin authentication, lead CRUD, fraud checks, order cancellation | false |
| \`stripe-webhook\` | Payment intent lifecycle, card capture, order resolution | false |
| \`create-payment-intent\` | Auth-hold or immediate-capture based on customer_tier | false |
| \`create-checkout-link\` | Stripe Checkout Session for abandonment recovery | false |
| \`capture-payments\` | Manual capture for Tier-1 orders post-delivery | false |
| \`create-refund\` | Stripe refund + order status update | false |
| \`generate-invoice\` | PDF invoice (monochrome layout, separated taxes) | false |
| \`send-email\` | Resend transactional dispatcher (branded templates) | false |
| \`email-inbound\` | Resend webhook → forward to dispatch (loop prevention) | false |
| \`abandonment-emails\` | Hourly pg_cron (1h/24h/48h/72h sequences with discounts) | false |
| \`generate-city-page\` | Claude 4.5 Haiku content generation (Lander v4) | false |
| \`generate-sitemap\` | Live sitemap.xml from city_pages | false |
| \`submit-sitemap\` | Daily IndexNow + GSC ping | false |
| \`get-maps-key\` | Returns scoped GOOGLE_MAPS_BROWSER_KEY | false |
| \`get-order-status\` | Public order lookup by token | false |
| \`generate-docs\` | (DEPRECATED — replaced by client-side generator) | false |
`;

const SECTION_8_PRICING = `## 8. Pricing Engine

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
`;

const SECTION_9_ORDER_FLOW = `## 9. Order Flow

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
`;

const SECTION_10_SESSION = `## 10. Session & Abandonment

**visitor_sessions** captures every visit with IP enrichment (ipapi.co), B2B detection regex, geo data, entry page/city, and serviceability flag.

**Abandonment sequence (hourly pg_cron \`0 * * * *\`):**
- 1hr: gentle nudge ("Still need that sand?")
- 24hr: $10 discount offer
- 48hr: $20 discount + Stripe Checkout link
- 72hr: final $25 + sales human follow-up

Discounts enforced server-side via Stripe Checkout Session metadata (never client-side params).

**Stage progression:** \`visited\` → \`address_entered\` → \`payment_selected\` → \`order_placed\` (or \`abandoned\` after 1hr without progression).
`;

const SECTION_12_ADMIN = `## 12. Admin Dashboard (/leads)

**Authentication:** sessionStorage-persisted password (LEADS_PASSWORD secret).

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
`;

const SECTION_15_DESIGN = `## 15. Design System & Brand

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
`;

const SECTION_16_UTILITIES = `## 16. Utility Libraries

| File | Purpose |
|------|---------|
| \`src/lib/pits.ts\` | **PROTECTED** — core pricing engine, findAllPitDistances |
| \`src/lib/google-maps.ts\` | **PROTECTED** — Maps API loader |
| \`src/hooks/useGoogleMaps.ts\` | **PROTECTED** — autocomplete hook |
| \`src/lib/cart.ts\` | localStorage cart persistence (24hr TTL) |
| \`src/lib/format.ts\` | Currency, distance, date formatters |
| \`src/lib/textFormat.ts\` | formatProperName + corporate designator standardization |
| \`src/lib/session.ts\` | visitor_sessions wrapper |
| \`src/lib/analytics.ts\` | GTM dataLayer push with No-Track guard |
| \`src/lib/palettes.ts\` | 5 brand palettes + slug-hash assignment |
| \`src/hooks/useBusinessSettings.ts\` | global_settings cache (module-level) |
| \`src/hooks/useBrandPalette.ts\` | Per-page palette selection |
| \`src/hooks/use-countdown.ts\` | Same-day cutoff timer |
`;

const SECTION_17_SECRETS = `## 17. Secrets & Environment

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
`;

const SECTION_20_KNOWN_ISSUES = `## 20. Known Issues & Pending Work

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
`;

const SECTION_21_SEO = `## 21. SEO Issues & Crawl Fixes

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
`;

const SECTION_22_DRIVEDIGITS = `## 22. DriveDigits Roadmap

(Future multi-tenant analytics platform — placeholder section)

- Phase 1: tenant_id schema migration (all tables)
- Phase 2: per-tenant subdomain routing
- Phase 3: tenant-scoped admin dashboard
- Phase 4: shared service catalog with tenant overrides
- Phase 5: cross-tenant analytics for ways.us master brand
`;

const SECTION_23_LEADS_DESIGN = `## 23. /leads UI Design System

**MANDATORY PATTERNS for all new tabs:**

\`\`\`ts
const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const CARD_BORDER = "#E5E7EB";
const STATUS_COLORS = {
  active: "#16A34A", inactive: "#DC2626",
  pending: "#F59E0B", completed: "#16A34A",
};
\`\`\`

**Required components:**
1. Page shell with bg-gray-50, branded header (BRAND_NAVY)
2. Tab nav with active-state underline (BRAND_GOLD)
3. Card containers (rounded-xl, shadow-sm, border CARD_BORDER)
4. Section titles (font-display uppercase tracking-wide)
5. Metric cards (4-up grid with terminal-num styling for figures)
6. Search/filter bar (sticky top, white bg)
7. Toast notifications (sonner, top-right)
8. Status badges (pill shape, STATUS_COLORS)
9. Action buttons (BRAND_GOLD primary, outline secondary)
10. Tables (hover effects, proper spacing, sticky headers)
11. Modals (Dialog primitive, max-w-2xl, padding-6)
12. Mobile responsive breakpoints (md:, lg:)
13. Dark mode CSS variable support
14. Action menus (DropdownMenu with proper icons)
15. Form validation (clear error states, red-border)
16. Order numbers always rendered in BRAND_GOLD with terminal-num font
`;

const SECTION_24_DATA_FLOW = `## 24. Data Flow Diagrams

**Order placement:**
\`\`\`
User → Order.tsx → create_order RPC → orders + customers tables
                                   ↓
                          customer_id linked
                                   ↓
                  → create-payment-intent → Stripe API
                                          ↓
                                stripe_payment_id stored
                                          ↓
                          → stripe-webhook → orders.status = 'paid'
                                           → notifications insert
                                           → send-email (confirmation)
\`\`\`

**Lead capture (out-of-area):**
\`\`\`
User → OutOfAreaModal → leads-auth (insert lead + fraud check)
                     → delivery_leads table
                     → notifications insert (Realtime push)
                     → admin sees in /leads instantly
\`\`\`

**City page generation:**
\`\`\`
Admin → /leads City Pages tab → generate-city-page edge function
                              → Anthropic Claude 4.5 Haiku
                              → city_pages.content updated
                              → status = 'active'
                              → sitemap regenerates on next request
\`\`\`

**Abandonment recovery:**
\`\`\`
pg_cron (hourly) → abandonment-emails edge function
                 → query visitor_sessions where stage != 'order_placed'
                 → match age bucket (1h/24h/48h/72h)
                 → send-email with discount code
                 → Stripe Checkout Link with server-enforced discount
                 → email_*hr_sent flag updated
\`\`\`
`;

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function md(s: string): string {
  // Escape pipes inside markdown table cells
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function errSection(label: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `\n> ⚠️ **${label} fetch failed:** ${msg}\n`;
}

// -----------------------------------------------------------------------------
// LIVE SECTION BUILDERS
// -----------------------------------------------------------------------------

async function buildSchemaSection(): Promise<string> {
  const calls = SCHEMA_TABLES.map(async (table) => {
    try {
      const { data, error } = await supabase.rpc("get_table_schema", { p_table: table });
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>;
      if (rows.length === 0) {
        return `### Table: \`${table}\`\n\n*(empty or inaccessible)*\n`;
      }
      const header = `### Table: \`${table}\`\n\n| Column | Type | Nullable | Default |\n|--------|------|----------|---------|\n`;
      const body = rows
        .map(
          (r) =>
            `| ${md(r.column_name)} | ${md(r.data_type)} | ${md(r.is_nullable)} | ${md(r.column_default ?? "")} |`,
        )
        .join("\n");
      return header + body + "\n";
    } catch (err) {
      return `### Table: \`${table}\`\n${errSection(table, err)}`;
    }
  });
  const blocks = await Promise.all(calls);
  return `## 3. Database Schema (Live)\n\n${blocks.join("\n")}`;
}

async function buildSettingsSection(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("global_settings")
      .select("key, value, description")
      .order("key", { ascending: true })
      .limit(10000);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return `## 4. Global Settings (Live)\n\n*(no settings found)*\n`;
    const header = `## 4. Global Settings (Live)\n\n**Total keys:** ${rows.length}\n\n| Key | Value | Description |\n|-----|-------|-------------|\n`;
    const body = rows
      .map((r: any) => `| ${md(r.key)} | ${md(r.value)} | ${md(r.description ?? "")} |`)
      .join("\n");
    return header + body + "\n";
  } catch (err) {
    return `## 4. Global Settings (Live)\n${errSection("global_settings", err)}`;
  }
}

async function buildPitsSection(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("pits")
      .select("*")
      .order("name", { ascending: true })
      .limit(10000);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return `## 5. Active PITs (Live)\n\n*(no pits found)*\n`;
    let out = `## 5. Active PITs (Live)\n\n**Total PITs:** ${rows.length}\n\n`;
    for (const p of rows as any[]) {
      out += `### ${p.name} ${p.status !== "active" ? `(${p.status})` : ""}\n\n`;
      out += `- **Address:** ${p.address}\n`;
      out += `- **Coordinates:** ${p.lat}, ${p.lon}\n`;
      out += `- **Base Price:** $${p.base_price ?? "—"} | **Free Miles:** ${p.free_miles ?? "—"} | **$/extra mile:** $${p.price_per_extra_mile ?? "—"}\n`;
      out += `- **Max Distance:** ${p.max_distance ?? "—"} mi\n`;
      out += `- **Operating Days:** ${Array.isArray(p.operating_days) ? p.operating_days.join(",") : "—"}\n`;
      out += `- **Saturday Surcharge Override:** $${p.saturday_surcharge_override ?? "—"} | **Sunday Surcharge:** $${p.sunday_surcharge ?? "—"}\n`;
      out += `- **Sat Load Limit:** ${p.saturday_load_limit ?? "—"} | **Sun Load Limit:** ${p.sunday_load_limit ?? "—"}\n`;
      out += `- **Same-Day Cutoff:** ${p.same_day_cutoff ?? "—"}\n`;
      out += `- **Default:** ${p.is_default} | **Pickup Only:** ${p.is_pickup_only}\n`;
      if (p.notes) out += `- **Notes:** ${p.notes}\n`;
      out += `\n`;
    }
    return out;
  } catch (err) {
    return `## 5. Active PITs (Live)\n${errSection("pits", err)}`;
  }
}

async function buildZipSection(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("zip_tax_rates")
      .select("zip_code, tax_region_name, combined_rate, state_rate, local_rate")
      .order("zip_code", { ascending: true })
      .limit(10000);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      zip_code: string;
      tax_region_name: string;
      combined_rate: number;
      state_rate: number;
      local_rate: number;
    }>;
    if (rows.length === 0) return `## 6. Service ZIP Codes (Live)\n\n*(no ZIPs found)*\n`;

    // Group by tax_region_name (parish)
    const groups = new Map<string, { zips: string[]; rate: number }>();
    for (const r of rows) {
      const region = r.tax_region_name || "Unknown";
      if (!groups.has(region)) groups.set(region, { zips: [], rate: r.combined_rate });
      groups.get(region)!.zips.push(r.zip_code);
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

    let out = `## 6. Service ZIP Codes (Live)\n\n**Total ZIPs:** ${rows.length}\n\n### By Parish/Region\n\n| Parish/Region | ZIP Count | Combined Rate |\n|---------------|-----------|---------------|\n`;
    for (const [region, g] of sortedGroups) {
      out += `| ${md(region)} | ${g.zips.length} | ${(g.rate * 100).toFixed(3)}% |\n`;
    }
    out += `\n**Full ZIP list (comma-separated):**\n\n${rows.map((r) => r.zip_code).join(", ")}\n`;
    return out;
  } catch (err) {
    return `## 6. Service ZIP Codes (Live)\n${errSection("zip_tax_rates", err)}`;
  }
}

async function buildCityPagesSection(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("city_pages")
      .select("city_slug, status, region, page_views")
      .limit(10000);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      city_slug: string;
      status: string;
      region: string | null;
      page_views: number | null;
    }>;
    if (rows.length === 0) return `## 11. City Pages & SEO (Live)\n\n*(no city pages found)*\n`;

    const buckets: Record<string, string[]> = {};
    for (const r of rows) {
      const s = r.status || "unknown";
      if (!buckets[s]) buckets[s] = [];
      buckets[s].push(r.city_slug);
    }
    Object.values(buckets).forEach((arr) => arr.sort());

    let out = `## 11. City Pages & SEO (Live)\n\n**Total pages:** ${rows.length}\n\n`;
    for (const status of Object.keys(buckets).sort()) {
      out += `### ${status.charAt(0).toUpperCase() + status.slice(1)} (${buckets[status].length})\n\n`;
      out += buckets[status].map((s) => `\`${s}\``).join(", ") + "\n\n";
    }
    return out;
  } catch (err) {
    return `## 11. City Pages & SEO (Live)\n${errSection("city_pages", err)}`;
  }
}

async function buildFraudSection(): Promise<string> {
  try {
    const { count, error } = await supabase
      .from("fraud_blocklist")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return `## 13. Fraud System (Live)\n\n**Active blocklist entries:** ${count ?? 0}\n\nSee \`mem://features/lead-and-fraud-management\` for full architecture.\n`;
  } catch (err) {
    return `## 13. Fraud System (Live)\n${errSection("fraud_blocklist", err)}`;
  }
}

async function buildReviewsSection(): Promise<string> {
  try {
    const { count, error } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return `## 14. Review Collection (Live)\n\n**Total reviews captured:** ${count ?? 0}\n\nAutomated 24hr post-delivery requests; 4+ stars redirect to Google My Business.\n`;
  } catch (err) {
    return `## 14. Review Collection (Live)\n${errSection("reviews", err)}`;
  }
}

async function buildOrderStatsSection(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("status, payment_method, payment_status, price, created_at")
      .limit(100000);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      status: string;
      payment_method: string;
      payment_status: string;
      price: number;
      created_at: string;
    }>;
    const total = rows.length;
    const totalRevenue = rows.reduce((s, r) => s + Number(r.price || 0), 0);
    const byStatus: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    const byPayStatus: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byMethod[r.payment_method] = (byMethod[r.payment_method] || 0) + 1;
      byPayStatus[r.payment_status] = (byPayStatus[r.payment_status] || 0) + 1;
    }
    let out = `## 18. Live Order Stats\n\n`;
    out += `**Total orders:** ${total}\n`;
    out += `**Total revenue (gross):** $${totalRevenue.toFixed(2)}\n\n`;
    out += `### By Status\n\n`;
    for (const [k, v] of Object.entries(byStatus).sort()) out += `- ${k}: ${v}\n`;
    out += `\n### By Payment Method\n\n`;
    for (const [k, v] of Object.entries(byMethod).sort()) out += `- ${k}: ${v}\n`;
    out += `\n### By Payment Status\n\n`;
    for (const [k, v] of Object.entries(byPayStatus).sort()) out += `- ${k}: ${v}\n`;
    return out + "\n";
  } catch (err) {
    return `## 18. Live Order Stats\n${errSection("orders", err)}`;
  }
}

async function buildSessionStatsSection(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("visitor_sessions")
      .select("stage, serviceable, ip_is_business")
      .limit(100000);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      stage: string | null;
      serviceable: boolean | null;
      ip_is_business: boolean | null;
    }>;
    const total = rows.length;
    const byStage: Record<string, number> = {};
    let serviceable = 0,
      business = 0;
    for (const r of rows) {
      const s = r.stage || "unknown";
      byStage[s] = (byStage[s] || 0) + 1;
      if (r.serviceable) serviceable++;
      if (r.ip_is_business) business++;
    }
    let out = `## 19. Live Session Stats\n\n`;
    out += `**Total sessions:** ${total}\n`;
    out += `**Serviceable (in-area):** ${serviceable}\n`;
    out += `**Business IPs:** ${business}\n\n`;
    out += `### By Stage\n\n`;
    for (const [k, v] of Object.entries(byStage).sort()) out += `- ${k}: ${v}\n`;
    return out + "\n";
  } catch (err) {
    return `## 19. Live Session Stats\n${errSection("visitor_sessions", err)}`;
  }
}

// -----------------------------------------------------------------------------
// MAIN ENTRY POINT
// -----------------------------------------------------------------------------

export async function generateProjectDocs(): Promise<string> {
  // Fire all live queries in parallel — typical total time < 2s
  const [
    schema,
    settings,
    pits,
    zips,
    cityPages,
    fraud,
    reviews,
    orderStats,
    sessionStats,
  ] = await Promise.all([
    buildSchemaSection(),
    buildSettingsSection(),
    buildPitsSection(),
    buildZipSection(),
    buildCityPagesSection(),
    buildFraudSection(),
    buildReviewsSection(),
    buildOrderStatsSection(),
    buildSessionStatsSection(),
  ]);

  const header = `# RIVERSAND.NET — COMPLETE PROJECT DOCUMENTATION

*Generated: ${new Date().toISOString()} — Live database snapshot*
*Supabase Project: lclbexhytmpfxzcztzva*
*GitHub: bayou0313/sand-nine-rivers*

---

`;

  return [
    header,
    SECTION_1_ARCHITECTURE,
    SECTION_2_ROUTING,
    schema,
    settings,
    pits,
    zips,
    SECTION_7_EDGE_FUNCTIONS,
    SECTION_8_PRICING,
    SECTION_9_ORDER_FLOW,
    SECTION_10_SESSION,
    cityPages,
    SECTION_12_ADMIN,
    fraud,
    reviews,
    SECTION_15_DESIGN,
    SECTION_16_UTILITIES,
    SECTION_17_SECRETS,
    orderStats,
    sessionStats,
    SECTION_20_KNOWN_ISSUES,
    SECTION_21_SEO,
    SECTION_22_DRIVEDIGITS,
    SECTION_23_LEADS_DESIGN,
    SECTION_24_DATA_FLOW,
  ].join("\n---\n\n");
}
