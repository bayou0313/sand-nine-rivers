

## Plan: PIT Management Enhancements

### Overview
Five changes across two files: `src/pages/Leads.tsx` (UI) and `supabase/functions/leads-auth/index.ts` (backend).

---

### 1. Rename "Free Delivery Radius" → "Free Delivery Distance"

**Leads.tsx** — Change label text only at 3 locations (global settings, add PIT form, edit PIT form). No field/column changes.

---

### 2. Same-day cutoff time picker (12h format, stores HH:MM 24h)

Replace the plain `<Input>` for `same_day_cutoff` in both Add and Edit PIT forms with three `<select>` dropdowns: Hour (1–12), Minute (00/15/30/45), AM/PM. Convert to/from 24-hour `HH:MM` for storage. No backend changes.

---

### 3. Fix modal closing on text selection

The Edit PIT modal uses a custom `<div>` overlay. Replace the backdrop `onClick` with a `useRef`-based mousedown/mouseup tracking pattern — only close if both mousedown and mouseup occurred on the backdrop element itself, preventing accidental closes during text selection drag.

---

### 4. Auto-regenerate city pages on PIT save (deduplicated)

**leads-auth/index.ts** — After the existing pricing-change regeneration block, add an "always-regen" block for all city pages linked to the saved PIT. To prevent double-regeneration, introduce a single boolean flag `regenTriggered`:

1. Initialize `let regenTriggered = false;` before the pricing-change block
2. After the pricing-change block fires regeneration, set `regenTriggered = true;`
3. The always-regen block checks `if (!regenTriggered && !isNewPit)` before running
4. Only one regeneration path ever executes per save

Both blocks query `city_pages` where `pit_id = savedPit.id` and call `generate-city-page` with a delay between calls.

---

### 5. PIT deactivation — reassign or waitlist

**leads-auth/index.ts** — Expand the existing `existingPit` fetch to include `status`. After save, detect when status changed to `inactive`:

1. Query all `city_pages` where `pit_id` matches the deactivated PIT
2. For each page, find the nearest active PIT using driving distance logic
3. If a valid active PIT is within range: reassign `pit_id`, update distance/price, trigger regeneration
4. If no valid PIT found: set page status to `waitlist`
5. Return `pages_reassigned` and `pages_waitlisted` counts in the response

**Leads.tsx** — Update `executePitSave` to display reassignment/waitlist results in the toast message.

---

### Technical Details

**Files modified:**
- `src/pages/Leads.tsx` — Label renames (3 locations), time picker (2 locations), modal mousedown fix, toast enhancement
- `supabase/functions/leads-auth/index.ts` — `regenTriggered` flag for deduplicated regen, deactivation reassignment logic, expanded existingPit fetch

No database schema changes. No other files touched.

