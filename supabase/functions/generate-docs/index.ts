import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── HARDCODED SECTIONS ───

const ARCHITECTURE_OVERVIEW = `## 1. Architecture Overview

**Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + Supabase (Lovable Cloud)

**Frontend:** Single-page application (SPA). No server-side rendering.

**Backend:** Supabase (Lovable Cloud)
- PostgreSQL database with RLS policies
- 13+ Edge Functions (Deno runtime) — auto-deploy on push
- Storage bucket: \`assets\` (public)
- Auth: email/password for admin only

**GitHub:** \`bayou0313/sand-nine-rivers\`
**Hosting:** Lovable Cloud
**Supabase Project ID:** \`lclbexhytmpfxzcztzva\`

**External Services:**
| Service | Purpose | Key Detail |
|---------|---------|------------|
| Stripe | Payments (dual live/test) | Account: \`acct_1TH4PcPuKuZka3yZ\`, Payout: JPMorgan Chase \`---5952\` |
| Google Maps Platform | Places, Distance Matrix, Geocoding | Browser key: \`AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI\` (restricted to riversand.net) |
| Resend | Transactional email | From: \`no_reply@riversand.net\` |
| Anthropic Claude API | City page AI content generation | Used in \`generate-city-page\` edge function |
| GTM / GA4 | Analytics via dataLayer | Excluded from \`/leads\` and \`/admin\` |
| IndexNow | Bing search index submission | Runs via pg_cron 6am/6pm UTC |

**Key Architectural Decisions:**
- All business config in \`global_settings\` table — no hardcoded values in source
- PIT-level overrides cascade over global defaults (NULL = inherit)
- All distance calculations via Google Distance Matrix API driving mode — **never haversine**. \`avoid=ferries\`, \`language=en\` forced.
- Visitor sessions tracked from first page view for abandonment email sequences
- **Baked pricing mode ACTIVE** — pit base prices include 3.5% card fee baked in. COD orders get \`primary_price\` (pre-bake) discount.
- No customer authentication — admin only via Supabase Auth + \`user_roles\` table
- \`/leads\` dashboard uses separate password auth via \`LEADS_PASSWORD\` secret
- Northshore deliveries (St. Tammany Parish): **+3 phantom miles** billed for Causeway toll recovery
`;

const ROUTING_PAGES = `## 2. Routing & Pages

Defined in \`src/App.tsx\`:

| Route | Component | Notes |
|-------|-----------|-------|
| \`/\` | \`Index\` | Landing page — Hero, estimator, testimonials, FAQ |
| \`/order\` | \`Order\` | 3-step checkout: Address → Details → Review/Pay |
| \`/admin\` | \`Admin\` | Order management (Supabase Auth protected) |
| \`/admin/login\` | \`AdminLogin\` | Admin email/password login |
| \`/leads\` | \`Leads\` | Full operations dashboard (LEADS_PASSWORD protected) |
| \`/:citySlug/river-sand-delivery\` | \`CityPage\` | Dynamic city SEO pages |
| \`*\` | \`NotFound\` | 404 page |

**App-Level Features (AppContent wrapper):**
- **Maintenance Mode** — \`global_settings.site_mode = "maintenance"\` shows MaintenancePage. Hidden "admin" bypass button.
- **Test Mode Banner** — \`global_settings.stripe_mode = "test"\` shows orange warning banner. Sets \`--banner-offset\` CSS var.
- **Page View Tracking** — PageViewTracker pushes \`page_view\` to GTM dataLayer on route change.
- **GTM/Analytics** — excluded from \`/leads\` and \`/admin\` server-side.
`;

const EDGE_FUNCTIONS = `## 7. Edge Functions Inventory

All edge functions use Deno runtime and auto-deploy on GitHub push.

### \`leads-auth\`
Master admin edge function. 3,341+ lines. Password-protected for all admin actions via \`LEADS_PASSWORD\` secret.

**Public actions (no password):** \`session_init\`, \`session_update\`

**Admin actions:** \`authenticate\`, \`list_leads\`, \`update_lead\`, \`export_csv\`, \`calculate_distances\`,
\`list_cash_orders\`, \`mark_cash_collected\`, \`send_proposal\`, \`send_payment_link\`,
\`join_waitlist\`, \`discover_cities_for_pit\`, \`get_funnel\`, \`list_live_visitors\`,
\`list_abandoned\`, \`sync_stripe_payment\`, \`send_offer\`, \`decline_lead\`, \`verify_call\`,
\`flag_fraud\`, \`get_pending_review_orders\`, \`refresh_service_zip_codes\`, plus many more CRUD operations.

### \`stripe-webhook\`
Handles Stripe events. Idempotent via \`payment_events\` table (dedup on \`event_id\`).
Events: \`checkout.session.completed\`, \`payment_intent.succeeded/failed/canceled\`, \`charge.refunded\`.
Order matching cascade: 1) \`metadata.order_id\` 2) \`metadata.order_number\` 3) \`stripe_payment_id\`

### \`send-email\`
Transactional email via Resend. Templates: \`order_confirmation\`, \`order\`, \`order_cancelled\`,
\`proposal\`, abandonment (1hr/24hr/48hr/108hr), \`waitlist_notification\`.
Reads ALL financial fields directly from order object in DB — never recalculates.

### \`generate-invoice\`
Creates PDF invoice using jsPDF. Returns base64 PDF data.

### \`create-checkout-link\`
Creates Stripe Checkout Session. Selects live/test key from \`global_settings.stripe_mode\`.

### \`abandonment-emails\`
Cron-triggered (hourly). COLD PATH: 1hr/24hr/48hr/108hr ($10 off final). HOT PATH: stripe_link_clicked → $10 off at 24hr.

### \`generate-city-page\`
AI city page content via Anthropic Claude API. Prompt v4.0+.

### \`generate-sitemap\`
Generates \`sitemap.xml\` from active city pages. Dynamic, no-cache headers.

### \`submit-sitemap\`
Submits sitemap to Google (GSC) and Bing (IndexNow). Runs twice daily via pg_cron.

### \`get-maps-key\`
Returns Google Maps API key to frontend.

### \`get-order-status\`
Public API for order status lookup via \`order_id + lookup_token\`. One-time use.

### \`generate-docs\`
This edge function. Queries live DB state + hardcoded architectural knowledge → downloads full \`.md\` documentation.
`;

const PRICING_ENGINE = `## 8. Pricing Engine

**Source:** \`src/lib/pits.ts\`

### Baked Pricing Mode (ACTIVE)
Pit base prices include 3.5% card processing fee baked in.
COD orders receive discount back to \`primary_price\` (the pre-bake price).

### Formula
\`\`\`
extraMiles    = max(0, drivingDistance - free_miles)
extraCharge   = extraMiles × price_per_extra_mile ($4.49/mi global)
rawPrice      = base_price + extraCharge
unitPrice     = max(base_price, round(rawPrice))
totalPrice    = unitPrice × quantity
finalPrice    = totalPrice + (isSaturday ? saturday_surcharge : 0)
\`\`\`

### Effective Pricing Resolution
\`\`\`
PIT override → if NULL → global_settings default → if NULL → FALLBACK constant
\`\`\`

Fallback constants: \`base_price=202\`, \`free_miles=15\`, \`extra_per_mile=4.49\`, \`max_distance=30\`, \`saturday_surcharge=35\`

### Best PIT Selection (\`findBestPitDriving\`)
1. Filter active PITs
2. Filter by \`operating_days\` for selected delivery day
3. Pre-filter top 5 candidates by Haversine to reduce API calls
4. Call \`leads-auth → calculate_distances\` → Google Distance Matrix API
5. Calculate price for each PIT using effective pricing
6. Filter serviceable PITs (\`distance ≤ max_distance\`)
7. Sort by distance (tiebreak: price) → pick cheapest closest
8. If none serviceable → return closest PIT with \`serviceable: false\`
9. Falls back to \`findBestPit\` (haversine) on API failure

### Tax Calculation (\`src/lib/format.ts\`)
Louisiana parish-based sales tax. Detection priority:
1. Google Maps \`administrative_area_level_2\` from Place result
2. City name mapping
3. Parish name in address string
4. Default: 9.75%

**Parish rates:** Jefferson 9.75%, Orleans 10%, St. Bernard 10%, St. Charles 10%, St. Tammany 9.25%, Plaquemines 9.75%, St. John the Baptist 10.25%, St. James 8.5%, Lafourche 9.7%, Tangipahoa 9.45%, Harahan city 10.55%.

### Northshore Phantom Miles
St. Tammany Parish deliveries: +3 miles added to billed distance for Causeway toll cost recovery.
`;

const ORDER_FLOW = `## 9. Order Flow

**File:** \`src/pages/Order.tsx\`

### Step 1: Address
- \`PlaceAutocompleteInput\` — Classic Google Places Autocomplete API. US-only.
- On submit: calls \`findBestPitDriving()\` via \`leads-auth → calculate_distances\`
- If out of area → \`OutOfAreaModal\` → creates \`delivery_lead\` row

### Step 2: Details
- \`DeliveryDatePicker\` — next 7 available dates, respects PIT \`operating_days\`
- Customer info: name (required), phone (required), email (required)
- Quantity selector (1–10 loads)
- Payment method: "Pay Now" (Stripe) or "At Delivery" (COD)

### Step 3: Confirm
- Full pricing breakdown
- Delivery terms accordion (must accept)
- COD → \`create_order\` RPC → immediate success
- Stripe → \`create_order\` RPC → \`create-checkout-link\` → Stripe Checkout

### Stripe Return Handling
- Same-tab: reads \`payment=success/canceled\` from URL params
- Popup: \`localStorage.stripe_payment_signal\` polling
- State preservation: \`pending_order_snapshot\` in sessionStorage

### Step 4: Success (\`OrderConfirmation\`)
- Animated checkmark (Stripe) or dollar sign (COD)
- Two-column layout, PDF invoice download
`;

const SESSION_TRACKING = `## 10. Session & Abandonment Tracking

### Session Lifecycle (\`src/lib/session.ts\`)
- \`initSession()\` → creates/finds session by localStorage UUID via \`leads-auth → session_init\`
- \`updateSession()\` → progressively enriches session
- \`incrementVisitCount()\` → tracks return visits

### Funnel Stages
\`\`\`
visited → entered_address → got_price → got_out_of_area
                                      → started_checkout → reached_payment → completed_order
\`\`\`

### Abandonment Email Sequences (pg_cron, hourly)
**COLD PATH:** 1hr, 24hr, 48hr, 108hr ($10 off final offer via real Stripe link)
**HOT PATH:** stripe_link_clicked + no order → $10 off at 24hr

Suppression: all emails suppressed once \`order_id\` populated on session.
`;

const CITY_PAGES_SEO = `## 11. City Pages & SEO

### Dynamic City Pages (\`src/pages/CityPage.tsx\`)
- Route: \`/:citySlug/river-sand-delivery\`
- Active pages: full content (Hero, price, stats, about, features, testimonials, FAQ, nearby cities)
- Waitlist pages: join waitlist form only
- Each city: deterministic color palette from \`src/lib/palettes.ts\` (slug hash)
- Structured data: \`BreadcrumbList\` + \`LocalBusiness\` JSON-LD schemas

### SEO Configuration
- Dynamic \`<title>\`, \`<meta description>\`, canonical URLs via \`react-helmet-async\`
- JSON-LD: LocalBusiness, FAQPage, BreadcrumbList, Offer schemas
- Robots.txt, sitemap.xml (dynamic, no-cache)
- IndexNow submission via pg_cron (6am/6pm UTC)

### Known SEO Issues
1. HTTP/HTTPS duplicate indexing on Chalmette page
2. Review schema hardcoded (4.9 stars, 127 reviews) — PLACEHOLDER
3. "Cash or card accepted" hardcoded in meta descriptions
`;

const ADMIN_DASHBOARD = `## 12. Admin Dashboard (/leads)

**File:** \`src/pages/Leads.tsx\` — largest file in codebase (5,000+ lines)

**Auth:** Password-based via \`LEADS_PASSWORD\` secret. Validated by \`leads-auth → authenticate\`.
**Theme:** Light minimalist with dark mode toggle. Breadcrumb on all pages.

### Tabs
**OPERATIONS:** Overview, Live Visitors, Orders, Finances, Customers, Pending Review, Abandoned Sessions, Reviews, Schedule
**EXPANSION:** City Pages, PITs, Waitlist, Global Settings
**INTELLIGENCE:** ZIP Intelligence, Pipeline, Revenue Forecast, All Leads
**SETTINGS:** Business Profile, Fraud & Security
`;

const FRAUD_SYSTEM = `## 13. Fraud System

**Tables:** \`fraud_blocklist\`, \`fraud_events\`, \`payment_attempts\`
\`checkFraudInternal\` runs inside \`leads-auth → session_init\` on every new session.
GTM excluded from \`/leads\` and \`/admin\`.
\`session_update\` fraud gate: pending implementation.
`;

const REVIEW_COLLECTION = `## 14. Review Collection

**Status:** PLANNED — not yet live in production.
Infrastructure built: \`reviews\` table, \`get_pending_review_orders\` action, \`review_request_sent\` column on orders.
Daily review cron: NOT YET SCHEDULED.
⚠️ Current schema numbers (4.9 stars, 127 reviews) are PLACEHOLDERS.
**GMB review link:** \`https://g.page/r/CbNmrceP24p6EBM/review\`
`;

const DESIGN_SYSTEM = `## 15. Design System & Brand

### CSS Variables (\`src/index.css\`)
| Variable | Value | Color |
|----------|-------|-------|
| \`--primary\` | 209 87% 12% | Navy \`#0D2137\` |
| \`--accent\` | 41 83% 53% | Gold \`#C07A00\` |
| \`--background\` | 33 48% 95% | Warm cream |
| \`--destructive\` | 353 72% 44% | Red |

### Typography
- Headlines: \`Bebas Neue\` (font-display)
- Body: \`Inter\` (font-body)

### Brand Architecture (WAYS)
- Ways Materials LLC = parent entity + GMB anchor
- riversand.net = river sand conversion funnel
- spillwaydirt.com = dirt/fill conversion funnel (future)
- ways.us = brand hub (in development)

### Business Contact
- Phone: \`1-855-GOT-WAYS\`
- Dispatch: \`cmo@halogix.com\`
- Stripe: \`acct_1TH4PcPuKuZka3yZ\`
`;

const UTILITY_LIBRARIES = `## 16. Utility Libraries & Key Components

### Libraries (\`src/lib/\`)
- **\`pits.ts\`** — Pricing engine, PIT selection, distance calculation
- **\`format.ts\`** — Formatting, tax utilities, parish rate lookup
- **\`session.ts\`** — Visitor session management via localStorage + edge function calls
- **\`analytics.ts\`** — GTM dataLayer push wrapper
- **\`google-maps.ts\`** — Google Maps API key export

### Key Components
- \`PlaceAutocompleteInput\` — Classic Google Places Autocomplete (NOT PlaceAutocompleteElement). US-only.
- \`DeliveryEstimator\` — Address → price calculation → ORDER NOW CTA
- \`DeliveryDatePicker\` — Date selection with Saturday amber styling, same-day badges
- \`OrderConfirmation\` — Post-payment success screen
- \`OutOfAreaModal\` — Lead capture for out-of-area visitors
- \`Navbar\` — Sticky nav with WAYS logo
- \`Footer\` — Company info, served cities links
`;

const SECRETS_ENV = `## 17. Secrets & Environment

### Supabase Secrets (configured)
| Secret | Purpose |
|--------|---------|
| \`STRIPE_SECRET_KEY\` | Live Stripe secret key |
| \`STRIPE_TEST_SECRET_KEY\` | Test Stripe secret key |
| \`STRIPE_WEBHOOK_SECRET\` | Live webhook signing secret |
| \`STRIPE_TEST_WEBHOOK_SECRET\` | Test webhook signing secret |
| \`VITE_GOOGLE_MAPS_KEY\` | Frontend Maps API key |
| \`GOOGLE_MAPS_SERVER_KEY\` | Server-side Distance Matrix key |
| \`RESEND_API_KEY\` | Transactional email (Resend) |
| \`ANTHROPIC_API_KEY\` | City page AI generation |
| \`LEADS_PASSWORD\` | Leads dashboard password auth |
| \`LOVABLE_API_KEY\` | Lovable AI integration |

### Frontend Environment (auto-managed)
| Variable | Value |
|----------|-------|
| \`VITE_SUPABASE_URL\` | Supabase project URL |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Supabase anon key |
| \`VITE_SUPABASE_PROJECT_ID\` | \`lclbexhytmpfxzcztzva\` |
`;

const KNOWN_ISSUES = `## 20. Known Issues & Pending Work

### Critical
1. **Review schema hardcoded** — 4.9 stars, 127 reviews — must replace before Google audit
2. **HTTP/HTTPS duplicate indexing** — Chalmette page
3. **City name "La" suffix** — Some city_names include state suffix causing malformed titles

### Features Pending
- Bridge City max_distance → extend to 40mi
- IndexNow trigger on page activation
- Orders tab infinite options menu
- Overview dashboard redesign
- GA4 session stitching before ad spend
- session_update fraud gate
- Reviews tab full UI
- Daily review request cron
- Card payment live test
`;

const DRIVEDIGITS = `## 21. DriveDigits Roadmap & WAYS Architecture

### Phase Plan
| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | **CURRENT** | Finish riversand.net polish + Merchant Center |
| Phase 2 | Planned | DriveDigits MVP — driver PWA, job acceptance flow |
| Phase 3 | Blocked by Ph2 | Integrate DriveDigits with riversand.net |

### WAYS Product Catalog
River sand, mason sand, concrete sand, fill sand, fill dirt, batture dirt, spillway dirt,
topsoil, garden soil, landscaping mulch, crushed concrete, pea gravel, limestone (all sizes),
asphalt millings, road gravel, driveway gravel, washed gravel.
**Minimum order:** 2 yards or 3 tons.
`;

// ─── HANDLER ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    const LEADS_PASSWORD = Deno.env.get("LEADS_PASSWORD");
    if (!password || password !== LEADS_PASSWORD) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // ── Query 1: global_settings (FULL VALUES, no truncation) ──
    const { data: settings } = await sb.from("global_settings").select("key, value, description").order("key").limit(10000);
    let settingsTable = "| Key | Value | Description |\n|-----|-------|-------------|\n";
    for (const s of settings || []) {
      // Escape pipe chars so they don't break the markdown table
      const val = String(s.value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const desc = String(s.description ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      settingsTable += `| \`${s.key}\` | ${val} | ${desc} |\n`;
    }

    // ── Query 2: pits ──
    const { data: pits } = await sb.from("pits").select("*").order("name");
    let pitsTable = "| Name | Address | Status | Base Price | Free Miles | $/mi | Max Distance | Operating Days | Sat Surcharge | Cutoff |\n";
    pitsTable += "|------|---------|--------|-----------|-----------|------|-------------|---------------|--------------|--------|\n";
    for (const p of pits || []) {
      const days = p.operating_days ? p.operating_days.map((d: number) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(",") : "All";
      pitsTable += `| ${p.name} | ${p.address} | ${p.status} | $${p.base_price || "—"} | ${p.free_miles || "—"} | $${p.price_per_extra_mile || "—"} | ${p.max_distance || "—"}mi | ${days} | $${p.saturday_surcharge_override || "—"} | ${p.same_day_cutoff || "10:00"} |\n`;
    }

    // ── Query 3: city_pages — ALL statuses ──
    const { data: allCities } = await sb.from("city_pages").select("city_slug, status").order("city_slug").limit(10000);
    const slugsByStatus: Record<string, string[]> = { active: [], draft: [], waitlist: [], other: [] };
    for (const c of allCities || []) {
      const bucket = (c.status === "active" || c.status === "draft" || c.status === "waitlist") ? c.status : "other";
      slugsByStatus[bucket].push(c.city_slug);
    }
    const activeCount = slugsByStatus.active.length;
    const draftCount = slugsByStatus.draft.length;
    const waitlistCount = slugsByStatus.waitlist.length;
    const otherCount = slugsByStatus.other.length;

    // ── Query 4: zip_tax_rates (no row cap) ──
    const { data: zipRates } = await sb.from("zip_tax_rates").select("*").order("zip_code").limit(10000);
    const zipsByParish: Record<string, { count: number; rate: number; zips: string[] }> = {};
    for (const z of zipRates || []) {
      const parish = z.tax_region_name || "Unknown";
      if (!zipsByParish[parish]) zipsByParish[parish] = { count: 0, rate: z.combined_rate, zips: [] };
      zipsByParish[parish].count++;
      zipsByParish[parish].zips.push(z.zip_code);
    }
    let zipParishTable = "| Parish | ZIP Count | Combined Rate |\n|--------|----------|---------------|\n";
    for (const [parish, info] of Object.entries(zipsByParish).sort((a, b) => a[0].localeCompare(b[0]))) {
      zipParishTable += `| ${parish} | ${info.count} | ${(Number(info.rate) * 100).toFixed(2)}% |\n`;
    }
    const allZips = (zipRates || []).map((z: any) => z.zip_code).join(", ");

    // ── Query 5: orders stats (no row cap) ──
    const { count: totalOrders } = await sb.from("orders").select("id", { count: "exact", head: true });
    const { data: ordersByStatus } = await sb.from("orders").select("status").limit(100000);
    const { data: ordersByPayMethod } = await sb.from("orders").select("payment_method").limit(100000);
    const { data: ordersByPayStatus } = await sb.from("orders").select("payment_status").limit(100000);
    const { data: latestOrder } = await sb.from("orders").select("created_at").order("created_at", { ascending: false }).limit(1);

    const countBy = (arr: any[], field: string) => {
      const counts: Record<string, number> = {};
      for (const r of arr || []) { const v = r[field] || "unknown"; counts[v] = (counts[v] || 0) + 1; }
      return Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ");
    };

    const orderStats = `| Metric | Value |
|--------|-------|
| Total orders | ${totalOrders || 0} |
| By status | ${countBy(ordersByStatus || [], "status")} |
| By payment method | ${countBy(ordersByPayMethod || [], "payment_method")} |
| By payment status | ${countBy(ordersByPayStatus || [], "payment_status")} |
| Most recent order | ${latestOrder?.[0]?.created_at || "None"} |`;

    // ── Query 6: visitor_sessions stats ──
    const { count: totalSessions } = await sb.from("visitor_sessions").select("id", { count: "exact", head: true });
    const { data: sessionsByStage } = await sb.from("visitor_sessions").select("stage");
    const { count: email1hr } = await sb.from("visitor_sessions").select("id", { count: "exact", head: true }).eq("email_1hr_sent", true);
    const { count: email24hr } = await sb.from("visitor_sessions").select("id", { count: "exact", head: true }).eq("email_24hr_sent", true);
    const { count: email48hr } = await sb.from("visitor_sessions").select("id", { count: "exact", head: true }).eq("email_48hr_sent", true);
    const { count: stripeClicked } = await sb.from("visitor_sessions").select("id", { count: "exact", head: true }).eq("stripe_link_clicked", true);

    const sessionStats = `| Metric | Value |
|--------|-------|
| Total sessions | ${totalSessions || 0} |
| By stage | ${countBy(sessionsByStage || [], "stage")} |
| 1hr email sent | ${email1hr || 0} |
| 24hr email sent | ${email24hr || 0} |
| 48hr email sent | ${email48hr || 0} |
| Stripe link clicked | ${stripeClicked || 0} |`;

    // ── Query 7: Schema info via direct queries ──
    const schemaTables = [
      "orders", "pits", "global_settings", "visitor_sessions", "delivery_leads",
      "city_pages", "payment_events", "user_roles", "waitlist_leads", "zip_tax_rates",
      "fraud_blocklist", "fraud_events", "payment_attempts", "reviews", "customers",
      "notifications", "blocked_ips", "tax_rates"
    ];

    let schemaSection = "";
    for (const tableName of schemaTables) {
      try {
        // Use a simple select to get column info — we'll query the table with limit 0 to see structure
        const { data: cols, error: colErr } = await sb.rpc("", {}).catch(() => ({ data: null, error: null }));
        // Since we can't query information_schema via JS client, we'll document based on what we can fetch
        const { data: sample } = await sb.from(tableName).select("*").limit(1);
        if (sample && sample.length > 0) {
          const columns = Object.keys(sample[0]);
          schemaSection += `\n### Table: \`${tableName}\`\n`;
          schemaSection += `| Column | Sample Type |\n|--------|------------|\n`;
          for (const col of columns.sort()) {
            const val = sample[0][col];
            const type = val === null ? "nullable" : typeof val;
            schemaSection += `| \`${col}\` | ${type} |\n`;
          }
        } else {
          // Empty table — just list it
          const { data: emptySample, error: emptyErr } = await sb.from(tableName).select("*").limit(0);
          schemaSection += `\n### Table: \`${tableName}\`\n*(Empty table — no columns inferred)*\n`;
        }
      } catch {
        schemaSection += `\n### Table: \`${tableName}\`\n*(Could not query)*\n`;
      }
    }

    // ── Query 8: All tables list ──
    const allTablesList = schemaTables.map(t => `- \`${t}\``).join("\n");

    // ── Query 9: reviews count ──
    let reviewCount = 0;
    try {
      const { count } = await sb.from("reviews").select("id", { count: "exact", head: true });
      reviewCount = count || 0;
    } catch { /* table may not exist */ }

    // ── Query 10: fraud_blocklist count ──
    let fraudBlockCount = 0;
    try {
      const { count } = await sb.from("fraud_blocklist").select("id", { count: "exact", head: true });
      fraudBlockCount = count || 0;
    } catch { /* */ }

    // ── ASSEMBLE DOCUMENT ──
    const doc = `# RIVERSAND.NET — COMPLETE PROJECT DOCUMENTATION
*Generated: ${now} — Live database snapshot*
*Supabase Project: lclbexhytmpfxzcztzva*
*GitHub: bayou0313/sand-nine-rivers*

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Routing & Pages](#2-routing--pages)
3. [Database Schema — Live Snapshot](#3-database-schema--live-snapshot)
4. [Global Settings — Live Values](#4-global-settings--live-values)
5. [Active PITs — Live State](#5-active-pits--live-state)
6. [Service ZIP Codes — Live State](#6-service-zip-codes--live-state)
7. [Edge Functions Inventory](#7-edge-functions-inventory)
8. [Pricing Engine](#8-pricing-engine)
9. [Order Flow](#9-order-flow)
10. [Session & Abandonment Tracking](#10-session--abandonment-tracking)
11. [City Pages & SEO](#11-city-pages--seo)
12. [Admin Dashboard (/leads)](#12-admin-dashboard-leads)
13. [Fraud System](#13-fraud-system)
14. [Review Collection](#14-review-collection)
15. [Design System & Brand](#15-design-system--brand)
16. [Utility Libraries & Key Components](#16-utility-libraries--key-components)
17. [Secrets & Environment](#17-secrets--environment)
18. [Live Order Stats](#18-live-order-stats)
19. [Live Session Stats](#19-live-session-stats)
20. [Known Issues & Pending Work](#20-known-issues--pending-work)
21. [DriveDigits Roadmap & WAYS Architecture](#21-drivedigits-roadmap--ways-architecture)

---

${ARCHITECTURE_OVERVIEW}

---

${ROUTING_PAGES}

---

## 3. Database Schema — Live Snapshot
*Queried: ${now}*

### Tables in public schema
${allTablesList}

${schemaSection}

---

## 4. Global Settings — Live Values
*Queried: ${now}*

${settingsTable}

---

## 5. Active PITs — Live State
*Queried: ${now}*

${pitsTable}

---

## 6. Service ZIP Codes — Live State
*Queried: ${now}*

**Total ZIPs:** ${(zipRates || []).length}

### By Parish
${zipParishTable}

**Full ZIP list (comma-separated):**
${allZips}

---

${EDGE_FUNCTIONS}

---

${PRICING_ENGINE}

---

${ORDER_FLOW}

---

${SESSION_TRACKING}

---

${CITY_PAGES_SEO}

### Active City Pages (${activeCount || 0} active, ${draftCount || 0} draft, ${waitlistCount || 0} waitlist)

Active slugs: ${activeSlugs}

---

${ADMIN_DASHBOARD}

---

${FRAUD_SYSTEM}

Additional stats: ${fraudBlockCount} entries in fraud_blocklist.

---

${REVIEW_COLLECTION}

Current review rows in DB: ${reviewCount}

---

${DESIGN_SYSTEM}

---

${UTILITY_LIBRARIES}

---

${SECRETS_ENV}

---

## 18. Live Order Stats
*Queried: ${now}*

${orderStats}

---

## 19. Live Session Stats
*Queried: ${now}*

${sessionStats}

---

${KNOWN_ISSUES}

---

${DRIVEDIGITS}

---

*End of documentation.*
*Generated from live Supabase state + hardcoded architectural knowledge.*
*Supabase Project: lclbexhytmpfxzcztzva*
*GitHub: bayou0313/sand-nine-rivers*
`;

    return new Response(doc, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="RIVERSAND_DOCS_${today}.md"`,
      },
    });
  } catch (err: any) {
    console.error("generate-docs error:", err);
    return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
  }
});
