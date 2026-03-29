

## Fix Google Places Autocomplete on PIT Address Fields

### Root Cause
`Leads.tsx` never loads the Google Maps JavaScript SDK. The three `useEffect` hooks for autocomplete (Add PIT, Edit PIT, Business Profile) all check `window.google?.maps?.places` and silently bail out because the library isn't loaded. Only `DeliveryEstimator.tsx` and `Order.tsx` load it via dynamic `<script>` tags.

### Fix — `src/pages/Leads.tsx`

**Add a Google Maps script loader** early in the component (after auth succeeds), using the same pattern as `DeliveryEstimator.tsx`:

```typescript
// Load Google Maps Places library
useEffect(() => {
  if (window.google?.maps?.places) return;
  const existing = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existing) return;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = () => setGoogleLoaded(true);
  document.head.appendChild(script);
}, []);
```

**Add state**: `const [googleLoaded, setGoogleLoaded] = useState(!!window.google?.maps?.places);`

**Update the three autocomplete `useEffect` dependencies** to include `googleLoaded` so they re-run once the script finishes loading:
- Add PIT: deps `[showAddPit, googleLoaded]`
- Edit PIT: deps `[editingPitId, googleLoaded]`
- Business Profile: deps `[activePage, googleLoaded]`

Also add `componentRestrictions: { country: "us" }` to each autocomplete options object to match the pattern used in Order.tsx.

### Single file changed

| File | Change |
|---|---|
| `src/pages/Leads.tsx` | Add script loader useEffect, `googleLoaded` state, update 3 autocomplete useEffect deps to include `googleLoaded`, add US country restriction |

