

## Plan: Weekend Delivery Configuration

### Overview
Add Sunday delivery support with surcharges, load limits for weekend days, card-only weekend payment enforcement, and admin configuration — across 5 files plus a database migration.

---

### Step 1 — Database Migration

```sql
-- New PIT columns
ALTER TABLE pits ADD COLUMN IF NOT EXISTS sunday_surcharge numeric DEFAULT NULL;
ALTER TABLE pits ADD COLUMN IF NOT EXISTS saturday_load_limit integer DEFAULT NULL;
ALTER TABLE pits ADD COLUMN IF NOT EXISTS sunday_load_limit integer DEFAULT NULL;

-- Orders: track pit_id and Sunday surcharge
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pit_id uuid DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sunday_surcharge boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sunday_surcharge_amount integer NOT NULL DEFAULT 0;

-- Global max daily limit
INSERT INTO global_settings (key, value, is_public)
VALUES ('max_daily_limit', '10', true)
ON CONFLICT (key) DO NOTHING;
```

Update the `create_order` function to accept and store `pit_id`, `sunday_surcharge`, and `sunday_surcharge_amount` from `p_data`. This is the highest-risk change — a weekday COD order must be tested immediately after deploy to confirm no regression.

---

### Step 2 — Admin PIT Forms (src/pages/Leads.tsx)

**Pit interface**: Add `sunday_surcharge`, `saturday_load_limit`, `sunday_load_limit`.

**Add PIT form** (after Saturday surcharge field ~line 4668):
- Sunday Surcharge input — shown when operating_days includes Sunday (0)
- Saturday Load Limit input — shown when operating_days includes Saturday (6)
- Sunday Load Limit input — shown when operating_days includes Sunday (0)
- All with "Leave blank for no limit" helper text

**Edit PIT form** (~line 4941): Mirror same three fields.

**save_pit payloads** (lines 913 and 1063-1077): Include the three new fields.

**newPit reset** (line 923): Add the three fields with null defaults.

**Pits fetch query**: Add `sunday_surcharge, saturday_load_limit, sunday_load_limit` to select.

**Global Settings** (~line 3191): Add `max_daily_limit` numeric input labeled "Max Daily Delivery Limit (all PITs combined)".

---

### Step 3 — New `get_date_load_counts` Action (supabase/functions/leads-auth/index.ts)

New **public** action placed before the password check:

```typescript
if (action === "get_date_load_counts") {
  const { pit_id, dates } = body;
  // Query orders: pit_id match, delivery_date IN dates,
  //   payment_method = 'stripe-link', payment_status = 'paid', status = 'confirmed'
  // Group by delivery_date → { "2026-04-05": 2, ... }
  // Fetch pit's saturday_load_limit, sunday_load_limit
  // Fetch global max_daily_limit from global_settings
  // Return { counts, saturday_load_limit, sunday_load_limit, max_daily_limit }
}
```

---

### Step 4 — DeliveryDatePicker (src/components/DeliveryDatePicker.tsx)

**Type changes**: Add `isSunday: boolean` to `DeliveryDate`. Add `sunday_surcharge` to `PitSchedule`. Add `pitId?: string` and `sundaySurcharge?: number` to Props.

**Day visibility**: Already handled correctly — Sundays excluded unless `operating_days` includes 0, Saturdays excluded unless includes 6. No change needed here. Will verify after deploy.

**Sunday styling**: Purple/indigo color scheme (border-indigo-500, bg-indigo-50) distinct from Saturday's amber.

**Load limit integration**:
- On mount and when `pitId` changes, call `get_date_load_counts` via `supabase.functions.invoke("leads-auth", ...)`
- Store counts and limits in state
- For each date: if `counts[date] >= limit` (Saturday/Sunday/daily), mark `blocked = true` with `blockedReason = "Fully Booked"` — visible but unselectable, red badge

**Surcharge badges**:
- Saturday: keep existing `SAT +$X` (already uses PIT-level value via `effectiveSatSurcharge`)
- Sunday: add `SUN +$X` badge using `sunday_surcharge` from pitSchedule

**Sunday info banner**: Purple-tinted banner when Sunday selected: "Sunday delivery — $X surcharge added."

---

### Step 5 — Order Page (src/pages/Order.tsx)

**Pits query** (line 89): Add `sunday_surcharge` to select.

**PitSchedule construction** (lines 511-515, 615-619): Include `sunday_surcharge`.

**DeliveryDate type**: Already has `isSunday` from Step 4 export.

**Sunday surcharge calculation**: Mirror Saturday pattern:
```typescript
const sundaySurchargeTotal = selectedDeliveryDate?.isSunday
  ? (matchedPitSchedule?.sunday_surcharge || 0) * quantity : 0;
```
Add to subtotal alongside `saturdaySurchargeTotal`.

**Payment method restriction** (lines 1285-1325): When `selectedDeliveryDate?.isSaturday || selectedDeliveryDate?.isSunday`:
- Hide the "AT DELIVERY" button entirely
- Auto-set `paymentMethod` to `"stripe-link"`
- Show note: "Weekend deliveries require card payment."

**buildOrderData** (line 677): Add `pit_id: matchedPit?.id`, `sunday_surcharge: selectedDeliveryDate?.isSunday`, `sunday_surcharge_amount`.

**Order summary UI** (lines 1240-1245): Add Sunday surcharge line item mirroring Saturday's.

**Confirm screen** (lines 1465-1467): Add Sunday surcharge line item.

**Success screen**: Pass `sundaySurchargeTotal` to `confirmedTotals`.

**Pass pitId to DeliveryDatePicker**: Add `pitId={matchedPit?.id}` prop.

---

### Risk Areas

1. **`create_order` function update** — SECURITY DEFINER, all orders flow through it. After deploy, immediately test a weekday COD order to confirm existing flow works.
2. **Sunday filtering** — Plan says "already handled" but must verify after deploy by unchecking Sunday on a PIT and confirming Sundays disappear from that PIT's checkout calendar.
3. **Weekend payment auto-switch** — If user selects COD then picks a weekend date, `paymentMethod` must auto-switch to `stripe-link`. Need a `useEffect` watching `selectedDeliveryDate` to enforce this.

---

### Files Modified
- Database migration (pits columns, orders columns, global_settings insert, `create_order` function update)
- `src/pages/Leads.tsx` — Pit interface, form fields, save payload, global settings
- `src/components/DeliveryDatePicker.tsx` — Sunday styling, load limits, isSunday, surcharge badges
- `src/pages/Order.tsx` — Sunday surcharge, card-only weekends, pit_id tracking
- `supabase/functions/leads-auth/index.ts` — `get_date_load_counts` action

No changes to: generate-city-page, stripe-webhook, send-email, Google Maps.

