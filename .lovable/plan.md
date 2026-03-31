

# Apply Color Palettes to City Pages (Random per City)

## Problem
CityPage.tsx doesn't import or use `useBrandPalette`, so city pages stay on default colors. The user wants each city page to display a **random palette** from the 10 presets (seeded by city slug so it's consistent per city, not truly random on each visit).

## Plan

### 1. Create a deterministic palette picker utility
In `src/lib/palettes.ts`, add a function `getPaletteForSlug(slug: string): Palette` that hashes the city slug to consistently pick one of the 10 palettes. This way "metairie" always gets the same palette, but different cities get different ones.

### 2. Apply palette in CityPage.tsx
- After `cityPage` data loads, call `getPaletteForSlug(citySlug)` to get the palette
- Use `deriveCssVars()` to compute CSS variables and apply them to `document.documentElement`
- Clean up on unmount by removing the inline styles (so navigating back to homepage restores global palette)

### Files Changed
- **`src/lib/palettes.ts`** — add `getPaletteForSlug()` using a simple string hash
- **`src/pages/CityPage.tsx`** — import and apply per-city palette on mount, clean up on unmount

