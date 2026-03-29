

## Landing Page Fixes — Prompt 1B (Remaining Issue)

### Current State
Nearly all requested changes are already implemented. The one remaining problem is **duplicate pricing sections** on the landing page:

1. `<Pricing />` — dark section with "Enter your address to get your exact delivery price" + Google Places autocomplete + findBestPit
2. `<DeliveryEstimator />` — light section with "Delivery Area & Pricing" + identical address input + findBestPit

Both do the same thing. The user says "keep ONLY the Delivery Area & Pricing estimator section as the single place price appears."

### Plan

**Single change in `src/pages/Index.tsx`**: Remove the `<Pricing />` component from the page. Keep `<DeliveryEstimator />` as the sole pricing section.

- Remove line 3 (Pricing import) and line 24 (`<Pricing />`)
- Update the Hero's scroll-down arrow `href="#pricing"` → `href="#estimator"` in `src/components/Hero.tsx` (line 120) since the remaining estimator uses `id="estimator"`

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Remove `<Pricing />` import and usage |
| `src/components/Hero.tsx` | Change `#pricing` link to `#estimator` |

Everything else from Prompt 1B is already done.

