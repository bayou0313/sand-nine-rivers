# COMPONENT_INVENTORY.md — riversand.net

**Complete File & Component Inventory**
Last Updated: March 30, 2026

---

## 1. Pages (`src/pages/`)

### Index.tsx
- **Route:** `/`
- **Purpose:** Homepage — landing page with SEO settings, session tracking, return visitor banner
- **Key State:** `session`, `returnAddress`, `seo` (Record<string, string>)
- **Supabase Queries:** `global_settings` (SEO keys via `.like("key", "seo_%")`)
- **Edge Functions:** None directly
- **External APIs:** None
- **Components Used:** Navbar, Hero, SocialProofStrip, Features, Testimonials, CTA, Pricing, FAQ, RiverSandInfo, ContactForm, Footer, MobilePhoneBar, ScrollToTop, WhatsAppButton, ReturnVisitorBanner
- **Notes:** Reads SEO settings from `global_settings` and injects into Helmet. Includes LocalBusiness and FAQ JSON-LD schema. Conditionally renders schemas based on `seo_schema_*` settings.

### Order.tsx
- **Route:** `/order`
- **Purpose:** Multi-step order flow: address → details → confirm → success
- **Key State:** `step`, `address`, `result` (EstimateResult), `form`, `paymentMethod`, `selectedDeliveryDate`, `quantity`, `matchedPit`, `globalPricing`, `allPits`, `customerCoords`, `confirmedTotals`
- **Supabase Queries:** `global_settings` (pricing), `pits` (active pits)
- **Edge Functions:** `create-checkout-link`, `send-email` (order confirmation), `generate-invoice`
- **External APIs:** Google Maps (Places Autocomplete, Distance Matrix, Geocoding)
- **URL Params:** `address`, `distance`, `price`, `duration`, `qty`, `discount`, `lead`, `utm_source`, `payment`, `order_number`, `session_id`, `return_mode`
- **Notes:** ~1500 lines. Handles Stripe checkout return (same-tab and cross-tab via localStorage signal). Tax calculation by parish. Processing fee (3.5%) for card payments. Invoice download support.

### CityPage.tsx
- **Route:** `/:citySlug/river-sand-delivery`
- **Purpose:** Dynamic SEO landing pages for city-specific river sand delivery
- **Key State:** `cityPage`, `loading`, `otherCities`
- **Supabase Queries:** `city_pages` (by slug, active), `city_pages` (other active cities, limit 5)
- **Edge Functions:** None
- **RPC Calls:** `increment_city_page_views(p_slug)`
- **Notes:** Renders structured content fields (`h1_text`, `hero_intro`). Multi-PIT cities suppress static price. Includes BreadcrumbList and LocalBusiness JSON-LD. Canonical URL. Links to 5 other city pages.

### Admin.tsx
- **Route:** `/admin`
- **Purpose:** Order management dashboard (authenticated, admin-only)
- **Key State:** `orders`, `filter`, `expandedOrder`, `paymentEvents`
- **Supabase Queries:** `orders` (all, ordered by delivery_date), `payment_events` (per order), `user_roles` (admin check)
- **Auth:** Supabase Auth — checks `user_roles` for admin role
- **Notes:** Status management (pending → confirmed → en_route → delivered → cancelled). Stats strip (total, pending, confirmed, delivered, revenue). Payment events expansion per order.

### AdminLogin.tsx
- **Route:** `/admin/login`
- **Purpose:** Admin authentication page
- **Key State:** `email`, `password`, `loading`
- **Supabase Queries:** `user_roles` (admin role check after login)
- **Auth:** `supabase.auth.signInWithPassword`
- **Notes:** Redirects to `/admin` on success. Signs out if non-admin user.

### Leads.tsx
- **Route:** `/leads`
- **Purpose:** Full admin dashboard — leads, PITs, city pages, sessions, cash orders, settings, SEO
- **Key State:** ~60+ state variables covering all dashboard sections
- **Supabase Queries:** Via `leads-auth` edge function for all data access
- **Edge Functions:** `leads-auth` (all actions), `abandonment-emails`, `generate-city-page`, `send-email`
- **External APIs:** Google Maps (Distance Matrix, Places Autocomplete for PIT addresses)
- **Auth:** Password-based via `leads-auth` edge function (LEADS_PASSWORD)
- **Nav Pages:** overview, zip, pipeline, revenue, cash_orders, abandoned, pit, city_pages, all, profile, settings
- **Notes:** ~4255 lines. Largest component. Handles city discovery, content generation queue, bulk operations, proposal emails, cash order management, SEO settings, and business profile editing.

### NotFound.tsx
- **Route:** `*` (catch-all)
- **Purpose:** 404 error page
- **Key State:** None
- **Notes:** Logs 404 path to console. Link back to home.

---

## 2. Components (`src/components/`)

### Hero.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `h1Override` | `string` | No | `"Same-Day River Sand Delivery"` |
| `subtitleOverride` | `string` | No | `"See your exact price in seconds — no account needed"` |
| `prefillAddress` | `string \| null` | No | `undefined` |

- **Purpose:** Hero section with parallax background, countdown timer, and embedded DeliveryEstimator
- **Dependencies:** framer-motion, lucide-react, DeliveryEstimator, useCountdown hook
- **Notes:** Uses `heroImage` from assets. Parallax via `useScroll`/`useTransform`.

### SocialProofStrip.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** 3-stat trust ribbon (500+ Loads, Same-Day, #1 Gulf South)
- **Dependencies:** framer-motion, lucide-react
- **Notes:** Placed between Hero and Features on homepage.

### Features.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** 4-card feature grid (Same-Day, Instant Quote, COD, Local & Reliable)
- **Dependencies:** framer-motion, lucide-react
- **Notes:** Staggered reveal animation. 2-col mobile, 4-col desktop.

### DeliveryEstimator.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `prefillAddress` | `string \| null` | No | `undefined` |
| `embedded` | `boolean` | No | `false` |

- **Purpose:** Address input with Google Maps autocomplete → price calculation → order link
- **Dependencies:** framer-motion, lucide-react, Google Maps API, supabase, OutOfAreaModal
- **Supabase Queries:** `global_settings`, `pits` (active)
- **External APIs:** Google Maps (Places Autocomplete, Distance Matrix, Geocoding)
- **Notes:** Uses `findBestPitDriving` from `src/lib/pits.ts`. Two display modes: embedded (hero) and standalone (section). Shows same-day cutoff info.

### DeliveryDatePicker.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `selectedDate` | `DeliveryDate \| null` | Yes | — |
| `onSelect` | `(d: DeliveryDate) => void` | Yes | — |
| `pitSchedule` | `PitSchedule \| null` | No | `undefined` |
| `globalSaturdaySurcharge` | `number` | No | `35` |

- **Purpose:** Horizontal date picker with 7-day lookahead, Saturday surcharge, same-day cutoff
- **Exported Types:** `DeliveryDate`, `PitSchedule`
- **Exported Functions:** `getAvailableDeliveryDates`, `getSameDayCutoffWarning`, `getEffectiveSaturdaySurcharge`
- **Exported Constants:** `SATURDAY_SURCHARGE` (35)
- **Notes:** Central Time zone aware. Respects PIT operating_days. Shows blocked days as disabled.

### Testimonials.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Customer reviews — 3-col grid desktop, single-card carousel mobile
- **Dependencies:** framer-motion, lucide-react
- **Notes:** 3 hardcoded testimonials. Star ratings. Mobile swipe navigation.

### CTA.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Call-to-action section — scrolls to estimator
- **Dependencies:** framer-motion, lucide-react

### Pricing.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** "How It Works" section with animated SVG map showing truck route from pit to destination
- **Dependencies:** framer-motion, lucide-react
- **Notes:** Complex SVG animation using `offsetPath`. Forward-only truck loop. Trust badges below.

### FAQ.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Accordion FAQ section with 12 questions
- **Dependencies:** framer-motion, Radix Accordion
- **Notes:** Hardcoded FAQ content. Staggered reveal animation.

### RiverSandInfo.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Educational content about river sand — collapsed by default with "Read more" toggle
- **Dependencies:** framer-motion, lucide-react
- **Key State:** `expanded` (boolean)
- **Notes:** Includes material comparison table, use/skip guide, volume calculator, project estimates.

### Navbar.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `solid` | `boolean` | No | `false` |
| `logoHref` | `string` | No | `"/"` |

- **Purpose:** Fixed navigation bar with scroll-based transparency transition
- **Dependencies:** framer-motion, lucide-react, react-router-dom
- **Notes:** Desktop: nav links + Order Now + phone button. Mobile: hamburger menu. Logo switches between inverted (transparent) and grayscale (solid).

### Footer.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Site footer with contact info, quick links, and region-grouped city page links
- **Dependencies:** framer-motion, lucide-react, react-router-dom, supabase
- **Supabase Queries:** `city_pages` (active, ordered by region + city_name)
- **Notes:** Parish/county-aware region labels. State-aware section heading ("PARISHES WE SERVE" for LA). 4-column responsive grid for regions. No query limit.

### ContactForm.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Contact form — sends email via edge function
- **Dependencies:** lucide-react, supabase
- **Edge Functions:** `send-email` (type: "contact")
- **Notes:** Fire-and-forget email send. Shows success state immediately.

### MobilePhoneBar.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Fixed bottom phone bar on mobile (hidden on lg+)
- **Notes:** Links to tel:+18554689297. Always visible on mobile.

### ScrollToTop.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Floating scroll-to-top button, appears after 400px scroll
- **Dependencies:** framer-motion, lucide-react

### WhatsAppButton.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Floating contact button — WhatsApp (mobile), callback request form (desktop), phone toggle
- **Dependencies:** framer-motion, lucide-react, supabase, date-fns
- **Edge Functions:** `send-email` (type: "callback")
- **Key State:** `mode` (whatsapp | phone | message), `showForm`, `callbackDate`, `timeWindow`
- **Notes:** Desktop shows callback request form with date/time picker. Mobile shows WhatsApp link. Toggle between modes. Business hours aware.

### ReturnVisitorBanner.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `session` | `{ visit_count, delivery_address?, calculated_price?, stage? } \| null` | Yes | — |
| `onRecalculate` | `(address: string) => void` | No | — |

- **Purpose:** Return visitor welcome banner with last address/price
- **Dependencies:** framer-motion, lucide-react, react-router-dom
- **Notes:** Shows only for visit_count > 1 with a saved address. Auto-dismisses after 10s. Different CTAs for checkout-stage vs price-stage visitors.

### OutOfAreaModal.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `open` | `boolean` | Yes | — |
| `onClose` | `() => void` | Yes | — |
| `address` | `string` | Yes | — |
| `distanceMiles` | `number` | Yes | — |
| `nearestPit` | `{ id: string; name: string; distance: number } \| null` | No | — |

- **Purpose:** Lead capture modal for out-of-area addresses
- **Dependencies:** Radix Dialog, supabase, sonner
- **Supabase Queries:** INSERT into `delivery_leads`
- **Edge Functions:** `send-email` (type: "out_of_area_lead")

### About.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** 4-card about section (Reliable Fleet, Local Team, Quality Material, Fast Turnaround)
- **Dependencies:** framer-motion, lucide-react
- **Notes:** Used on CityPage, not on Index.

### Stats.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| (none) | — | — | — |

- **Purpose:** Single-line tagline banner on primary background
- **Dependencies:** framer-motion
- **Notes:** Used on CityPage. Text: "Local. Same-day. Real river sand direct from the Mississippi."

### EmailInput.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `value` | `string` | Yes | — |
| `onChange` | `(value: string) => void` | Yes | — |
| `placeholder` | `string` | No | `"john@example.com"` |
| `required` | `boolean` | No | — |
| `className` | `string` | No | — |
| `maxLength` | `number` | No | `255` |
| `id` | `string` | No | — |
| `name` | `string` | No | — |

- **Purpose:** Email input with domain autocomplete suggestions
- **Notes:** Suggests gmail.com, yahoo.com, aol.com, outlook.com, hotmail.com, icloud.com after `@`.

### NavLink.tsx
| Prop | Type | Required | Default |
|------|------|----------|---------|
| `className` | `string` | No | — |
| `activeClassName` | `string` | No | — |
| `pendingClassName` | `string` | No | — |
| `to` | `string` | Yes | — |

- **Purpose:** Wrapper around react-router-dom NavLink with className convenience props
- **Notes:** Not currently used in any visible component.

---

## 3. Shared Libraries (`src/lib/`)

### pits.ts
**Exported Types:**
- `PitData` — PIT location with pricing fields
- `GlobalPricing` — System-wide pricing defaults
- `EffectivePricing` — Merged PIT + global pricing
- `FindBestPitResult` — Result of best-PIT search

**Exported Constants:**
- `FALLBACK_GLOBAL_PRICING` — Hardcoded fallbacks: base=$195, free=15mi, extra=$5/mi, max=30mi, sat=$35

**Exported Functions:**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `parseGlobalSettings` | `(rows: {key, value}[]) => GlobalPricing` | Parse global_settings rows into pricing object |
| `haversineDistance` | `(lat1, lon1, lat2, lon2) => number` | Straight-line distance in miles |
| `getEffectivePrice` | `(pit: PitData, global: GlobalPricing) => EffectivePricing` | Merge PIT overrides with global defaults (null = use global) |
| `calcPitPrice` | `(effective, distance, qty) => number` | **Price formula:** `max(base_price, round(base_price + max(0, distance - free_miles) * extra_per_mile)) * qty` |
| `calcFinalPrice` | `(effective, distance, qty, isSaturday) => number` | Price + Saturday surcharge (per order, not per load) |
| `findBestPit` | `(pits, lat, lng, globalPricing) => FindBestPitResult \| null` | Haversine-based nearest serviceable PIT |
| `findBestPitDriving` | `(pits, lat, lng, globalPricing, apiKey) => Promise<FindBestPitResult \| null>` | Driving distance via Google Distance Matrix. Pre-filters to top 5 by Haversine. Falls back to `findBestPit` on API failure. |

### session.ts
**Exported Functions:**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getSessionToken` | `() => string` | Get/create UUID session token in localStorage |
| `initSession` | `() => Promise<void>` | Upsert visitor_sessions row |
| `updateSession` | `(updates: Record<string, any>) => Promise<void>` | Update session with stage/address/price data |
| `getSession` | `() => Promise<any \| null>` | Fetch current session row |
| `incrementVisitCount` | `() => Promise<void>` | Call `increment_visit_count` RPC |

### analytics.ts
**Exported Functions:**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `trackEvent` | `(eventName: string, params?: Record<string, any>) => void` | Push event to GTM dataLayer |

**Notes:** All analytics routed through Google Tag Manager. Fails silently if dataLayer unavailable.

### format.ts
**Exported Functions:**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `formatPhone` | `(value: string) => string` | Format to `(xxx) xxx-xxxx` |
| `stripPhone` | `(value: string) => string` | Strip to digits only |
| `formatCurrency` | `(amount: number) => string` | Format to `$1,234.56` |
| `getTaxRateFromAddress` | `(address: string) => { rate, parish }` | Parse parish from address text, return tax rate |
| `getParishFromPlaceResult` | `(addressComponents) => string \| null` | Extract parish from Google Maps place result |
| `getTaxRateByParish` | `(parishName: string) => { rate, parish }` | Look up tax rate by parish name |

**Parish Tax Rates:** Jefferson (9.75%), Orleans (10%), St. Bernard (10%), St. Charles (10%), St. Tammany (9.25%), Plaquemines (9.75%), St. John the Baptist (10.25%), St. James (8.5%), Lafourche (9.7%), Tangipahoa (9.45%). Default: 9.75%.

**City-to-Parish Mapping:** 20 cities mapped (New Orleans → Orleans, Metairie → Jefferson, Slidell → St. Tammany, etc.)

### utils.ts
- Standard shadcn `cn()` utility (clsx + tailwind-merge)

---

## 4. Edge Functions (`supabase/functions/`)

### generate-city-page
- **Purpose:** Generate AI-powered city landing page content
- **Auth:** Service role key (internal use)
- **API:** Anthropic Claude Sonnet (`claude-sonnet-4-5`) via ANTHROPIC_API_KEY
- **System Prompt:** Lander agent identity — riversand.net's dedicated SEO and conversion agent
- **Input:** City data (name, state, region, distance, price, pit_name)
- **Output:** JSON with 6 structured fields: `hero_intro`, `why_choose_intro`, `delivery_details`, `local_uses`, `local_expertise`, `faq_items`
- **Secrets:** ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY
- **Recent Changes:** March 30, 2026 — switched from Lovable AI Gateway to Anthropic API with Lander system prompt

### leads-auth
- **Purpose:** Admin dashboard backend — all protected operations
- **Auth:** Password-based (LEADS_PASSWORD secret)
- **Actions:** `list`, `toggle_contacted`, `update_stage`, `update_note`, `save_settings_bulk`, `list_pits`, `save_pit`, `delete_pit`, `activate_pit_leads`, `send_proposals`, `send_quick_proposal`, `list_abandoned`, `list_cash_orders`, `mark_cash_paid`, `list_city_pages`, `create_city_pages`, `update_city_page`, `delete_city_pages`, `generate_city_content`, `discover_cities`, `deduplicate_city_pages`, `delete_all_city_pages`, `recalculate_city_prices`
- **External APIs:** Google Maps (GOOGLE_MAPS_SERVER_KEY) — Places, Geocoding
- **Secrets:** LEADS_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_SERVER_KEY, RESEND_API_KEY

### create-checkout-link
- **Purpose:** Create Stripe Checkout session for card payments
- **Auth:** None (public)
- **Secrets:** STRIPE_SECRET_KEY

### stripe-webhook
- **Purpose:** Handle Stripe webhook events (payment confirmation)
- **Auth:** Stripe webhook signature (STRIPE_WEBHOOK_SECRET)
- **Secrets:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

### create-payment-intent
- **Purpose:** Create Stripe payment intent (legacy/alternate flow)
- **Secrets:** STRIPE_SECRET_KEY

### send-email
- **Purpose:** Send transactional emails
- **Email Types:** `order_confirmation`, `contact`, `out_of_area_lead`, `callback`, `proposal`, `cash_payment_confirmation`
- **Secrets:** RESEND_API_KEY

### abandonment-emails
- **Purpose:** Process and send abandonment recovery emails (1hr, 24hr, 72hr)
- **Secrets:** RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY

### generate-invoice
- **Purpose:** Generate PDF invoice for completed orders
- **Secrets:** SUPABASE_SERVICE_ROLE_KEY

### generate-sitemap
- **Purpose:** Dynamic XML sitemap generation including city pages
- **Auth:** None (public)
- **Secrets:** SUPABASE_SERVICE_ROLE_KEY

### get-order-status
- **Purpose:** Public order status lookup by confirmation token
- **Auth:** None (public)

---

## 5. Configuration Files

### vercel.json
```json
{
  "rewrites": [
    { "source": "/sitemap.xml", "destination": "https://[supabase-ref].supabase.co/functions/v1/generate-sitemap" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
```
- Sitemap proxy to edge function
- SPA fallback for client-side routing

### vite.config.ts
- React SWC plugin
- Path alias: `@` → `./src`
- Port: 8080
- HMR overlay disabled
- React deduplication
- Lovable tagger in dev mode

### tailwind.config.ts
- **Fonts:** `display` = Bebas Neue, `body` = Inter
- **Custom Colors:** `sand.light`, `sand.dark`, full sidebar theme
- **All colors use HSL CSS variables** from index.css
- **Plugins:** tailwindcss-animate

### tsconfig.json / tsconfig.app.json / tsconfig.node.json
- Standard Vite + React TypeScript configuration
- Path mapping: `@/*` → `./src/*`

### components.json
- shadcn/ui configuration

### eslint.config.js
- React hooks + refresh plugins

### vitest.config.ts / playwright.config.ts
- Test configurations (Vitest for unit, Playwright for e2e)

---

## 6. Hooks (`src/hooks/`)

### use-countdown.ts
- **Purpose:** Live countdown timer for same-day delivery cutoff
- **Returns:** `{ timeLeft, label, nextDay }`
- **Logic:** Cutoff at 10 AM. Handles weekday/Saturday/Sunday transitions. Updates every second.

### use-mobile.tsx
- **Purpose:** Responsive breakpoint detection
- **Returns:** `boolean` (true if mobile viewport)

### use-toast.ts
- **Purpose:** Toast notification hook (shadcn)

---

## 7. Dependency List

### Production Dependencies
| Package | Version |
|---------|---------|
| @hookform/resolvers | ^3.10.0 |
| @radix-ui/* (17 packages) | Various ^1.x |
| @stripe/react-stripe-js | ^6.0.0 |
| @stripe/stripe-js | ^9.0.0 |
| @supabase/supabase-js | ^2.100.0 |
| @tanstack/react-query | 5.62.0 |
| @types/google.maps | ^3.58.1 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| cmdk | ^1.1.1 |
| date-fns | ^3.6.0 |
| embla-carousel-react | ^8.6.0 |
| framer-motion | ^12.38.0 |
| input-otp | ^1.4.2 |
| lucide-react | ^0.462.0 |
| next-themes | ^0.3.0 |
| react | ^18.3.1 |
| react-day-picker | ^8.10.1 |
| react-dom | ^18.3.1 |
| react-helmet-async | ^3.0.0 |
| react-hook-form | ^7.61.1 |
| react-resizable-panels | ^2.1.9 |
| react-router-dom | ^6.30.1 |
| recharts | ^2.15.4 |
| sonner | ^1.7.4 |
| tailwind-merge | ^2.6.0 |
| tailwindcss-animate | ^1.0.7 |
| vaul | ^0.9.9 |
| zod | ^3.25.76 |

### Dev Dependencies
| Package | Version |
|---------|---------|
| @eslint/js | ^9.32.0 |
| @playwright/test | ^1.57.0 |
| @tailwindcss/typography | ^0.5.16 |
| @testing-library/jest-dom | ^6.6.0 |
| @testing-library/react | ^16.0.0 |
| @types/node | ^22.16.5 |
| @types/react | ^18.3.23 |
| @types/react-dom | ^18.3.7 |
| @vitejs/plugin-react-swc | ^3.11.0 |
| autoprefixer | ^10.4.21 |
| eslint | ^9.32.0 |
| eslint-plugin-react-hooks | ^5.2.0 |
| eslint-plugin-react-refresh | ^0.4.20 |
| globals | ^15.15.0 |
| jsdom | ^20.0.3 |
| lovable-tagger | ^1.1.13 |
| postcss | ^8.5.6 |
| tailwindcss | ^3.4.17 |
| typescript | ^5.8.3 |
| typescript-eslint | ^8.38.0 |
| vite | ^5.4.19 |
| vitest | ^3.2.4 |

---

## 8. Known Issues & Technical Debt

### Code Organization
1. **Leads.tsx is ~4255 lines** — should be split into sub-components (PIT management, city pages, sessions, cash orders, SEO settings, etc.)
2. **Order.tsx is ~1500 lines** — step components should be extracted
3. **`(supabase as any)` casts** used throughout to work around TypeScript strict typing on tables — should use proper typed queries
4. **NavLink.tsx is unused** — dead code that can be removed

### Architecture
5. **Dual admin dashboards** — Admin.tsx (order management) and Leads.tsx (everything else) are separate authenticated systems with different auth mechanisms (Supabase Auth vs password)
6. **Google Maps script loaded multiple times** — DeliveryEstimator.tsx and Order.tsx both independently load the Google Maps script; should use a shared loader
7. **Hardcoded phone number** — `1-855-GOT-WAYS` / `+18554689297` appears in multiple components; should be a global constant or setting
8. **Hardcoded WhatsApp number** — `15043582000` in WhatsAppButton.tsx

### Data
9. **No query limit on Footer city links** — fetches all active city pages; may need pagination if city count grows large
10. **Parish tax rates hardcoded** — `format.ts` contains static tax rates; should be in `global_settings`
11. **Testimonials hardcoded** — should be dynamic from database for easy updates

### Security
12. **LEADS_PASSWORD is single shared password** — not per-user; should migrate to Supabase Auth for leads dashboard
13. **Google Maps API key exposed in client** — browser key has referrer restrictions but is visible in source

### Legacy
14. **LOVABLE_API_KEY** — no longer used for AI generation (replaced by ANTHROPIC_API_KEY); can be removed
15. **GMAIL_USER / GMAIL_APP_PASSWORD** — legacy email fallback; should be removed if Resend is sole provider

---

*Generated by Lovable — March 30, 2026*
