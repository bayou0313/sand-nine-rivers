

The user wants me to review the prompt before sending it to Lovable. Let me check the current state of GTM injection.
<lov-tool-use id="toolu_vrtx_01LFXUzrQiMo6dTAQfZfB9Kj" name="code--search_files" integration-id="code" data="{\"query\": \"GTM-KPKFPCXM|gtm.js|seo_gtm\", \"include_patterns\": \"*.html,*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013EqtcM4CWxakJHdYqmBcwb" name="code--search_files" integration-id="code" data="{\"query\": \"GTM-KPKFPCXM|gtm\\\\.js|seo_gtm\", \"include_patterns\": \"*.html,*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Acc5izsTknVqnWM9g43itK" name="code--search_files" integration-id="code" data="{\"query\": \"seo_gbp_reviews_enabled|seo_gbp_url|gmb_review_url|seo_clarity\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017zSde5zto8NUx8noJ1wKTB" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Leads.tsx\", \"lines\": \"4940-5050\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TRGXswWzKRMUr2eAbSiuWY" name="code--search_files" integration-id="code" data="{\"query\": \"save_settings|saveSeoSettings\", \"include_patterns\": \"src/pages/Leads.tsx,supabase/functions/leads-auth/index.ts\"}">
</lov-tool-use>
I have enough context. Now I'll review the proposed changes against the codebase and present the plan.

<lov-plan>

## Review Notes (critical findings)

**1. GTM is currently injected in `index.html` (lines 5-15) with hardcoded `GTM-KPKFPCXM`.** The `seo_gtm_id` key in `global_settings` does NOT drive the live site — it's a stale reference field. The user's instinct here is correct: making the Settings card actually do something requires removing the static snippet and injecting dynamically.

**2. Index.tsx already fetches `seo_*` settings** (`fetchSeo` effect, line ~80) — easy to hook GTM injection into existing `seo` state.

**3. `seo_gtm_container_id` does not exist** in DB. Only `seo_gtm_id` exists. The user's spec asks for both, but adding a second key creates a sync problem. Recommend: keep `seo_gtm_id` as the single canonical key, drop the `seo_gtm_container_id` rename.

**4. `OrderMobile.tsx` is a separate top-level page** (mobile users land here, not Index.tsx) — it must also inject GTM, otherwise mobile traffic loses analytics.

**5. `save_settings` action already accepts arbitrary keys** — confirmed in leads-auth line 1559. New `seo_clarity_id` flows through `saveSeoSettings` automatically. No new save action needed.

**6. Existing scattered Google fields at lines 4961-4997** (GSC, GTM, GA4, GBP URL, Reviews toggle) — these get consolidated into the new card.

---

## Plan: Dynamic GTM + Google & Analytics Integrations Card

### Files modified (4)

**1. `supabase/migrations/<new>.sql`** — Seed Clarity key only (drop the GTM key duplication)
```sql
INSERT INTO global_settings (key, value, description, is_public) VALUES
  ('seo_clarity_id', '', 'Microsoft Clarity project ID', false)
ON CONFLICT (key) DO NOTHING;
```
*Skipping `seo_gtm_container_id` — `seo_gtm_id` is the canonical key already in use.*

**2. `index.html`** — Remove hardcoded GTM snippet (lines 5-15). Replace with comment placeholder noting injection is now handled in React.

**3. `src/pages/Index.tsx`** — Add `useEffect` after `seo` state populates: read `seo.seo_gtm_id`, skip if path starts with `/leads` or `/admin`, inject `<script id="gtm-script">` into `<head>` and `<noscript>` iframe into top of `<body>`. Idempotency guard via `getElementById("gtm-script")`.

**4. `src/pages/OrderMobile.tsx`** — Same GTM injection effect (mobile users hit this route directly via `HomeMobile.tsx`).

**5. `supabase/functions/leads-auth/index.ts`** — Add `check_google_integrations` action (purely additive). Validates GTM via `fetch(googletagmanager.com/gtm.js?id=...)`, GA4 via `/^G-[A-Z0-9]+$/` regex, Clarity via `fetch(clarity.ms/tag/...)`, GMB via `HEAD` request. Returns `{success, results: {gtm, ga4, clarity, gmb}}`.

**6. `src/pages/Leads.tsx`** — Replace lines 4961-4997 (existing scattered Google + GBP sections) with one consolidated **GOOGLE & ANALYTICS INTEGRATIONS** card containing:
- Inputs (all bound to existing `seoSettings` state, saved via existing `saveSeoSettings`):
  - GTM Container ID → `seo_gtm_id` (keep canonical key)
  - GA4 Measurement ID → `seo_ga4_id`
  - GA4 Property ID → `seo_ga4_property_id` (reference, no status)
  - GSC Verification ID → `seo_gsc_id` (reference, no status)
  - GMB Review URL → `gmb_review_url`
  - GBP URL → `seo_gbp_url`
  - Microsoft Clarity ID → `seo_clarity_id` (NEW)
  - Show Google Reviews toggle → `seo_gbp_reviews_enabled` (relocated)
- Status dot per checkable field: 🟢 connected / 🔴 invalid / ⚪ not set / 🟡 checking
- "Check All Connections" button (BRAND_GOLD) — invokes `check_google_integrations`, auto-runs on mount if any field populated
- Per-field `RefreshCw` icon (BRAND_NAVY ghost) — re-checks single field
- Per-field `ExternalLink` icon → opens GTM/GA4/GSC/Clarity dashboards or value-as-URL for GMB/GBP

### Files NOT touched
- `analytics.ts`, `lib/analytics.ts` no-track guard
- `stripe-webhook`, `send-email`, `generate-city-page`, `pits.ts`, `create_order` RPC
- All other `leads-auth` actions
- `generateProjectDocs.ts`
- Hardcoded GTM reference in `generateProjectDocs.ts` line 74 (cosmetic only, used in docs)

### Risk profile
- **MEDIUM**: GTM injection move from static HTML to React. Risk: brief delay (~200-500ms) before GTM loads as React hydrates and `seo` settings fetch completes. Mitigation: dual-page parity (Index + OrderMobile), idempotency guard prevents double-injection.
- **LOW**: All other changes additive (new edge function action, new Settings card UI).

### Deviations from user's spec (intentional)
1. **No `seo_gtm_container_id`** — using existing `seo_gtm_id` to avoid dual-key drift. SQL `UPDATE` statements in user's spec become unnecessary.
2. **Added `OrderMobile.tsx`** to GTM injection list — user's spec missed this and would break mobile analytics.
3. **GMB `HEAD` fetch may fail** for some Google short URLs (CORS-less server-side fetch is fine, but Google sometimes 405s on HEAD). Falling back to `GET` if HEAD returns non-2xx.

### Post-deploy verification
1. Hard-refresh homepage on desktop → DevTools Network shows `gtm.js?id=GTM-KPKFPCXM` loaded
2. Visit `/leads` → confirm GTM does NOT load (no-track guard)
3. Mobile preview homepage → GTM loads
4. Settings → enter `xxxxxxxxxx` Clarity ID, click Check All → 4 dots populate
5. Save settings → reload → values persist
6. Change GTM ID to invalid value → status dot turns 🔴

