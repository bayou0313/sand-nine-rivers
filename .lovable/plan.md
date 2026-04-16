

## Plan: GMB URL validation — pattern-based bypass for short links

### Context
The GMB check in `check_google_integrations` does a server-side `HEAD/GET` fetch. Google short links (`maps.app.goo.gl`) block automated requests, so the current GBP URL `https://maps.app.goo.gl/5mXiogSVyjkTuFeu6` returns "invalid" even though it's a valid live link.

### File modified (1)
**`supabase/functions/leads-auth/index.ts`** — GMB block inside `check_google_integrations` action only.

### Logic
Replace the unconditional fetch with pattern-first dispatch:

```
if (!gmb_url) → "not_set"
else if (matches /^https:\/\/maps\.app\.goo\.gl\//) → "connected"   // format only, no fetch
else if (matches /^https:\/\/(maps\.google\.com|www\.google\.com\/maps)/) → "connected"
else if (matches /^https:\/\/g\.page\//) → existing fetchWithTimeout (HEAD → GET fallback)
else → "invalid"
```

### Files NOT touched
- All other actions in `leads-auth/index.ts`
- GTM, GA4, Clarity, GSC check logic (untouched)
- `Leads.tsx` UI (status dot rendering already supports all four states)
- `stripe-webhook`, `send-email`, `generate-city-page`, `pits.ts`, `create_order` RPC, `google-maps.ts`, `useGoogleMaps.ts`

### Risk
- **LOW**: Single block, ~10 lines, no schema changes, no contract changes. The fetch path for `g.page/` URLs (your active review URL) is preserved exactly as-is.

### Post-deploy verification
1. Settings → Check All → GBP URL `https://maps.app.goo.gl/5mXiogSVyjkTuFeu6` shows 🟢 connected
2. GMB Review URL `https://g.page/...` still shows 🟢 connected (fetch path intact)
3. Enter junk URL `https://example.com` in GBP → shows 🔴 invalid
4. Clear GBP field → shows ⚪ not set

