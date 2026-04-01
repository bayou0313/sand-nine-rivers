

## Add "No Haversine" Documentation Notes

The system exclusively uses **Google Distance Matrix API driving distances** for all distance calculations. Haversine (straight-line/as-the-crow-flies) is never used. We need to add clear notes in the key files so every developer knows this.

### Files to Update

1. **`src/lib/pits.ts`** — Add a prominent note to the module docstring (lines 1-7) stating that all distances are real driving distances via the Google Distance Matrix API, and haversine is intentionally never used.

2. **`supabase/functions/leads-auth/index.ts`** — The `getDrivingDistances` function already has a comment "No haversine fallback" (line 13). Add a top-level module comment reinforcing that the entire system uses driving distances only — no haversine anywhere.

3. **`src/components/DeliveryEstimator.tsx`** — Add a brief comment near the `findBestPitDriving` call noting that distances are real driving miles from Google Distance Matrix, not haversine.

### What the Notes Will Say

> **IMPORTANT: This system does NOT use haversine (straight-line) distances anywhere.**
> All distance calculations use the Google Distance Matrix API with `mode=driving` and `avoid=ferries|tolls`.
> This ensures accurate road-based mileage for pricing. Never add haversine as a fallback or pre-filter.

