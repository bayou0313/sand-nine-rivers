

# Remove Hardcoded Google Maps API Key Fallbacks

Two-line change across two files — replace the hardcoded fallback key with an empty string.

## Changes

1. **`src/lib/google-maps.ts`** (line 4): Remove hardcoded key, use `|| ""`
2. **`src/hooks/useGoogleMaps.ts`** (line 5): Remove hardcoded key, use `|| ""`

The `VITE_GOOGLE_MAPS_KEY` environment variable is already configured, so the app will continue working normally.

