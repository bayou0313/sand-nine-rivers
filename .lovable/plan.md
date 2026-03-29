

## Combined Build — Add/Edit PIT Modal + Rename + Auto Proposal on Activation

### Overview
Replace inline Add/Edit PIT forms with proper modals, rename "PIT Simulator" to "PIT" everywhere, and add auto-proposal flow when a PIT is activated.

### Single file changed: `src/pages/Leads.tsx`

---

### Part 1 — Rename "PIT Simulator" → "PIT"

Two locations:
- Line 127: `label: "PIT Simulator"` → `label: "PIT"`
- Line 1034: `title: "PIT SIMULATOR"` → `title: "PIT"`

---

### Part 2 — Add PIT Modal

Replace the inline `showAddPit` form (lines 1357-1405) with a modal overlay. The modal renders at the bottom of the component alongside existing modals (after line 2051).

**Modal structure:**
- Overlay: `fixed inset-0 z-50 bg-black/50`
- Container: `max-w-[560px]`, `max-h-[90vh]`, `rounded-2xl`, white bg, internal scroll
- Header: "Add New PIT" title + "Point of Dispatch — delivery origin" subtitle + close X
- Body sections with `1px solid #E8E5DC` dividers:
  1. **Location**: Name* (required), Address* (Google Places with existing `pitInputRef`), Status dropdown (default: Planning), Notes textarea (3 rows)
  2. **Pricing Overrides**: "Leave blank to use global defaults" subtitle, info banner showing live global defaults, 2-column grid for base price / extra per mile / free miles / max distance — all empty, descriptive placeholders
  3. **Live Price Preview**: Computed in real-time using override if entered, global if blank. Shows effective pricing at 0mi, 20mi, max_distance. Gray text = all global, gold text = has override
  4. **Activation Warning**: Amber box shown only when status = "active"
- Footer: [Add PIT] gold full-width button + [Cancel] outline button

The `showAddPit` state and `addPit()` function remain, but the inline form at lines 1357-1405 is removed and replaced with the modal at the end of the component. The "+ Add New PIT" button (line 1261) stays as-is — it already calls `setShowAddPit(true)`.

---

### Part 3 — Edit PIT Modal

Replace the inline edit form (lines 1273-1321) with a modal. Remove `editingPitId` inline rendering from the PIT card loop.

**Modal structure** (same as Add PIT with differences):
- Header: "Edit PIT — [PIT Name]"
- Pre-fills all fields with saved values. Null pricing fields show empty (not global value) — existing `editPitData.base_price ?? ""` pattern.
- Footer: [Save Changes] gold + [Cancel] outline + [Delete PIT] red text link
- Delete shows inline confirmation: "Are you sure? This cannot be undone." with [Confirm Delete] and [Keep PIT] buttons
- Add `showDeleteConfirm` state boolean

The Edit PIT card button (line 1339) calls `startEditPit(p)` which already sets `editingPitId` and `editPitData`. The modal renders when `editingPitId !== null`.

---

### Part 4 — Auto Proposal on PIT Activation

New flow triggered in two places:
1. `addPit()` — after successful save, if `newPit.status === "active"`
2. `saveEditPit()` — after successful save, if status changed TO "active" from planning/inactive
3. `togglePitStatus()` — if toggling TO active

**New state:**
```typescript
const [activationLeads, setActivationLeads] = useState<Array<{ lead: ParsedLead; distance: number; price: number; hasEmail: boolean }>>([]);
const [showActivationModal, setShowActivationModal] = useState(false);
const [activationPit, setActivationPit] = useState<Pit | null>(null);
const [activationChecked, setActivationChecked] = useState<Set<string>>(new Set());
const [activationSending, setActivationSending] = useState(false);
const [activationProgress, setActivationProgress] = useState({ current: 0, total: 0 });
```

**`checkActivationLeads(pit: Pit)` function:**
1. For each lead: use `geocodeCache[lead.address]` coords if available, otherwise skip (no on-the-fly geocoding to avoid delays)
2. Calculate haversine distance from new PIT
3. Get effective pricing via `getEffectivePrice(pit, globalSettings)`
4. Filter to `distance <= effective max_distance`
5. If 0 found: toast "PIT activated. No leads in range." and return
6. If 1+: populate `activationLeads`, check all leads with email by default, show modal

**Activation Modal** (new modal at bottom of component):
- Header: navy bg, "PIT Activated — [X] Leads in Range", subtitle with PIT name
- Table: checkbox | Lead # | Name | Address | Distance | New Price | Email status
- Rows with no email show "No email" badge, unchecked by default
- Footer: [Send Proposals to All (X)] gold, [Send to Selected (X)] gold outline, [Skip] text link
- Sending shows gold progress bar with count

**Send logic:** Same as existing `sendProposals()` but with `utm_source=pit_activation` and `utm_campaign=[pit_name_slug]`, custom note "Great news — we now deliver to your area!"

---

### Part 5 — Styling Standards

- Modal overlay: `rgba(0,0,0,0.5)` (already used by existing modals)
- Modal bg: white, `rounded-2xl`, 16px border-radius
- Section dividers: `1px solid #E8E5DC`
- Section titles: navy 14px 500 weight
- Input labels: `#666` 12px
- Required asterisk: gold `#C07A00`
- Mobile: `w-full h-full` for modals (full screen)

---

### Technical Details

| Area | Change |
|---|---|
| Lines 127, 1034 | Rename PIT Simulator → PIT |
| Lines 1273-1321 | Remove inline edit form from PIT card loop |
| Lines 1357-1405 | Remove inline add form |
| After line 2051 | Add 3 new modals: Add PIT, Edit PIT, Activation Leads |
| Lines 527-556 | Update `addPit()` to call `checkActivationLeads()` on active status |
| Lines 576-591 | Update `togglePitStatus()` to call `checkActivationLeads()` on activation |
| Lines 603-645 | Update `saveEditPit()` to call `checkActivationLeads()` on status change to active |
| New state vars ~line 188 | Add activation modal state |
| New functions | `checkActivationLeads()`, `sendActivationProposals()` |

