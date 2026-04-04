

## Status: Redirect code was never implemented

The `scripts/prerender-cities.mjs` file does **not** contain any redirect generation logic. There is no `LEGACY_REDIRECTS` array, no `buildRedirect()` function, and no redirect loop in `main()`. The previous planning conversations produced approved plans but the code was never actually written.

**Triggering a new build right now would change nothing** — the script would generate the same output as before.

## What needs to happen

**Single file change**: `scripts/prerender-cities.mjs`

### 1. Add `LEGACY_REDIRECTS` array (after line 13)
```javascript
const LEGACY_REDIRECTS = [
  { from: 'chalmette-la', to: 'chalmette' },
  { from: 'bridge-city-la', to: 'bridge-city' },
  { from: 'destrehan-la', to: 'destrehan' },
  { from: 'kenner-la', to: 'kenner' },
  { from: 'luling-la', to: 'luling' },
  { from: 'meraux-la', to: 'meraux' },
  { from: 'metairie-la', to: 'metairie' },
  { from: 'new-orleans-la', to: 'new-orleans' },
];
```

### 2. Add `buildRedirect(fromSlug, toSlug)` function
Generates minimal HTML with:
- `<link rel="canonical">` pointing to new URL
- `<meta http-equiv="refresh" content="0; url=...">` for instant redirect
- `<script>window.location.replace(...)</script>` JS backup
- Visible `<a>` link fallback

### 3. Add redirect loop in `main()` after the city page loop
Iterates `LEGACY_REDIRECTS`, creates `dist/{fromSlug}/river-sand-delivery/index.html` for each, logs count.

### Files NOT touched
`src/App.tsx`, all edge functions, database, `pits.ts`, `google-maps.ts`, `CityPage.tsx`, `Order.tsx`, `Leads.tsx` — nothing else.

### Risk
None. Legacy slug directories don't exist in `dist/` today. Active city page generation is untouched.

### After implementation
The Lovable → GitHub sync will push the commit, triggering the Actions workflow automatically. After ~2-3 minutes, test `https://riversand.net/chalmette-la/river-sand-delivery`.

