

## Plan: Bulk City Page Creation + Closest-PIT Deduplication

### Summary
Add three capabilities: (1) "Create All Cities" button that discovers cities across all active PITs with closest-PIT dedup, (2) "Remove Duplicates" button for retroactive cleanup, (3) update single-PIT creation to use closest-PIT logic instead of skip-if-exists.

### Changes

#### 1. Edge Function — New Actions (`supabase/functions/leads-auth/index.ts`)

**`create_all_city_pages` action** (insert before the final "Invalid action" response):
- Fetch all active PITs
- For each PIT, reuse the existing radial-grid + reverse-geocode discovery logic (extracted into a helper or inlined)
- Collect all candidate cities with their `distance_from_pit`, `pit_id`, and calculated `base_price`
- Deduplicate: for each `city_slug`, keep only the candidate with the lowest `distance_from_pit`
- Fetch existing `city_slugs` from `city_pages` table — skip any slug that already exists
- Insert new pages as `draft`, then call `generate-city-page` for each and activate on success
- Return `{ success, created, skipped, generated, failed }`

**`deduplicate_city_pages` action**:
- Fetch all city pages with `id, city_slug, pit_id, distance_from_pit, status, page_views`
- Group by `city_slug`; for groups with >1 page, sort by `distance_from_pit` ASC (tiebreak: `page_views` DESC)
- Keep the first (closest PIT), set rest to `status: 'inactive'`
- Return `{ success, deactivated }`

**Update existing `create_city_pages` action** (Fix 4):
- Before inserting, check if a page with the same `city_slug` already exists via `.maybeSingle()`
- If existing page has higher `distance_from_pit` → update its `pit_id`, `distance_from_pit`, `base_price`
- If existing page has lower `distance_from_pit` → skip
- If no existing page → insert as before

#### 2. Admin UI — New Buttons (`src/pages/Leads.tsx`)

**"Create All City Pages" button** in the City Pages header (next to Discover Cities):
- New state: `bulkCreating`, `bulkProgress` (string for status messages), `showBulkCreateConfirm`
- On click → show confirmation dialog (AlertDialog or simple modal) with the text from the spec
- On confirm → call `leads-auth` with `action: "create_all_city_pages"`
- Show loading spinner with "Creating city pages for all PITs..."
- On completion → toast with created/skipped counts, refresh city pages list

**"Remove Duplicates" button** in the filter bar:
- On click → show confirmation dialog with duplicate count
- On confirm → call `leads-auth` with `action: "deduplicate_city_pages"`
- On completion → toast with deactivated count, refresh list

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/leads-auth/index.ts` | Add `create_all_city_pages` and `deduplicate_city_pages` actions; update `create_city_pages` with closest-PIT upsert logic |
| `src/pages/Leads.tsx` | Add "Create All City Pages" button with confirmation modal, "Remove Duplicates" button with confirmation modal, related state variables |

### Not Changed
- Discovery logic (radial grid, reverse geocode) — reused as-is from the existing `discover_cities` action
- Existing city page content, RLS policies, Stripe, order flow, homepage components
- `generate-city-page` edge function (called as-is)

