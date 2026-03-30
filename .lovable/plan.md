

# Fix: Distance Matrix CORS + Autocomplete Compatibility

## Problems Found

There are **two distinct issues** in the current code:

### 1. Distance Matrix CORS Block (CRITICAL — breaks pricing)
`findBestPitDriving()` in `src/lib/pits.ts` calls the Distance Matrix **REST API** (`/maps/api/distancematrix/json`) directly from the browser via `fetch()`. Google's REST APIs don't support CORS from browsers — this is why you see "blocked by CORS policy" and the price calculation fails completely.

**Fix**: Replace the `fetch()` call with the **Google Maps JavaScript SDK** `google.maps.DistanceMatrixService`, which is designed for client-side use and doesn't have CORS restrictions.

### 2. Legacy Autocomplete Deprecation (WARNING — still works)
The code uses `google.maps.places.Autocomplete` which Google deprecated for new customers as of March 2025. It still functions (just shows a console warning) and won't be removed without 12+ months notice. This is non-blocking but worth noting.

---

## Plan

### Step 1: Rewrite `findBestPitDriving()` to use JS SDK DistanceMatrixService

**File**: `src/lib/pits.ts`

- Replace the `fetch()` call to the REST endpoint with `new google.maps.DistanceMatrixService().getDistanceMatrix(...)` 
- Remove the `apiKey` parameter since the JS SDK uses the already-loaded script's key
- The SDK returns a promise-compatible callback with `rows[].elements[]` in the same structure
- Keep the same sorting/selection logic

Key change:
```typescript
export async function findBestPitDriving(
  pits: PitData[],
  customerLat: number,
  customerLng: number,
  globalPricing: GlobalPricing
  // No more apiKey param — SDK uses the script-loaded key
): Promise<FindBestPitResult | null> {
  const service = new google.maps.DistanceMatrixService();
  const response = await service.getDistanceMatrix({
    origins: activePits.map(p => ({ lat: p.lat, lng: p.lon })),
    destinations: [{ lat: customerLat, lng: customerLng }],
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
    avoidFerries: true,
  });
  // Parse response.rows same as before
}
```

Also rewrite `getDrivingDistanceBatch()` the same way (used in Leads admin).

### Step 2: Update all callers to remove the `apiKey` argument

**Files**: `src/components/DeliveryEstimator.tsx`, `src/pages/Order.tsx`, `src/pages/Leads.tsx`

- Remove `GOOGLE_MAPS_API_KEY` from calls to `findBestPitDriving()` and `getDrivingDistanceBatch()`
- Keep the API key for the geocoding REST fallback in `calculateDistance()` (geocoding REST API does support CORS)

### Step 3: Ensure Google Maps script is loaded before distance calls

The SDK service requires `window.google.maps` to be loaded. The existing `pollForGoogleMaps()` + `apiLoaded` state already guarantees this for the estimator and order pages. Verify the same guard exists in Leads.tsx.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/pits.ts` | Rewrite `findBestPitDriving` and `getDrivingDistanceBatch` to use JS SDK `DistanceMatrixService` instead of REST fetch |
| `src/components/DeliveryEstimator.tsx` | Remove `apiKey` arg from `findBestPitDriving()` call |
| `src/pages/Order.tsx` | Remove `apiKey` arg from `findBestPitDriving()` call |
| `src/pages/Leads.tsx` | Remove `apiKey` arg from distance calculation calls |
| `src/lib/google-maps.ts` | Add `google.maps.DistanceMatrixService` to the libraries loaded (ensure `&libraries=places` also loads the needed service — it's part of core, no extra library needed) |

## Impact
- Fixes the CORS error that completely blocks price calculation
- No change to pricing logic, PIT selection, or UI
- Autocomplete continues working as-is (legacy warning is non-blocking)

