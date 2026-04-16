import{s as d}from"./index-COgl_dQB.js";const g=["orders","pits","global_settings","visitor_sessions","delivery_leads","city_pages","payment_events","user_roles","waitlist_leads","zip_tax_rates","fraud_blocklist","fraud_events","payment_attempts","reviews","customers","notifications","blocked_ips","tax_rates"],h=`## 1. Architecture Overview

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
`,y="## 2. Routing & Pages\n\n| Route | Component | Purpose |\n|-------|-----------|---------|\n| `/` | Index.tsx / HomeMobile.tsx | Landing page (mobile/desktop split via useIsMobile) |\n| `/order` | Order.tsx / OrderMobile.tsx | Checkout wizard with day-aware PIT routing |\n| `/order?reschedule=true&token=` | Order.tsx | Reschedule mode for existing orders |\n| `/leads` | Leads.tsx | LMT admin dashboard (password: LEADS_PASSWORD) |\n| `/admin` | Admin.tsx | Authenticated admin (Supabase Auth, has_role('admin')) |\n| `/admin/login` | AdminLogin.tsx | Admin sign-in |\n| `/review/:token` | Review.tsx | Customer review collection (24hr post-delivery) |\n| `/:citySlug` | CityPage.tsx | Programmatic SEO city pages (37 active cities) |\n| `/*` | NotFound.tsx | 404 |\n\n**Mobile detection:** 3-signal approach (viewport <768px, touch <1024px, UA string) with `?force_desktop=1` override.\n",f="## 7. Edge Functions Inventory\n\n| Function | Purpose | verify_jwt |\n|----------|---------|------------|\n| `leads-auth` | Admin authentication, lead CRUD, fraud checks, order cancellation | false |\n| `stripe-webhook` | Payment intent lifecycle, card capture, order resolution | false |\n| `create-payment-intent` | Auth-hold or immediate-capture based on customer_tier | false |\n| `create-checkout-link` | Stripe Checkout Session for abandonment recovery | false |\n| `capture-payments` | Manual capture for Tier-1 orders post-delivery | false |\n| `create-refund` | Stripe refund + order status update | false |\n| `generate-invoice` | PDF invoice (monochrome layout, separated taxes) | false |\n| `send-email` | Resend transactional dispatcher (branded templates) | false |\n| `email-inbound` | Resend webhook → forward to dispatch (loop prevention) | false |\n| `abandonment-emails` | Hourly pg_cron (1h/24h/48h/72h sequences with discounts) | false |\n| `generate-city-page` | Claude 4.5 Haiku content generation (Lander v4) | false |\n| `generate-sitemap` | Live sitemap.xml from city_pages | false |\n| `submit-sitemap` | Daily IndexNow + GSC ping | false |\n| `get-maps-key` | Returns scoped GOOGLE_MAPS_BROWSER_KEY | false |\n| `get-order-status` | Public order lookup by token | false |\n| `generate-docs` | (DEPRECATED — replaced by client-side generator) | false |\n",_=`## 8. Pricing Engine

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
`,S=`## 9. Order Flow

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
`,b=`## 10. Session & Abandonment

**visitor_sessions** captures every visit with IP enrichment (ipapi.co), B2B detection regex, geo data, entry page/city, and serviceability flag.

**Abandonment sequence (hourly pg_cron \`0 * * * *\`):**
- 1hr: gentle nudge ("Still need that sand?")
- 24hr: $10 discount offer
- 48hr: $20 discount + Stripe Checkout link
- 72hr: final $25 + sales human follow-up

Discounts enforced server-side via Stripe Checkout Session metadata (never client-side params).

**Stage progression:** \`visited\` → \`address_entered\` → \`payment_selected\` → \`order_placed\` (or \`abandoned\` after 1hr without progression).
`,v=`## 12. Admin Dashboard (/leads)

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
`,w=`## 15. Design System & Brand

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
`,E="## 16. Utility Libraries\n\n| File | Purpose |\n|------|---------|\n| `src/lib/pits.ts` | **PROTECTED** — core pricing engine, findAllPitDistances |\n| `src/lib/google-maps.ts` | **PROTECTED** — Maps API loader |\n| `src/hooks/useGoogleMaps.ts` | **PROTECTED** — autocomplete hook |\n| `src/lib/cart.ts` | localStorage cart persistence (24hr TTL) |\n| `src/lib/format.ts` | Currency, distance, date formatters |\n| `src/lib/textFormat.ts` | formatProperName + corporate designator standardization |\n| `src/lib/session.ts` | visitor_sessions wrapper |\n| `src/lib/analytics.ts` | GTM dataLayer push with No-Track guard |\n| `src/lib/palettes.ts` | 5 brand palettes + slug-hash assignment |\n| `src/hooks/useBusinessSettings.ts` | global_settings cache (module-level) |\n| `src/hooks/useBrandPalette.ts` | Per-page palette selection |\n| `src/hooks/use-countdown.ts` | Same-day cutoff timer |\n",P=`## 17. Secrets & Environment

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
`,A=`## 20. Known Issues & Pending Work

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
`,T=`## 21. SEO Issues & Crawl Fixes

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
`,O=`## 22. DriveDigits Roadmap

(Future multi-tenant analytics platform — placeholder section)

- Phase 1: tenant_id schema migration (all tables)
- Phase 2: per-tenant subdomain routing
- Phase 3: tenant-scoped admin dashboard
- Phase 4: shared service catalog with tenant overrides
- Phase 5: cross-tenant analytics for ways.us master brand
`,k=`## 23. /leads UI Design System

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
`,C=`## 24. Data Flow Diagrams

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
`;function p(t){return String(t??"").replace(/\|/g,"\\|").replace(/\n/g," ")}function u(t,i){const s=i instanceof Error?i.message:String(i);return`
> ⚠️ **${t} fetch failed:** ${s}
`}async function D(){const t=g.map(async s=>{try{const{data:a,error:e}=await d.rpc("get_table_schema",{p_table:s});if(e)throw e;const r=a??[];if(r.length===0)return`### Table: \`${s}\`

*(empty or inaccessible)*
`;const o=`### Table: \`${s}\`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
`,n=r.map(c=>`| ${p(c.column_name)} | ${p(c.data_type)} | ${p(c.is_nullable)} | ${p(c.column_default??"")} |`).join(`
`);return o+n+`
`}catch(a){return`### Table: \`${s}\`
${u(s,a)}`}});return`## 3. Database Schema (Live)

${(await Promise.all(t)).join(`
`)}`}async function I(){try{const{data:t,error:i}=await d.from("global_settings").select("key, value, description").order("key",{ascending:!0}).limit(1e4);if(i)throw i;const s=t??[];if(s.length===0)return`## 4. Global Settings (Live)

*(no settings found)*
`;const a=`## 4. Global Settings (Live)

**Total keys:** ${s.length}

| Key | Value | Description |
|-----|-------|-------------|
`,e=s.map(r=>`| ${p(r.key)} | ${p(r.value)} | ${p(r.description??"")} |`).join(`
`);return a+e+`
`}catch(t){return`## 4. Global Settings (Live)
${u("global_settings",t)}`}}async function R(){try{const{data:t,error:i}=await d.from("pits").select("*").order("name",{ascending:!0}).limit(1e4);if(i)throw i;const s=t??[];if(s.length===0)return`## 5. Active PITs (Live)

*(no pits found)*
`;let a=`## 5. Active PITs (Live)

**Total PITs:** ${s.length}

`;for(const e of s)a+=`### ${e.name} ${e.status!=="active"?`(${e.status})`:""}

`,a+=`- **Address:** ${e.address}
`,a+=`- **Coordinates:** ${e.lat}, ${e.lon}
`,a+=`- **Base Price:** $${e.base_price??"—"} | **Free Miles:** ${e.free_miles??"—"} | **$/extra mile:** $${e.price_per_extra_mile??"—"}
`,a+=`- **Max Distance:** ${e.max_distance??"—"} mi
`,a+=`- **Operating Days:** ${Array.isArray(e.operating_days)?e.operating_days.join(","):"—"}
`,a+=`- **Saturday Surcharge Override:** $${e.saturday_surcharge_override??"—"} | **Sunday Surcharge:** $${e.sunday_surcharge??"—"}
`,a+=`- **Sat Load Limit:** ${e.saturday_load_limit??"—"} | **Sun Load Limit:** ${e.sunday_load_limit??"—"}
`,a+=`- **Same-Day Cutoff:** ${e.same_day_cutoff??"—"}
`,a+=`- **Default:** ${e.is_default} | **Pickup Only:** ${e.is_pickup_only}
`,e.notes&&(a+=`- **Notes:** ${e.notes}
`),a+=`
`;return a}catch(t){return`## 5. Active PITs (Live)
${u("pits",t)}`}}async function L(){try{const{data:t,error:i}=await d.from("zip_tax_rates").select("zip_code, tax_region_name, combined_rate, state_rate, local_rate").order("zip_code",{ascending:!0}).limit(1e4);if(i)throw i;const s=t??[];if(s.length===0)return`## 6. Service ZIP Codes (Live)

*(no ZIPs found)*
`;const a=new Map;for(const o of s){const n=o.tax_region_name||"Unknown";a.has(n)||a.set(n,{zips:[],rate:o.combined_rate}),a.get(n).zips.push(o.zip_code)}const e=[...a.entries()].sort(([o],[n])=>o.localeCompare(n));let r=`## 6. Service ZIP Codes (Live)

**Total ZIPs:** ${s.length}

### By Parish/Region

| Parish/Region | ZIP Count | Combined Rate |
|---------------|-----------|---------------|
`;for(const[o,n]of e)r+=`| ${p(o)} | ${n.zips.length} | ${(n.rate*100).toFixed(3)}% |
`;return r+=`
**Full ZIP list (comma-separated):**

${s.map(o=>o.zip_code).join(", ")}
`,r}catch(t){return`## 6. Service ZIP Codes (Live)
${u("zip_tax_rates",t)}`}}async function x(){try{const{data:t,error:i}=await d.from("city_pages").select("city_slug, status, region, page_views").limit(1e4);if(i)throw i;const s=t??[];if(s.length===0)return`## 11. City Pages & SEO (Live)

*(no city pages found)*
`;const a={};for(const r of s){const o=r.status||"unknown";a[o]||(a[o]=[]),a[o].push(r.city_slug)}Object.values(a).forEach(r=>r.sort());let e=`## 11. City Pages & SEO (Live)

**Total pages:** ${s.length}

`;for(const r of Object.keys(a).sort())e+=`### ${r.charAt(0).toUpperCase()+r.slice(1)} (${a[r].length})

`,e+=a[r].map(o=>`\`${o}\``).join(", ")+`

`;return e}catch(t){return`## 11. City Pages & SEO (Live)
${u("city_pages",t)}`}}async function $(){try{const{count:t,error:i}=await d.from("fraud_blocklist").select("*",{count:"exact",head:!0});if(i)throw i;return`## 13. Fraud System (Live)

**Active blocklist entries:** ${t??0}

See \`mem://features/lead-and-fraud-management\` for full architecture.
`}catch(t){return`## 13. Fraud System (Live)
${u("fraud_blocklist",t)}`}}async function N(){try{const{count:t,error:i}=await d.from("reviews").select("*",{count:"exact",head:!0});if(i)throw i;return`## 14. Review Collection (Live)

**Total reviews captured:** ${t??0}

Automated 24hr post-delivery requests; 4+ stars redirect to Google My Business.
`}catch(t){return`## 14. Review Collection (Live)
${u("reviews",t)}`}}async function M(){try{const{data:t,error:i}=await d.from("orders").select("status, payment_method, payment_status, price, created_at").limit(1e5);if(i)throw i;const s=t??[],a=s.length,e=s.reduce((l,m)=>l+Number(m.price||0),0),r={},o={},n={};for(const l of s)r[l.status]=(r[l.status]||0)+1,o[l.payment_method]=(o[l.payment_method]||0)+1,n[l.payment_status]=(n[l.payment_status]||0)+1;let c=`## 18. Live Order Stats

`;c+=`**Total orders:** ${a}
`,c+=`**Total revenue (gross):** $${e.toFixed(2)}

`,c+=`### By Status

`;for(const[l,m]of Object.entries(r).sort())c+=`- ${l}: ${m}
`;c+=`
### By Payment Method

`;for(const[l,m]of Object.entries(o).sort())c+=`- ${l}: ${m}
`;c+=`
### By Payment Status

`;for(const[l,m]of Object.entries(n).sort())c+=`- ${l}: ${m}
`;return c+`
`}catch(t){return`## 18. Live Order Stats
${u("orders",t)}`}}async function B(){try{const{data:t,error:i}=await d.from("visitor_sessions").select("stage, serviceable, ip_is_business").limit(1e5);if(i)throw i;const s=t??[],a=s.length,e={};let r=0,o=0;for(const c of s){const l=c.stage||"unknown";e[l]=(e[l]||0)+1,c.serviceable&&r++,c.ip_is_business&&o++}let n=`## 19. Live Session Stats

`;n+=`**Total sessions:** ${a}
`,n+=`**Serviceable (in-area):** ${r}
`,n+=`**Business IPs:** ${o}

`,n+=`### By Stage

`;for(const[c,l]of Object.entries(e).sort())n+=`- ${c}: ${l}
`;return n+`
`}catch(t){return`## 19. Live Session Stats
${u("visitor_sessions",t)}`}}async function F(){const[t,i,s,a,e,r,o,n,c]=await Promise.all([D(),I(),R(),L(),x(),$(),N(),M(),B()]);return[`# RIVERSAND.NET — COMPLETE PROJECT DOCUMENTATION

*Generated: ${new Date().toISOString()} — Live database snapshot*
*Supabase Project: lclbexhytmpfxzcztzva*
*GitHub: bayou0313/sand-nine-rivers*

---

`,h,y,t,i,s,a,f,_,S,b,e,v,r,o,w,E,P,n,c,A,T,O,k,C].join(`
---

`)}export{F as generateProjectDocs};
