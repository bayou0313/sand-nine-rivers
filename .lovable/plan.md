

## Fix: Duplicate "Delivery Date" headings on Order page

### Problem
The Order page shows two delivery date headings stacked:
1. **"DELIVERY DATE"** — from the `SectionHeading` component in Order.tsx (line 920)
2. **"SELECT DELIVERY DATE"** — from the internal label inside `DeliveryDatePicker.tsx` (line ~147)

### Solution
Remove the internal label from `DeliveryDatePicker.tsx` since the parent (`Order.tsx`) already provides the section heading. The `SectionHeading` with the icon is the correct, consistent pattern used across the order form (matches "YOUR INFORMATION" section style).

### Changes

**File: `src/components/DeliveryDatePicker.tsx`**
- Remove the `<label>` element that renders "SELECT DELIVERY DATE" with the CalendarDays icon (around line 147-149)
- The `<div className="space-y-4">` wrapper stays; just remove the label inside it

That's the only change needed — one line removal.

