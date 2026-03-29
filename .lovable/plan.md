

## Fix Nearest PIT Selection + Pricing Engine

### Overview
Create a shared `src/lib/pits.ts` utility with `haversineDistance`, `getEffectivePrice`, `calcPitPrice`, and `findBestPit`. Then refactor both `DeliveryEstimator.tsx` and `Order.tsx` to use it — replacing hardcoded ORIGIN-based Distance Matrix with PIT-based Haversine pricing, and using PIT-level overrides.

---

### Step 1 — Create `src/lib/pits.ts`

New shared utility file with:

```typescript
export interface PitData {
  id: string; name: string; lat: number; lon: number; status: string;
  base_price: number | null; free_miles: number | null;
  price_per_extra_mile: number | null; max_distance: number | null;
  operating_days: number[] | null;
  saturday_surcharge_override: number | null;
  same_day_cutoff: string | null;
}

export interface GlobalPricing {
  base_price: number; free_miles: number;
  extra_per_mile: number; max_distance: number;
  saturday_surcharge: number;
}

export function haversineDistance(lat1, lon1, lat2, lon2): number // miles
export function getEffectivePrice(pit, global): EffectivePricing
export function calcPitPrice(effective, distance, qty): number
export function findBestPit(pits, custLat, custLng, globalPricing): FindBestPitResult | null
```

`findBestPit` filters to active PITs, computes haversine distance + effective pricing for each, returns nearest serviceable PIT (tie-break on price). If none serviceable, returns nearest with `serviceable: false` for lead capture.

---

### Step 2 — Refactor `DeliveryEstimator.tsx`

**Before address entered**: Remove the 3 info cards showing `$195` and pricing hints. Show only "Enter your address to get your exact price" as centered CTA text above the address input.

**On load**: Fetch active PITs + global_settings, store in state.

**On calculate**: 
1. Geocode customer address (already done via Places selection)
2. Call `findBestPit()` with all active PITs
3. If `serviceable: true` → show calculated price from winning PIT (no PIT name shown)
4. If `serviceable: false` → trigger out-of-area modal with `nearestPit` info from result
5. Remove Distance Matrix call to ORIGIN — use haversine from PIT instead
6. Remove hardcoded `ORIGIN` constant
7. Saturday surcharge line uses PIT override or global, not hardcoded `$35`

---

### Step 3 — Refactor `Order.tsx`

**On load**: Fetch active PITs + global_settings (already fetches settings).

**On address geocode**:
1. Call `findBestPit()` 
2. If serviceable → use winning PIT's effective pricing for price calc, store `pit_id` for order, set schedule for date picker
3. If not serviceable → out-of-area modal with nearest PIT info
4. Remove Distance Matrix call to ORIGIN — use haversine distance from best PIT
5. Remove hardcoded `ORIGIN`, `BASE_PRICE`, `BASE_MILES`, `MAX_MILES`, `PER_MILE_EXTRA` constants
6. Store matched PIT data for date picker schedule

---

### Step 4 — Update `OutOfAreaModal` lead capture

Already passes `nearestPit` prop — no change needed. The `findBestPit` result when `serviceable: false` provides the nearest PIT's id, name, and distance for storage in `delivery_leads`.

---

### Files Changed

| File | Change |
|---|---|
| `src/lib/pits.ts` | **New** — shared haversine, getEffectivePrice, calcPitPrice, findBestPit |
| `src/components/DeliveryEstimator.tsx` | Import from pits.ts, remove ORIGIN/Distance Matrix, use findBestPit, hide prices until address entered, remove hardcoded $35 Saturday |
| `src/pages/Order.tsx` | Import from pits.ts, remove ORIGIN/Distance Matrix, use findBestPit for pricing + schedule, remove hardcoded pricing constants |

### Technical Notes
- Haversine replaces Google Distance Matrix for distance calculation — saves API calls and aligns with PIT-based model
- Distance Matrix was measuring from a single hardcoded origin; haversine measures from each PIT
- The `FALLBACK_*` constants remain only in `src/lib/pits.ts` as last-resort defaults if DB fetch fails
- Google Places Autocomplete still used for address input — only the distance calculation changes

