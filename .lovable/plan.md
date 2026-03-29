

## Add Global Pricing Settings to PIT Manager

### Overview
Create a `global_settings` table and a `pits` table in the database, update the `leads-auth` edge function with CRUD actions for both, and update the PIT Simulator tab and pricing logic across the site to use dynamic values instead of hardcoded constants.

---

### Step 1 — Database Migration

Single migration creating both tables:

**`global_settings`**: key-value table with `id`, `key` (unique), `value`, `description`, `updated_at`. RLS: public SELECT, service role full access. Seeded with:
- `default_base_price` = `195.00`
- `default_free_miles` = `15`
- `default_extra_per_mile` = `5.00`
- `default_max_distance` = `30` *(user-specified, not 100)*
- `saturday_surcharge` = `35.00`
- `site_name` = `River Sand`
- `phone` = `1-855-GOT-WAYS`

**`pits`**: `id`, `name`, `address`, `lat`, `lon`, `status` (text), `notes`, `base_price` (nullable numeric), `free_miles` (nullable numeric), `price_per_extra_mile` (nullable numeric), `max_distance` (nullable numeric), `is_default` (boolean default false), `created_at`, `updated_at`. RLS: public SELECT, service role full access. Seeded with default HQ PIT:
- name: `New Orleans HQ`, address: `Bridge City, LA`, lat: `29.9308`, lon: `-90.1685`, status: `active`, is_default: `true`, all pricing fields `NULL` (inherits global 30mi max)

---

### Step 2 — Update `leads-auth` Edge Function

Add 5 new password-protected actions:
- **`get_settings`** — returns all `global_settings` rows as `{ key: value }` object
- **`save_settings`** — accepts `{ settings: { key: value, ... } }`, upserts each key
- **`list_pits`** — returns all PITs ordered by `is_default DESC, name`
- **`save_pit`** — upsert PIT (INSERT if no id, UPDATE if exists), returns saved record
- **`delete_pit`** — deletes PIT by id

---

### Step 3 — Update `src/pages/Leads.tsx`

**Replace sessionStorage PITs with DB-backed PITs**:
- On auth, call `list_pits` and `get_settings` to load data
- Remove sessionStorage for PITs (keep geocache in sessionStorage)

**Global Settings Panel** at top of PIT Simulator tab:
- Editable fields for base price, free miles, extra per mile, max distance, saturday surcharge
- Save button calls `save_settings`
- Toast on success

**PIT Cards updated**:
- Each card shows effective pricing: "Effective: $195 base · 15mi free · $5/mi · 30mi max"
- Gray text if all inherited from global, gold if any field overridden
- Edit mode shows optional override fields with placeholder showing global default (e.g., `placeholder="Global: $195"`)
- Activate/Deactivate toggle (active ↔ inactive), with warning toast on default PIT
- Status badges: green Active / blue Planning / gray Inactive
- Save/delete call edge function actions

**`getEffectivePrice(pit, globalSettings)` utility**:
```
base_price: pit.base_price ?? globalSettings.default_base_price
free_miles: pit.free_miles ?? globalSettings.default_free_miles
extra_per_mile: pit.price_per_extra_mile ?? globalSettings.default_extra_per_mile
max_distance: pit.max_distance ?? globalSettings.default_max_distance
```
Used in simulation table, ROI summary, revenue forecast, proposal pricing.

**Dashboard header**: Show "Live pricing: $195 base · $5/mi · 30mi max"

---

### Step 4 — Update `src/pages/Order.tsx`

On page load, fetch `global_settings` and active PITs via public Supabase SELECT.

Replace hardcoded constants:
- `BASE_PRICE` → fetched `default_base_price`
- `BASE_MILES` → fetched `default_free_miles`
- `MAX_MILES` → fetched `default_max_distance`
- `PER_MILE_EXTRA` → fetched `default_extra_per_mile`

Fallback to current hardcoded values (195, 15, 30, 3.49) if fetch fails.

---

### Step 5 — Update `src/components/DeliveryEstimator.tsx`

Same as Order.tsx: fetch global settings on mount, replace hardcoded constants, update "Starting at $195" to use fetched base price. Fallback to defaults on error.

---

### Files Changed

| File | Change |
|---|---|
| SQL migration | Create `global_settings` + `pits` tables, seed data, RLS policies |
| `supabase/functions/leads-auth/index.ts` | Add 5 actions: get_settings, save_settings, list_pits, save_pit, delete_pit |
| `src/pages/Leads.tsx` | Global settings panel, DB-backed PITs with effective pricing, getEffectivePrice utility, live pricing header |
| `src/pages/Order.tsx` | Fetch global settings + PITs, replace hardcoded pricing constants |
| `src/components/DeliveryEstimator.tsx` | Fetch global settings, replace hardcoded pricing constants and display text |

