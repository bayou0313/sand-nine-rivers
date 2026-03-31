

# Color Palette Presets with Global Settings Integration

## Overview
Add 10 pre-built color palette options to the Business Profile section of the Leads dashboard. Selecting a palette updates CSS custom properties sitewide and persists the choice via `global_settings`.

## The 10 Palettes

| # | Name | Primary | Accent | Background | Vibe |
|---|------|---------|--------|------------|------|
| 1 | **Original Navy** | #0D2137 | #C07A00 | #F2EDE4 | Current brand |
| 2 | **Charcoal Ember** | #2D2D2D | #D4763A | #F5F2EE | Warm industrial |
| 3 | **Forest Gold** | #1B4332 | #D4A017 | #F4F1EC | Earthy natural |
| 4 | **Slate Copper** | #334155 | #B87333 | #F8F6F3 | Modern refined |
| 5 | **Espresso Sand** | #3E2723 | #C9A84C | #FAF7F2 | Warm premium |
| 6 | **Storm Steel** | #1E293B | #64748B | #F1F5F9 | Cool minimal |
| 7 | **Oxblood Clay** | #6B1D1D | #C07A00 | #FBF7F2 | Bold heritage |
| 8 | **Midnight Sage** | #1A1A2E | #7C9A6E | #F5F5F0 | Calm natural |
| 9 | **Granite Amber** | #4A4A4A | #E5A100 | #FAFAF8 | Neutral bold |
| 10 | **Dusk Terracotta** | #2C1810 | #C45B28 | #F9F5F0 | Desert warmth |

## Implementation

### 1. Store palette choice in `global_settings`
- Key: `brand_palette` — stores palette ID (e.g., `"charcoal_ember"`)
- Keys for custom overrides: `brand_primary`, `brand_accent`, `brand_background` (HSL strings)

### 2. Add palette picker UI in Leads.tsx Business Profile section
- Grid of 10 clickable color swatch cards showing primary + accent + background
- Active palette highlighted with a check mark
- On select → save to `global_settings` via existing `save_settings` action
- Optional: manual hex inputs for custom tweaks after selecting a base palette

### 3. Apply palette dynamically on the public site
- In `Index.tsx` and `Order.tsx` (where settings are already fetched), read `brand_primary`, `brand_accent`, `brand_background` from `global_settings`
- On load, apply them to `document.documentElement.style.setProperty()` to override the CSS custom properties (`--primary`, `--accent`, `--background`, etc.)
- Derive related variables (foreground, card, muted, border, ring) from the primary/accent/background using HSL math
- Fallback to current navy palette if no setting exists

### 4. Update hardcoded colors in Leads.tsx dashboard
- Replace `BRAND_NAVY`, `BRAND_GOLD`, `SIDEBAR_HOVER`, `CONTENT_BG` constants with values derived from the selected palette so the admin dashboard also reflects the brand choice

### Files Changed
- **`src/pages/Leads.tsx`** — palette picker UI in Business Profile, dynamic constants
- **`src/pages/Index.tsx`** — read palette settings, apply CSS vars on mount
- **`src/pages/Order.tsx`** — same CSS var application
- **`src/lib/palettes.ts`** (new) — palette definitions and HSL derivation utilities
- **`src/hooks/useBrandPalette.ts`** (new) — shared hook to fetch and apply palette from settings

