

## Plan: Realistic Road Map with Smooth Truck Animation

### Problem
The current SVG map is abstract with a single curved path. The truck animation has timing sync issues between forward/return trips. The user wants a more realistic map with a road network and the truck following roads naturally.

### Approach
Rewrite the SVG illustration in `src/components/Pricing.tsx` with:

1. **Realistic road-network map** — A grid of named roads (horizontal + vertical) with varying widths (highway vs local street), intersections, and the truck route following actual road segments (right-angle turns with rounded corners) instead of arbitrary curves.

2. **Road-following route** — The delivery path will follow the road grid: e.g., go east on one road, turn south at an intersection, continue east on another road. This uses an SVG path with straight segments and small arc turns at corners (`L` + `A` commands), making it look like real navigation.

3. **Single truck, CSS offset-path animation** — One `motion.g` element using `offsetDistance` with keyframes `[0%, 100%, 100%, 0%]` and `offsetRotate: "auto"` so the truck naturally faces the direction of travel at all times (including turns). No dual-truck opacity hack needed.

4. **Map details** — Water feature (river), green park areas, building blocks between roads, road labels, and subtle map-tile styling for realism.

### File Changed
| File | Change |
|---|---|
| `src/components/Pricing.tsx` | Full rewrite of SVG map and animation logic |

### Technical Detail
- The route path will be something like: `M 70,160 L 200,160 A 10,10 0 0 0 210,150 L 210,100 A 10,10 0 0 1 220,90 L 520,90` — straight road segments with rounded corner arcs
- Forward path uses `offsetDistance: ["0%", "100%"]`, return uses a reversed path with same approach
- Truck swap via opacity at the turnaround point, both using `offsetRotate: "auto"` so the truck always faces forward
- Animation loop: drive forward (3s) → pause at destination (1.5s) → drive back (2.5s) → pause at origin (1s)

