

## Redesign Pricing Section

**Goal**: Replace the two pricing cards with a single, visually striking section featuring a sand pile background image, a quantity selector for multiple loads, and dynamic price recalculation based on delivery distance.

### Design Concept

A full-width hero-style pricing section with a sand pile background image (from Unsplash), a dark overlay for readability, and a centered interactive pricing widget. The widget lets customers:
1. Select number of loads (1-5) with +/- buttons
2. See base price update in real-time ($195 per load)
3. Enter address to get distance-adjusted total
4. Link to the order page or estimator with quantity param

### Changes

**1. Replace `src/components/Pricing.tsx`**
- Remove the two-card layout entirely
- Add a full-width section with a sand pile background image (Unsplash URL: high-quality sand/aggregate photo)
- Dark gradient overlay for text readability
- Center content: heading, subtext, and an interactive pricing widget
- Quantity selector: displays "Number of Loads" with minus/plus buttons and count (default 1, max 10)
- Price display: shows `$195 × {qty} = ${total}` for base pricing
- Note: "Within 15 miles. Farther? Price adjusts automatically at checkout."
- CTA buttons: "ORDER NOW" (links to `/order`) and "GET ESTIMATE" (scrolls to `#estimator`)
- Bottom badges: Mon-Sat delivery, Greater New Orleans, No hidden fees (keep existing)
- Framer Motion animations retained

**2. Update `src/components/DeliveryEstimator.tsx`**
- No changes needed — it already handles distance-based recalculation

**3. Update `src/pages/Order.tsx`**
- Accept a `qty` (quantity/loads) URL parameter
- Multiply `BASE_PRICE` by quantity for pricing
- Display "X loads × 9 cubic yards" in the order summary
- Store quantity in order data sent to database

**4. Database migration**
- Add `quantity` integer column (default 1) to `orders` table to track number of loads

### Technical Details
- Sand image: Use a royalty-free Unsplash image URL for the background
- Quantity state managed with `useState<number>(1)` in Pricing component
- Price formula: `quantity * BASE_PRICE` (base), extended miles calculated same way but multiplied by quantity
- Order page reads `qty` from search params and applies multiplier throughout

