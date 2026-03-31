

## Summary

Most of the 6 requested changes are **already applied** from previous work. Only **2 files** still need the hardcoded fallback Google Maps key removed.

### Already Done (no action needed)
- **FILE 2 (pits.ts)**: No Distance Matrix URL exists in this file — distance calls are server-side only
- **FILE 3 (leads-auth/index.ts)**: Already has `mode=driving&avoid=ferries`
- **FILE 4 (Leads.tsx)**: View button already uses `https://riversand.net/...`; sort state and sortable headers already implemented
- **FILE 5 (generate-city-page/index.ts)**: hero_intro prompt already updated to "ONE sentence only. Maximum 120 characters..."
- **FILE 6 (CityPage.tsx)**: subtitleOverride already has the 130-char truncation and short fallback

### Remaining Changes

**1. `src/hooks/useGoogleMaps.ts` (line 3)**
Replace the hardcoded fallback key with an empty string:
```
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
```
This ensures autocomplete fails visibly (with the existing console.error) rather than silently using a blocked key.

**2. `src/lib/google-maps.ts` (line 4)**
Same fix — remove the hardcoded fallback:
```
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
```

Both files currently fall back to `AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI` which is a blocked/old key. Removing it forces the build to use the real `VITE_GOOGLE_MAPS_KEY` env var or fail explicitly.

