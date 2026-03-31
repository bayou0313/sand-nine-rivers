

## Fix Header: Semi-transparent → Off-white on scroll, always-visible text

### Problem
- The inner `div` has `md:bg-primary-foreground md:text-primary-foreground` which sets both background AND text to white — causing white-on-white invisible text on desktop.
- The unscrolled state uses light text (`text-primary-foreground/70`) which works over the hero, but the scrolled state needs dark text on the off-white background.

### Plan

**File: `src/components/Navbar.tsx`**

1. **Outer `<motion.nav>` classes** — change the two states:
   - **Unscrolled**: semi-transparent off-white with subtle shadow → `bg-background/60 backdrop-blur-sm shadow-sm`
   - **Scrolled**: solid off-white with stronger shadow → `bg-background/95 backdrop-blur-md shadow-lg shadow-foreground/5`

2. **Inner container `div`** — remove the broken `md:bg-primary-foreground md:text-primary-foreground` classes. Keep `px-4 md:px-0`.

3. **Nav link text colors** — always use dark text since the background is now always light:
   - Unscrolled: `text-foreground/70` (semi-transparent navy)
   - Scrolled: `text-muted-foreground` (dark navy — already correct)

4. **Logo** — remove `brightness-0 invert` from unscrolled state (no longer on dark bg). Always show `grayscale` or natural colors.

5. **Phone button** — unscrolled variant: use dark border/text instead of white (`border-border text-foreground`) since background is light.

6. **Mobile hamburger icon** — always use `text-foreground` instead of toggling to white.

### Result
- Header starts semi-transparent off-white over the hero, solidifies on scroll
- All text is always navy/dark — never white-on-white
- Consistent shadow for depth

