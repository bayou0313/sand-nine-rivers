

## Checkout UI/UX Redesign

### Current Issues
- Header uses plain text "RIVERSAND" instead of the actual logo (`src/assets/riversand-logo.png`)
- Checkout flow has too many separate cards stacked vertically — feels fragmented
- Step 2 is very long (date picker, customer info, order summary, payment method all as separate cards)
- Confirmation step is plain text rows without visual hierarchy
- No trust signals or visual polish in the checkout flow

### Plan

**File: `src/pages/Order.tsx`**

#### 1. Replace text header with logo
- Import `logoImg` from `@/assets/riversand-logo.png`
- Replace the `<Link>` text "RIVERSAND" with `<img src={logoImg}>` sized ~120px height, with dark background styling

#### 2. Consolidate Step 2 layout
- Merge the "DELIVERY AVAILABLE" banner into a compact inline confirmation (green check + price in one line) instead of a full card
- Combine Customer Info + Delivery Date into a single card with two sections separated by a divider
- Keep Order Summary and Payment Method as their own cards but tighten spacing

#### 3. Improve Step 2 visual hierarchy
- Add section icons with accent-colored left borders instead of plain headings
- Use compact pill-style inputs with floating labels
- Add subtle background gradient to the order summary totals area

#### 4. Enhance Confirmation Step (Step 3)
- Add a structured receipt-style layout with a dotted separator line
- Group items into logical sections: Product, Delivery, Customer, Payment
- Add the logo at top of confirmation for branded feel
- Make the CTA button more prominent with larger size and icon

#### 5. Improve Success Step
- Add confetti/celebration animation (subtle scale + opacity)
- Better visual card for order number with accent border
- Add "What happens next?" timeline: Order Confirmed → We'll Call → Delivery Day

#### 6. General polish
- Tighten vertical spacing between cards (space-y-4 instead of space-y-6)
- Add smooth scroll-to-top on step transitions
- Ensure mobile responsiveness on all changes

### Technical Details
- Single file change: `src/pages/Order.tsx`
- Import `logoImg` from existing asset
- No new dependencies needed — uses existing Framer Motion, Tailwind, Lucide icons
- All changes are presentational; no business logic changes

