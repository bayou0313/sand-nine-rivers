

## Plan: Auto Price Rollover + Remove Preview Modal

### What Already Exists
- Closest-PIT dedup on `create_city_pages` — already implemented
- `deduplicate_city_pages` action and "Remove Duplicates" button — already implemented
- `create_all_city_pages` bulk action — already implemented
- `recalculate_city_prices` action — already exists as separate action

### What Changes

#### 1. Edge Function — `save_pit` action (`supabase/functions/leads-auth/index.ts`, lines 225-266)

Modify `save_pit` to:
- Fetch existing PIT pricing before overwriting
- After upsert, compare old vs new pricing fields (`base_price`, `free_miles`, `price_per_extra_mile`)
- If changed: fetch all city pages with `pit_id`, recalculate `base_price` for each using the corrected formula, bulk update
- Return `{ success, pit, prices_updated: N }` so the frontend can show a single toast

This eliminates the need for a separate `recalculate_city_prices` call from the frontend.

#### 2. Admin UI — Remove price preview modal (`src/pages/Leads.tsx`)

- Remove state: `showPricePreview`, `pricePreviewData`, `pendingPitPayload`, `pendingPitMeta`
- Remove the `previewNewPrice` helper function
- Simplify `handleSavePit`: remove the pricing-changed check that opens the modal — just call `executePitSave` directly every time
- Simplify `executePitSave`: remove the client-side `recalculate_city_prices` call — the edge function now handles it server-side
- Update toast: show "PIT saved. X city page prices updated." if `prices_updated > 0`, else "PIT saved."
- Delete the entire price preview modal JSX block (~lines 3913-3980)

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/leads-auth/index.ts` | Enhance `save_pit` to auto-recalculate city page prices inline |
| `src/pages/Leads.tsx` | Remove price preview modal, simplify save flow to single step |

### Not Changed
- `create_city_pages`, `deduplicate_city_pages`, `create_all_city_pages` — already correct
- Discovery logic, RLS, Stripe, auth, homepage components

