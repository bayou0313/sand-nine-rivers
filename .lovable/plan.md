

## Font Size Proportionality Audit & Fix

### Problem
At the user's viewport (1021px, hitting the `md` breakpoint), font sizes are disproportionate:

```text
Current Scale (at md breakpoint):
─────────────────────────────────
Hero H1:          96px (text-8xl)  ← dominates everything, pushes CTA below fold
CTA H2:           96px (text-8xl)  ← same size as Hero H1, no hierarchy
Section H2s:      72px (text-7xl)  ← almost as big as H1
Pricing card $:   72px (text-7xl)  ← same as section headings (no responsive class)
Stats values:     72px (text-7xl)  ← same as headings
Hero price:       60px (text-6xl)  ← competes with H1
Body text:        14-18px          ← inconsistent jumps between sections
```

Everything is oversized and there's no visual hierarchy — section headings, stats, and prices are all the same size.

### Proposed Scale

```text
Fixed Scale (at md breakpoint):
─────────────────────────────────
Hero H1:          48px (text-4xl → md:text-5xl)     top of hierarchy
CTA H2:           42px (text-3xl → md:text-5xl)     slightly smaller than H1
Section H2s:      36px (text-3xl → md:text-4xl)     clear step down
Stats values:     42px (text-4xl → md:text-5xl)     display numbers, prominent
Pricing card $:   48px (text-4xl → md:text-5xl)     price prominence
Hero price block: 36px (text-3xl → md:text-4xl)     supports H1, doesn't compete
Feature titles:   20px (text-xl)                     no change
Body large:       16-18px (text-base to text-lg)     consistent
Body regular:     14px (text-sm)                     consistent
Meta/labels:      12px (text-xs)                     consistent
```

### Changes by File

1. **Hero.tsx** — Reduce H1 from `text-6xl md:text-8xl lg:text-9xl` to `text-4xl md:text-5xl lg:text-6xl`. Reduce price block from `text-5xl md:text-6xl` to `text-3xl md:text-4xl`. Tighten `space-y-8` to `space-y-5` and `py-20` to `py-12`. Change `min-h-screen` to `min-h-[85vh]` so CTA stays above fold.

2. **Pricing.tsx** — Reduce section H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`. Reduce card prices from `text-7xl` to `text-4xl md:text-5xl`.

3. **Stats.tsx** — Reduce stat values from `text-5xl md:text-7xl` to `text-4xl md:text-5xl`.

4. **Features.tsx** — Reduce section H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`.

5. **About.tsx** — Reduce section H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`.

6. **DeliveryEstimator.tsx** — Reduce section H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`.

7. **Testimonials.tsx** — Reduce section H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`.

8. **FAQ.tsx** — Reduce section H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`.

9. **ContactForm.tsx** — Reduce H2 from `text-5xl md:text-7xl` to `text-3xl md:text-4xl`.

10. **CTA.tsx** — Reduce H2 from `text-5xl md:text-8xl` to `text-3xl md:text-5xl`.

11. **Navbar.tsx** — Reduce container from `h-28` to `h-20`, logo from `h-16 md:h-24` to `h-10 md:h-14` for better proportion with the tightened hero.

All body text, button text, labels, and meta text remain unchanged — they are already proportional to each other.

