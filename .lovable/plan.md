

## Fix: Remove `encodeURIComponent` from Distance Matrix API call

### Problem Found

In `supabase/functions/leads-auth/index.ts` lines 163-164, the `calculate_distances` action wraps origins and destinations in `encodeURIComponent()`:

```typescript
`?origins=${encodeURIComponent(originsStr)}`
`&destinations=${encodeURIComponent(destStr)}`
```

This encodes the pipe `|` separators between pit coordinates (turning `|` into `%7C` and `,` into `%2C`), which can cause Google to misparse the coordinates and return incorrect routes.

Meanwhile, the `getDrivingDistances` helper function (line 42-49) does NOT use `encodeURIComponent` — so the two code paths behave differently.

### No Haversine Found

Confirmed: zero haversine math anywhere in the codebase. All mentions of "haversine" are documentation comments saying "we don't use it." The `findBestPitDriving` function returns `null` on failure with no fallback calculation.

### Changes

**File: `supabase/functions/leads-auth/index.ts`** (lines 161-178)

1. Remove `encodeURIComponent` from origins and destinations
2. Add detailed logging: full URL (key hidden), API status, origin/destination addresses as resolved by Google, and raw row data
3. Keep `mode=driving`, `units=imperial`, `avoid=ferries|tolls`

```typescript
const url =
  `https://maps.googleapis.com/maps/api/distancematrix/json` +
  `?origins=${originsStr}` +
  `&destinations=${destStr}` +
  `&units=imperial&mode=driving&avoid=ferries%7Ctolls` +
  `&key=${apiKey}`;
console.log("[calculate_distances] calling URL:", url.replace(apiKey, "KEY_HIDDEN"));
const resp = await fetch(url);
const data = await resp.json();
console.log("[calculate_distances] API status:", data.status);
console.log("[calculate_distances] origin_addresses:", data.origin_addresses);
console.log("[calculate_distances] destination_addresses:", data.destination_addresses);
console.log("[calculate_distances] rows:", JSON.stringify(data.rows));
```

After deploying, test with **4354 Trieste St, New Orleans, LA 70129** and check edge function logs to verify all three pit distances match expected values.

