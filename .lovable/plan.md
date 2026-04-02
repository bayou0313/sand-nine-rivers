

## Plan: City Name "La" Suffix Cleanup

### Part A — Data Fix (SQL Migration)

**Step 1: Audit query** (run first to see affected rows):
```sql
SELECT id, city_name, city_slug
FROM city_pages
WHERE city_name ~* '\s*,?\s*la$';
```

**Step 2: UPDATE statement** (in a migration):
```sql
UPDATE city_pages
SET city_name = RTRIM(regexp_replace(city_name, '\s*,?\s*[Ll][Aa]$', ''), ' '),
    updated_at = now()
WHERE city_name ~* '\s*,?\s*la$';
```

This strips trailing ` La`, ` LA`, ` la`, `, La`, `, LA`, `, la` from `city_name`.

---

### Part B — Template Guard in `CityPage.tsx`

**Add a utility function** near line 27 (next to `slugToTitle`):
```typescript
const cleanCityName = (name: string): string =>
  name.replace(/\s*,?\s*[Ll][Aa]$/, '').trim();
```

**Apply it once** after data is fetched — in the `fetchPage` callback (~line 193), right after `setCityPage(data)`:
```typescript
data.city_name = cleanCityName(data.city_name);
setCityPage(data);
```

This single mutation point ensures every downstream usage (Helmet title, H1, schemas, Hero, waitlist page, "Other Areas" links) receives the cleaned name. No other render locations need individual fixes.

Also apply to the `slugToTitle` loading-state path (~line 242) — this path derives from the URL slug, not DB data, so it's already clean. No change needed there.

The WaitlistPage component receives `cityPage` as a prop, so it inherits the cleaned name automatically.

---

### Files Modified
1. **New migration file** — SQL UPDATE to clean existing data
2. **`src/pages/CityPage.tsx`** — add `cleanCityName` utility, apply after fetch

### Files NOT Touched
- `Order.tsx`, `pits.ts`, `google-maps.ts`, `useGoogleMaps.ts`
- All Supabase edge functions (stripe-webhook, send-email, generate-city-page, leads-auth, etc.)
- `create_order` RPC, RLS policies, pricing logic
- No other components or pages

### Risk Areas
- **Regex edge case**: A city literally ending in "la" (e.g., "Eola") would be affected. The regex `\s*,?\s*[Ll][Aa]$` requires whitespace or comma before "La", so "Eola" is safe. "Mandeville La" → "Mandeville" ✓. "Eola" → unchanged ✓.
- **Migration is a one-way data change** — but the template guard prevents recurrence, and the AI generation pipeline (`generate-city-page`) may re-insert suffixed names. The guard handles that defensively.

### No Questions — Ready for Approval

