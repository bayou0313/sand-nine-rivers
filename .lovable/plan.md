

## Fix Two Bugs in PIT Manager Form

### Bug 1 — Pricing Fields Showing Raw Numbers

The Add PIT form at lines 1316-1339 currently has no pricing fields, so the bug is in the **edit mode** form (lines 1220-1260). The `editPitData` is initialized with `{ ...pit }` (line 517), which copies the PIT's actual values. When those values are `null` (inherited), `value={editPitData.base_price ?? ""}` correctly shows empty. But if a PIT has saved values, they show as raw numbers without formatting.

**Fix in `src/pages/Leads.tsx`:**

1. Add pricing override fields to the **Add New PIT form** (after line 1330) with empty initial values — the `newPit` state already lacks pricing fields, so just add 4 optional inputs with descriptive placeholders: `"e.g. 195.00"`, `"e.g. 15"`, `"e.g. 5.00"`, `"e.g. 30"`

2. Expand `newPit` state to include optional pricing: `base_price: null, free_miles: null, price_per_extra_mile: null, max_distance: null`

3. Pass pricing fields in the `addPit` save payload (line 465)

4. For **edit mode** pricing inputs, add `onBlur` formatting for currency fields (base_price, price_per_extra_mile) — format to 2 decimal places on blur. The `value` stays as the raw number for editing; formatting happens display-side only.

5. Ensure edit mode initializes null pricing fields as empty string display, not the global fallback value — current code `editPitData.base_price ?? ""` already does this correctly.

### Bug 2 — PIT Address Not Using Google Places Autocomplete

The Add PIT address field (line 1320) and Edit PIT address field (line 1208) are plain text inputs. Need to attach Google Places Autocomplete.

**Fix in `src/pages/Leads.tsx`:**

1. Add a `useEffect` for the **Add PIT** address field: when `showAddPit` becomes true and `pitInputRef.current` exists, attach `google.maps.places.Autocomplete` to it. On `place_changed`, extract `formatted_address`, `lat()`, `lon()` and update `newPit` state including new `lat`/`lon` fields.

2. Add `lat` and `lon` to the `newPit` state (default `null`).

3. Add a ref for the **Edit PIT** address input. When `editingPitId` changes, attach autocomplete to that ref. On `place_changed`, update `editPitData` with new address + coords.

4. Show green checkmark icon next to address field when lat/lon are captured (both Add and Edit forms).

5. Show warning text below address field if user has typed text but lat/lon are not set: "Select an address from the suggestions to capture coordinates"

6. In `addPit()`, skip the manual `geocodeAddress()` call if lat/lon already captured from Places. Only geocode as fallback if Places wasn't used.

7. In `saveEditPit()`, same logic — skip geocode if coords already updated via Places.

### Files Changed

| File | Change |
|---|---|
| `src/pages/Leads.tsx` | Add pricing fields to Add PIT form, expand newPit state, attach Google Places Autocomplete to address inputs (add + edit), show checkmark/warning for coordinate capture, add onBlur currency formatting for price fields |

