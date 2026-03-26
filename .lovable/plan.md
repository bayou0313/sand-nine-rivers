

## Issue: REVIEW ORDER Button Appears Non-Functional

The REVIEW ORDER button is actually working correctly. After testing, the flow works as expected:
1. Select delivery date → Fill in name and phone → Select payment method → Click REVIEW ORDER → Confirmation screen appears with full order details

**Root cause**: The button is **disabled** (grayed out) when the name or phone fields are empty. The disabled state styling is subtle — the button looks faded but doesn't clearly communicate *why* it's disabled.

## Proposed Fix

1. **Add a visible validation message** below the REVIEW ORDER button when it's disabled, telling the user what's missing (e.g., "Please fill in your name and phone number above to continue").

2. **Improve disabled button styling** — make the disabled state more obvious with a lighter background and a `cursor-not-allowed` visual cue.

3. **Scroll to the first empty required field** when the user clicks a disabled-looking area, guiding them to fill in the missing info.

### Files to modify
- `src/pages/Order.tsx` — Add validation hint text below both REVIEW ORDER buttons (Stripe and Cash paths), and enhance the disabled button appearance.

