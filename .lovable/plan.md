

## Plan: Hardcode Google Maps API Key

The environment variable `VITE_GOOGLE_MAPS_KEY` is not being injected into the Vite build despite being configured. As a workaround, we will hardcode the browser API key directly into the two frontend files.

### Changes

**File 1: `src/hooks/useGoogleMaps.ts`**
- Replace `const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";`
- With `const MAPS_KEY = "AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI";`

**File 2: `src/lib/google-maps.ts`**
- Replace `export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";`
- With `export const GOOGLE_MAPS_API_KEY = "AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI";`

No other files will be modified. The server-side key in `supabase/functions/get-maps-key/index.ts` remains untouched.

