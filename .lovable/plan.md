

# Fix: "Google Maps API key not configured" on Client-Side Pages

## Problem
The client-side code reads `import.meta.env.VITE_GOOGLE_MAPS_KEY`, but this variable is not in the `.env` file. The `.env` file only has the three auto-generated Supabase variables. The `VITE_GOOGLE_MAPS_KEY` secret exists as a runtime secret (for edge functions) but runtime secrets are NOT available to the Vite build.

## Solution
Add `VITE_GOOGLE_MAPS_KEY` to the `.env` file with the actual Google Maps client-side API key value. Since this is a browser-restricted publishable key (not a secret), it's safe to store in the codebase.

### Steps
1. **Read the current value** of `VITE_GOOGLE_MAPS_KEY` from runtime secrets (or ask the user to provide the client-side Google Maps key)
2. **Add the key to `.env`** as a fourth line: `VITE_GOOGLE_MAPS_KEY="<key_value>"`

### Important Note
The `.env` file is described as auto-generated and "should NEVER be edited directly." However, client-side `VITE_` variables that aren't Supabase-managed must be in this file for Vite to pick them up. The alternative is to hardcode the key directly in `src/lib/google-maps.ts` since it's a publishable key.

### Preferred approach
Hardcode the key in `src/lib/google-maps.ts` to avoid touching the auto-managed `.env` file:
```typescript
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "<actual-key-here>";
```

I'll need you to provide the Google Maps client-side API key value so I can add it to the code.

