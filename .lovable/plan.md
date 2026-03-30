

## Plan: CTA Background + Duplicate Estimator Removal + Footer Grid Fix

### Fix 1 — CTA Section: Light Background
**File:** `src/components/CTA.tsx`

Change the section from dark `bg-gradient-to-br from-primary via-primary/95 to-primary/85` to `bg-gray-50`. Remove the decorative dark circles. Update text colors: headline → `text-gray-900`, body → `text-gray-600`, phone link → `text-gray-500`. Button stays `bg-white text-gray-900` (will update to accent/gold for contrast against the now-light background).

### Fix 2 — Remove Duplicate Estimator from Pricing
**File:** `src/components/Pricing.tsx`

The entire Pricing component currently contains a full address-input estimator with Google Maps autocomplete — this is the "Delivery Area & Pricing" section the user sees. Since the estimator is already in the Hero, this component needs to be stripped down to a simple pricing info section:

- Remove all Google Maps/autocomplete logic, address state, price calculation, `findBestPit` calls, and `OutOfAreaModal`
- Keep only: section heading (renamed from "Delivery Area & Pricing" to just "Pricing"), the example pricing breakdown, the delivery info badges (Mon-Sat, No hidden fees, etc.), and the "Check my exact delivery price" anchor link
- Remove the address input card entirely

**File:** `src/pages/Index.tsx` — no changes needed here since `<Pricing />` is already in the correct position. The component itself just needs to be simplified.

### Fix 3 — Footer: Multi-Column Region Grid
**File:** `src/components/Footer.tsx`

The footer code already has proper region grouping logic. The issue is likely that no regions are assigned yet, so all cities fall into one "Other Areas" group. Add a fallback: when all cities have `region === null` (i.e., only "Other Areas" exists), render them in a flat multi-column grid (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4`) without region sub-headings. Also update text styling to match the requested classes: region headings → `text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2`, city links → `text-sm text-gray-300 hover:text-white`.

### Files Changed

| File | Change |
|---|---|
| `src/components/CTA.tsx` | Light bg, dark text, accent button |
| `src/components/Pricing.tsx` | Remove duplicate estimator, keep pricing info only |
| `src/components/Footer.tsx` | Flat grid fallback when no regions assigned |

### Files NOT Changed
- Hero, DeliveryEstimator, FAQ, Testimonials, Features, SocialProofStrip
- Index.tsx (no changes needed)
- pits.ts, session.ts, analytics.ts, edge functions, Stripe, /order flow

