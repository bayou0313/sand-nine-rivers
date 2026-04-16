
## Plan: v1.01 fix — execute spec as-is (CORRECTED)

### Files (3 only)
1. **`src/lib/generateProjectDocs.ts`** — full rewrite
2. **`src/pages/Leads.tsx`** — button label + filename only
3. **`supabase/functions/leads-auth/index.ts`** — add 3 actions only

### Corrections from prior plan
- **Section 23**: NOT truncated. Full JSX pattern content from `LOVABLE_PROMPT_v1.01_FIX.md` will be included verbatim. If template literal length is unwieldy, split into `SECTION_23_LEADS_DESIGN_A` and `SECTION_23_LEADS_DESIGN_B` (string concatenation) and join in assembly array. No placeholder markers, no omitted content.
- **Section 24**: NOT a placeholder. Added as locked module-level const `SECTION_24_DATA_FLOW` with the exact content provided (Customer Order Flow, Session & Abandonment Flow, Admin Access Flow ASCII diagrams), wrapped in fenced code blocks for markdown rendering.

### `generateProjectDocs.ts` (full rewrite)
- `export const DOC_VERSION = 'v1.01'` at top
- Delete `buildSchemaSection()` async function
- Module-level static consts verbatim from spec:
  - `SECTION_1_ARCHITECTURE`, `SECTION_2_ROUTING`, `SECTION_3_SCHEMA` (all 18 tables), `SECTION_7_EDGE_FUNCTIONS`, `SECTION_8_PRICING`, `SECTION_9_ORDER_FLOW`, `SECTION_10_SESSION`, `SECTION_12_ADMIN`, `SECTION_15_DESIGN`, `SECTION_16_UTILITIES`, `SECTION_17_SECRETS`, `SECTION_20_KNOWN_ISSUES`, `SECTION_21_SEO`, `SECTION_22_DRIVEDIGITS`
  - `SECTION_23_LEADS_DESIGN_A` + `SECTION_23_LEADS_DESIGN_B` (full content, split only if needed for write tool size)
  - `SECTION_24_DATA_FLOW` (full ASCII diagrams from user message)
- Live builders rewritten to use `leads-auth` with `sessionStorage.getItem('leads_password')`:
  - `buildSettingsSection()` → `list_settings`; fallback to anon `.limit(10000)` with public-only note
  - `buildOrderStatsSection()` → `get_order_stats`; fallback to inline RLS note
  - `buildSessionStatsSection()` → `get_session_stats`; fallback to inline RLS note
- Live builders kept: pits, zip_tax_rates (`.limit(10000)`, parish-grouped), city_pages (all statuses grouped)
- Header: `*Version: v1.01 — Year 1, Build 01*` + ISO timestamp
- Assembly order: 1, 2, 3, 4(live), 5(live pits), 6(live zips), 7, 8, 9, 10, 11(live city_pages), 12, 13(live), 14(live), 15, 16, 17, 18(live), 19(live), 20, 21, 22, 23A+23B, 24

### `Leads.tsx` (minimal)
- Import `DOC_VERSION`
- Filename: `RIVERSAND_${DOC_VERSION}_${date}.md`
- Button label: `Generate & Download — ${DOC_VERSION}`

### `leads-auth/index.ts` (additive — 3 new cases)
- `list_settings` → service-role `select * from global_settings order by key` after `validatePassword`
- `get_order_stats` → service-role aggregate (total, revenue, byStatus, byMethod, byPayStatus, latest)
- `get_session_stats` → service-role aggregate (total, byStage, email_1hr/24hr/48hr counts, stripeLinkClicked)
- No changes to existing actions

### Files NOT touched
stripe-webhook, send-email, generate-city-page, google-maps.ts, useGoogleMaps.ts, pits.ts, create_order RPC, all other edge functions/components. No DB migrations.

### Risk
- LOW: static consts are pure strings
- LOW: 3 new `leads-auth` actions are additive, password-gated, read-only
- NONE to: payments, orders RPC, Stripe, Maps, pricing, auth flow

### Post-deploy verification
1. `/leads` → Settings → click `Generate & Download — v1.01`
2. Filename = `RIVERSAND_v1.01_2026-04-16.md`
3. Section 3: all 18 tables verbatim
4. Section 4: ~75 settings keys, full untruncated values
5. Sections 18 + 19: real counts (not 0)
6. Section 23: full JSX patterns present, no placeholder markers
7. Section 24: full ASCII data flow diagrams present
8. Sections 1, 2, 7–10, 12, 15–17, 20–22: match spec verbatim
