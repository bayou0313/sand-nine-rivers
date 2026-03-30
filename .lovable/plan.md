

# Fix: Autocomplete hiding input and breaking address entry

## Problem
When `PlaceAutocompleteElement` is detected, the code hides the original `<Input>` (`display: none`) and injects a web component. If the Places API is blocked or the web component fails to show suggestions, the user has no way to enter an address — the React `address` state only updates via the `gmp-placeselect` event, never from typing.

The user sees "GET PRICE" → "Please enter a delivery address." because `address` is always empty.

## Root cause
Line 77 in DeliveryEstimator.tsx: `inputRef.current.style.display = "none"` removes the functional input. The PlaceAutocompleteElement web component doesn't sync back to React state until a place is explicitly selected.

## Fix — Stop injecting PlaceAutocompleteElement, use legacy Autocomplete only

Since the legacy `google.maps.places.Autocomplete` still works (Google confirmed it's not being removed), and the original input already has `onChange` for manual typing plus a geocoding fallback in `calculateDistance`:

### DeliveryEstimator.tsx
- Remove the `PlaceAutocompleteElement` branch entirely (lines 69-95)
- Keep only the legacy `Autocomplete` path which attaches directly to the existing input
- The input stays visible, `onChange` keeps `address` state in sync, and manual typing + geocode fallback works even if autocomplete suggestions fail

### Leads.tsx (3 autocomplete instances)
- Same change: remove PlaceAutocompleteElement branches, keep only legacy Autocomplete
- The legacy API attaches to existing inputs without hiding them

### Why this works
- Legacy Autocomplete enhances the existing input (adds dropdown) without replacing it
- If autocomplete is blocked, the input still accepts typed text
- `calculateDistance` already has a geocoding fallback for when coords aren't set by autocomplete
- Google has confirmed legacy Autocomplete will continue working with 12+ months notice before any removal

### Files changed
1. `src/components/DeliveryEstimator.tsx` — remove PlaceAutocompleteElement branch, keep legacy Autocomplete only
2. `src/pages/Leads.tsx` — same for all 3 autocomplete useEffects

