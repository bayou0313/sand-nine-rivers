

# Fix: Centralize Google Maps Loading with useGoogleMaps Hook

## Summary
Replace the scattered `pollForGoogleMaps` loading pattern with a single shared `useGoogleMaps` React hook. No Maps script exists in `index.html` (already confirmed), so Step 1 is a no-op.

## Changes

### 1. Create `src/hooks/useGoogleMaps.ts`
New hook that handles script injection with deduplication. Uses `VITE_GOOGLE_MAPS_KEY` env var. Returns `{ loaded: boolean }`.

### 2. Update `src/components/DeliveryEstimator.tsx`
- Remove `import { pollForGoogleMaps }` 
- Add `import { useGoogleMaps }` 
- Replace `const [apiLoaded, setApiLoaded] = useState(false)` + the `pollForGoogleMaps` useEffect with `const { loaded: apiLoaded } = useGoogleMaps()`
- Autocomplete useEffect already uses `apiLoaded` as dependency — no change needed there

### 3. Update `src/pages/Order.tsx`
- Remove `import { pollForGoogleMaps }`
- Add `import { useGoogleMaps }`
- Replace `const [apiLoaded, setApiLoaded] = useState(false)` + the `pollForGoogleMaps` useEffect with `const { loaded: apiLoaded } = useGoogleMaps()`
- Autocomplete useEffect already uses `apiLoaded` as dependency — no change needed

### 4. Update `src/pages/Leads.tsx`
- Remove `import { pollForGoogleMaps }`
- Add `import { useGoogleMaps }`
- Replace `const [googleLoaded, setGoogleLoaded] = useState(...)` + the `pollForGoogleMaps` useEffect with `const { loaded: googleLoaded } = useGoogleMaps()`
- Three autocomplete useEffects already use `googleLoaded` and classic `Autocomplete` class — no changes needed

### 5. Optionally clean up `src/lib/google-maps.ts`
The `pollForGoogleMaps` and `loadGoogleMaps` functions become unused. Can remove or keep for backward compatibility.

## Files Changed
| File | Change |
|------|--------|
| `src/hooks/useGoogleMaps.ts` | **New** — shared hook |
| `src/components/DeliveryEstimator.tsx` | Swap to hook |
| `src/pages/Order.tsx` | Swap to hook |
| `src/pages/Leads.tsx` | Swap to hook |
| `src/lib/google-maps.ts` | Remove unused exports (optional) |

## Impact
- Single source of truth for Maps script loading
- No behavioral changes to autocomplete or geocoding
- Classic `Autocomplete` class used everywhere (no `PlaceAutocompleteElement`)

