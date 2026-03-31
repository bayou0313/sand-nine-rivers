

## Fix Hero Gradient Overlays to Match Image Height

### Problem
The background image is `h-[120%]` and moves via parallax (`y: bgY`), but the two gradient overlays are statically positioned with `absolute inset-0` and `h-1/2`. As the image scrolls, the gradients stay put — they don't move with the image, causing the raw image to peek through.

### Fix — `src/components/Hero.tsx`

1. **Wrap the image and both gradient overlays in a single `motion.div`** that shares the same parallax transform (`style={{ y: bgY }}`), so all three layers move together.

2. The wrapper gets `className="absolute inset-0 h-[120%]"` (matching the image height).

3. Inside the wrapper:
   - Image: `w-full h-full object-cover` (no longer needs its own `style={{ y: bgY }}`)
   - Left-to-right gradient: `absolute inset-0` (unchanged)
   - Bottom fade gradient: `absolute bottom-0 left-0 right-0 h-1/2` (unchanged)

This ensures the gradients always cover the image exactly, even during parallax scroll.

