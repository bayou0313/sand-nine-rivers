
Goal: fix the actual production failure on riversand.net, not just silence warnings.

What I found
- The blocking issue is real: client-side distance pricing uses `window.google.maps.DistanceMatrixService()` in `src/lib/pits.ts`, and Google is returning `REQUEST_DENIED`.
- Your browser key exists, but it is not authorized for Distance Matrix on `https://www.riversand.net/`.
- Autocomplete likely still works or can work with the browser key, but price calculation fails because it depends on Distance Matrix in the browser.
- The `loading=async` console warning is minor. The real outage is the denied Distance Matrix call.
- The Autocomplete and Distance Matrix deprecation warnings are informational for now; they are not the reason pricing is broken.

Code paths involved
- `src/hooks/useGoogleMaps.ts`
  - Loads Google Maps JS in the browser.
  - Currently injects `?key=...&libraries=places` and should be updated to use the recommended async loading params.
  - Still hardcodes a fallback browser key, which is not ideal.
- `src/components/DeliveryEstimator.tsx`
  - Uses browser geocoding/autocomplete, then calls `findBestPitDriving(...)`.
- `src/pages/Order.tsx`
  - Same pattern as the estimator.
- `src/lib/pits.ts`
  - Current root problem: `findBestPitDriving` and `getDrivingDistanceBatch` use browser-side `DistanceMatrixService`.
- `supabase/functions/leads-auth/index.ts`
  - Already has a server-side Google Maps secret (`GOOGLE_MAPS_SERVER_KEY`) and a server-side road-distance helper.
  - This proves the app already supports the safer architecture we should reuse.
- `src/pages/Leads.tsx`
  - Admin PIT simulation also uses browser-side distance matrix via `getDrivingDistanceBatch`, so it will be affected too.

Implementation plan
1. Keep browser Google Maps only for UI features
- Continue using the browser-loaded JS API for:
  - address autocomplete
  - browser geocoding if needed
- Update `useGoogleMaps` to:
  - remove the hardcoded key fallback
  - rely on `VITE_GOOGLE_MAPS_KEY`
  - load with `loading=async&v=weekly`
  - include required libraries explicitly

2. Move all driving-distance pricing off the browser key
- Refactor distance calculations so customer pricing never calls `window.google.maps.DistanceMatrixService()` from the frontend.
- Create or extend a backend function that:
  - accepts origin/destination coordinates
  - uses `GOOGLE_MAPS_SERVER_KEY`
  - returns road distance results
- Reuse the existing server-side pattern already present in `leads-auth`.

3. Update frontend consumers
- `DeliveryEstimator.tsx`
  - keep autocomplete/geocode in browser
  - replace `findBestPitDriving(...)` with a backend call for pit-distance pricing
- `Order.tsx`
  - same replacement
- `Leads.tsx`
  - replace PIT simulation / batch driving-distance logic with backend distance calls so admin tools stop depending on the browser key too

4. Keep pricing logic shared
- Preserve pricing rules from `src/lib/pits.ts`:
  - effective PIT/global pricing merge
  - serviceability checks
  - surcharge calculations
- Split the code so:
  - shared pure pricing helpers stay client-safe
  - Google distance transport is handled by backend

5. Address the warnings pragmatically
- Async warning: fix in script URL construction.
- `google.maps.places.Autocomplete` warning:
  - leave as-is for now unless you want a larger migration
  - it is not the current outage
- `DistanceMatrix` deprecation:
  - short term: use backend Distance Matrix with the server key so production works now
  - follow-up: migrate backend distance logic to Route Matrix later

Why this approach
- It removes the production dependency on a browser API key being authorized for premium routing services.
- It aligns with the existing secret setup:
  - browser key for autocomplete/UI
  - server key for routing/distance
- It fixes all affected flows, not just the homepage estimator.

Non-code requirement
- Google Cloud still needs to be correct:
  - browser key: authorized for Maps JavaScript API + Places, and allowed on the production domain
  - server key: enabled for the routing service used by backend distance requests
- Even with code changes, the relevant APIs must remain enabled for the server key.

Technical notes
- Current failing code:
  - `src/lib/pits.ts` lines using `new window.google.maps.DistanceMatrixService()`
- Existing backend distance reference:
  - `supabase/functions/leads-auth/index.ts` → `getDrivingDistances(...)`
- Existing secret inventory confirms both are present:
  - `VITE_GOOGLE_MAPS_KEY`
  - `GOOGLE_MAPS_SERVER_KEY`

Expected result after implementation
- Autocomplete works on riversand.net.
- Delivery pricing works again on the homepage and order flow.
- Admin PIT distance calculations work again.
- Console still may show legacy deprecation warnings until the later migration, but the broken customer flow will be fixed.

<lov-actions>
<lov-suggestion message="Test the estimator and order flow end-to-end on riversand.net after the backend distance refactor to confirm autocomplete and pricing both work.">Verify that it works</lov-suggestion>
<lov-suggestion message="Implement the backend distance-calculation refactor so pricing no longer depends on the browser Google Maps Distance Matrix service.">Move pricing distance checks to backend</lov-suggestion>
<lov-suggestion message="Update the Google Maps loader to use the recommended async loading parameters and remove the hardcoded browser key fallback.">Clean up Maps loader</lov-suggestion>
<lov-suggestion message="Migrate the remaining Distance Matrix usage to Google Route Matrix on the backend to get ahead of the deprecation notice.">Modernize route calculations</lov-suggestion>
</lov-actions>
