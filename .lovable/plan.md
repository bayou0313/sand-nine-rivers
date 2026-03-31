

## Fix Navbar: Dark Semi-transparent Effect + Fix Scroll Position

### Two Issues

1. **Color**: The navbar currently uses `bg-background` (off-white) which doesn't look good over the dark hero. You want a dark/black semi-transparent glass effect instead.

2. **Scroll jump**: Clicking "Get Estimate" anchors to `#estimator` which exists both on the embedded hero estimator (line 208) and the standalone section (line 307). The browser scrolls to the first one — the hero section top — which lands behind the fixed navbar.

### Changes

**File: `src/components/Navbar.tsx`**

1. Change navbar background states to dark semi-transparent:
   - **Unscrolled**: `bg-black/40 backdrop-blur-sm shadow-sm` — dark glass over the hero
   - **Scrolled**: `bg-black/80 backdrop-blur-md shadow-lg` — darker, more opaque on scroll

2. Update all text colors to work on dark background:
   - Nav links: `text-white/70` (unscrolled) → `text-white/90` (scrolled)
   - Hamburger icon: `text-white`
   - Phone button: white border/text variant
   - Mobile menu: `bg-black/90 backdrop-blur-md`

3. Fix "Get Estimate" scroll — add `scroll-margin-top` or change the anchor link to use `scrollIntoView` with offset accounting for the fixed navbar height. Simplest fix: add `scroll-mt-24` class to the `#estimator` div in the embedded estimator.

**File: `src/components/DeliveryEstimator.tsx`**

4. Add `scroll-mt-24` to the embedded estimator's `id="estimator"` div (line 208) so the browser accounts for the fixed navbar when scrolling to the anchor.

5. Remove `id="estimator"` from the embedded version (line 208) so the anchor only exists on the standalone section — or rename the embedded one to avoid duplicate IDs. The "Get Estimate" link should scroll to the standalone estimator section below the hero, not the embedded one inside the hero.

### Result
- Dark glass navbar that looks cohesive over the hero image
- Solidifies to darker black on scroll
- White text always visible against dark background
- "Get Estimate" scrolls to the correct position with proper offset

