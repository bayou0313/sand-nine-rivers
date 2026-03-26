

## Remove Redundant Logo from Confirmation Step

The confirmation card (Step 3) has a large logo header (lines 681–683) that duplicates the Navbar logo already visible at the top. Removing it cleans up the receipt layout.

### Change
**In `src/pages/Order.tsx`:** Delete lines 680–683 (the logo header div inside the confirmation card).

