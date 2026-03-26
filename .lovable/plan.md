

## Use Website Navbar on Checkout Page

### Problem
The checkout page (`/order`) has a custom header with just a logo and "Back" link, instead of reusing the shared `Navbar` component used on the homepage.

### Plan

**In `src/pages/Order.tsx`:**

1. **Replace the custom header** (lines 310–325) with the shared `<Navbar />` component
2. **Add top padding** to the content area below to account for the fixed navbar height (`pt-20` or similar, matching the homepage)
3. **Remove the `ArrowLeft` import** if no longer used elsewhere in the file

### Technical Details
- Import `Navbar` from `@/components/Navbar`
- Remove the custom `motion.div` header block
- The Navbar already handles scroll state, mobile menu, logo sizing, and links — no duplication needed
- Adjust `py-8 md:py-12` on the content container to include top padding for the fixed navbar

