

## Plan: Independent Weekend PIT Selection

### Overview
Pre-resolve the best PIT for Saturday and Sunday independently when the delivery address is confirmed. Store results in a `weekendPitMap`. When a weekend date is selected, swap the active PIT/price/schedule to the weekend PIT's values. When switching back to weekday, restore the original weekday PIT. Two files only.

---

### Order.tsx Changes

**New types** (after line 44):
```typescript
type WeekendPitEntry = {
  pit: PitData;
  distance: number;
  price: number;
  schedule: PitSchedule;
  satSurcharge: number;
  sunSurcharge: number;
};
type WeekendPitMap = Partial<Record<0 | 6, WeekendPitEntry>>;
```

**New state** (after line 74):
- `weekendPitMap: WeekendPitMap` — resolved weekend PITs
- `weekdayPit / weekdayResult / weekdayPitSchedule` — stashed weekday values for restore

**New helper** `resolveWeekendPits(allPits, lat, lng, globalPricing, supabase) → WeekendPitMap`:
- Runs `findBestPitDriving` in parallel for day 6 and day 0
- For each serviceable result, builds entry with pit, distance, price, schedule (from pit's fields), `satSurcharge` (from `saturday_surcharge_override ?? global`), `sunSurcharge` (from `sunday_surcharge ?? 0`)
- Non-serviceable or null → omitted from map (that weekend day won't show)

**In `calculateDistance`** (after line 631, after setting matchedPit):
- Stash weekday state: `setWeekdayPit(bestResult.pit)`, `setWeekdayResult(resultObj)`, `setWeekdayPitSchedule(scheduleObj)`
- Call `resolveWeekendPits` and store in `weekendPitMap`

**URL params flow** (Risk Area 2 — new `useEffect`):
- Watch `[allPits, address]` — when allPits loaded AND address exists from URL params AND `customerCoords` is null AND weekendPitMap is empty:
  - Geocode the address using `window.google.maps.Geocoder` to get coords
  - Set `customerCoords`
  - Call `resolveWeekendPits` with those coords
  - Also stash the current matchedPit as weekdayPit

**Replace onSelect handler** (lines 1149–1173):
- Remove the existing reactive `findBestPitDriving` call on date select
- New logic:
  - If weekend date selected → look up `weekendPitMap[dayKey]`; if found, swap matchedPit/result/schedule to weekend entry values
  - If weekday date selected → restore weekdayPit/weekdayResult/weekdayPitSchedule
  - No API calls on date selection — everything pre-resolved

**Pass new props to DeliveryDatePicker** (line 1177):
- `weekendPitMap={weekendPitMap}`
- `weekdayPitName={weekdayPit?.name || matchedPit?.name}`

**buildOrderData** (line 710): `pit_id: matchedPit?.id` — already correct since matchedPit dynamically reflects the active PIT.

---

### DeliveryDatePicker.tsx Changes

**New props**:
```typescript
weekendPitMap?: Partial<Record<0 | 6, {
  pit: { id: string; name: string };
  satSurcharge: number;
  sunSurcharge: number;
}>>;
weekdayPitName?: string;
```

**Date filtering**: After computing dates, filter out:
- Saturday dates where `weekendPitMap` is provided but has no entry for key `6`
- Sunday dates where `weekendPitMap` is provided but has no entry for key `0`

**"From [name]" label**: On weekend date cards, if `weekendPitMap[dayKey]?.pit.name !== weekdayPitName`, show small text below the date.

**Weekend surcharge badges**: When `weekendPitMap` is provided, use `weekendPitMap[6]?.satSurcharge` for Saturday badges and `weekendPitMap[0]?.sunSurcharge` for Sunday badges instead of the default pitSchedule values.

**Load count fetching**: Update the `useEffect` to fetch load counts per unique weekend PIT ID from the map (Saturday PIT may differ from Sunday PIT and from weekday PIT).

---

### Files Modified
- `src/pages/Order.tsx`
- `src/components/DeliveryDatePicker.tsx`

No edge functions, database, or other files changed.

