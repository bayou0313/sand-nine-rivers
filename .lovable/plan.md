

## Plan: Fix PIT Save Regen + Reactivation Logic

### Critical Discovery

The regen calls in save_pit PART 1 and PART 1b are **broken** — they send `{ city_page_id, force: true }` to `generate-city-page`, but that function requires `password`, `city_name`, `state`, `region`, `pit_name`, etc. Without `password`, they return 401 silently. This is why flags never clear.

The `process_regen_queue` action (line 2319) does it correctly — sends all required fields and clears flags on success. The background poller in the UI calls this every 30 seconds.

**Root cause fix**: Replace broken direct `generate-city-page` calls with `needs_regen = true` flags, letting the existing background queue handle regeneration properly.

---

### Changes

#### File 1: `supabase/functions/leads-auth/index.ts`

**Fix 1 — PART 1 (pricing change, lines 662-679):**
- Keep the price update (`base_price`, `price_changed`, `regen_reason`)
- Add `needs_regen: true` to the update
- Remove the broken direct `fetch(regenUrl, ...)` call and the 2-second delay
- The background queue will pick these up, regen properly, and clear all flags

**Fix 2 — PART 1b (always-regen, lines 696-712):**
- Replace the broken direct `fetch(regenUrl, ...)` calls with a single bulk update: set `needs_regen = true`, `regen_reason = 'pit_updated'` on all linked city pages
- Remove per-page loop with delays

**Fix 3 — Deactivation block (lines 789-794):**
- After reassigning a page to a new PIT, set `needs_regen = true` instead of calling `fetch(regenUrl, ...)` directly
- Remove the 2-second delay per page

**Fix 4 — Reactivation block (NEW, after line 815):**
Add a new block detecting `inactive → active` status change:

```
if (!isNewPit && existingPitStatus !== "active" && savedPit.status === "active")
```

Logic:
1. Query ALL city pages with coordinates (any status)
2. Get all active pits (including reactivated one)
3. Calculate driving distance from reactivated PIT to each city page
4. For pages currently assigned to another PIT: reassign only if reactivated PIT is **≥3 miles closer** than current `distance_from_pit`
5. For waitlisted pages: reassign if reactivated PIT is within its `max_distance`
6. Set `needs_regen = true` on reassigned pages (queue handles regen)
7. Track `reactivation_reassigned` and `reactivation_unwaitlisted` counts
8. Add counts to response JSON

#### File 2: `src/pages/Leads.tsx`

**Fix 5 — Always refresh + show reactivation counts (lines 1103-1118):**
- Always call `fetchCityPages()` after PIT save (move outside the `if (parts.length > 0)` block)
- Add `reactivation_reassigned` and `reactivation_unwaitlisted` to toast parts
- Schedule a delayed second `fetchCityPages()` call (e.g. 15 seconds) to pick up queue-processed flag clears

---

### Technical Details

**Why `needs_regen` instead of direct calls:** The `process_regen_queue` action already:
- Sends all required fields (password, city_name, state, region, pit_name, etc.)
- Clears `price_changed`, `pit_reassigned`, `regen_reason`, `needs_regen` on success
- Sets status to `active`
- Runs with proper 3-second delays for rate limiting

The background poller in the UI triggers this every 30 seconds. This is the correct, working path.

**3-mile threshold logic:**
```
const currentDist = page.distance_from_pit || 999;
const improvement = currentDist - newDist;
if (improvement >= 3) { /* reassign */ }
```

**No database schema changes. No other files touched.**

