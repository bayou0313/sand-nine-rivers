

# Fix: Replace REST Geocoding with Google Maps JS SDK Geocoder

## Problem

The delivery estimator is broken. Two issues are compounding:

1. **Geocoding REST API called from browser** — `DeliveryEstimator.tsx` and `Order.tsx` call `https://maps.googleapis.com/maps/api/geocode/json` via `fetch()`. Like the Distance Matrix REST API we fixed earlier, this can be blocked by CORS or API key restrictions. When a user types an address without selecting from autocomplete (or autocomplete doesn't fire properly), the fallback geocoding fails, and no coordinates are available for the distance calculation.

2. **Autocomplete `place_changed` not firing reliably** — If the user types an address and hits Enter or clicks GET PRICE without selecting a dropdown suggestion, `customerCoords` stays `null`, forcing the broken geocode fallback path.

## Solution

Replace all client-side REST Geocoding `fetch()` calls with the **Google Maps JS SDK `Geocoder`** (`new google.maps.Geocoder()`), which is designed for browser use and has no CORS restrictions. Same pattern as the Distance Matrix fix.

## Changes

### 1. `src/components/DeliveryEstimator.tsx` (lines 146-159)

Replace the `fetch()` geocoding call with:
```typescript
const geocoder = new window.google.maps.Geocoder();
const geocodeResult = await geocoder.geocode({ address });
if (geocodeResult.results?.[0]?.geometry?.location) {
  custLat = geocodeResult.results[0].geometry.location.lat();
  custLng = geocodeResult.results[0].geometry.location.lng();
}
```

Remove the `GOOGLE_MAPS_API_KEY` check — the SDK uses the key from the loaded script. Keep the "could not locate" error for when geocoding returns no results.

### 2. `src/pages/Order.tsx` (lines ~413-427)

Same replacement — swap REST `fetch()` geocoding for `google.maps.Geocoder`.

### 3. `src/pages/Leads.tsx` (line ~690-700)

Same replacement for the admin geocoding function.

### 4. `src/components/DeliveryEstimator.tsx` — remove unused warning (lines 259-264)

Remove the `!GOOGLE_MAPS_API_KEY` warning UI since the SDK doesn't need the key to be checked separately.

## Files Changed

| File | Change |
|------|--------|
| `src/components/DeliveryEstimator.tsx` | Replace REST geocode `fetch` with SDK `Geocoder`; remove API key warning |
| `src/pages/Order.tsx` | Replace REST geocode `fetch` with SDK `Geocoder` |
| `src/pages/Leads.tsx` | Replace REST geocode `fetch` with SDK `Geocoder` |

## Impact
- Fixes the broken price calculation when autocomplete doesn't capture coordinates
- No CORS issues — everything uses the JS SDK now
- No change to pricing logic or UI layout

