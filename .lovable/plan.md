

## Fix — Show OutOfAreaModal on Order Page

### Problem
The Order page (`src/pages/Order.tsx`) has its own distance calculation at line 363-368. When an address exceeds `MAX_MILES`, it shows the error text but does NOT trigger the `OutOfAreaModal` — unlike the homepage `DeliveryEstimator.tsx` which was updated in the previous implementation.

### Fix — `src/pages/Order.tsx`

1. **Import** `OutOfAreaModal` from `@/components/OutOfAreaModal`
2. **Add three state variables**: `showOutOfAreaModal`, `outOfAreaAddress`, `outOfAreaDistance`
3. **Update the out-of-area block** (lines 364-367): before returning, set the three state values and open the modal — same pattern as `DeliveryEstimator.tsx`
4. **Render** `<OutOfAreaModal>` at the bottom of the component JSX

### Single file changed
| File | Change |
|---|---|
| `src/pages/Order.tsx` | Import modal, add state, trigger on out-of-area, render component |

