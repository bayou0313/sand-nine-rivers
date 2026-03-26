

## SEO Corrections for River Sand Product Page

### Current State
- The site serves the River Sand page at `/` (root), not `/products/river-sand`
- `index.html` already has meta tags, canonical, and some JSON-LD (LocalBusiness, Product, FAQPage) but they need updating
- All H2 headings are ALL CAPS
- FAQ uses Accordion components, not semantic `h3`/`p` tags
- No BreadcrumbList schema, no related products section, no E-E-A-T trust block

### Important Note on URL/Routing
The user requests the page live at `/products/river-sand`. Currently it's at `/`. This plan will add `/products/river-sand` as an **additional route** pointing to the same Index page, and add a redirect from `/` to `/products/river-sand` so the canonical URL is correct. The `/` route will remain as a redirect.

---

### 1. Meta Tags — `index.html`
Update existing tags to match the exact values requested:
- `<title>` → `River Sand Delivery New Orleans | WAYS`
- `<meta name="description">` → exact copy provided
- `og:title`, `og:description`, `og:url` → exact values provided
- Remove `og:image` and Twitter tags (not requested, keep if desired — will preserve them)

### 2. JSON-LD Schema — `index.html`
Replace the three existing JSON-LD blocks with four blocks:

- **LocalBusiness** — keep as-is (not mentioned, no changes)
- **Product** — replace with user's exact schema (adds `brand`, `aggregateRating`, restructured `areaServed`)
- **FAQPage** — replace with all 6 FAQ items pulled from `src/components/FAQ.tsx` (currently only 4 are in the schema)
- **BreadcrumbList** — add new block with Home → Products → River Sand

### 3. Heading Structure — Convert ALL CAPS H2s to Title Case
Files affected (one-line change each):
- `src/components/Pricing.tsx`: "DELIVERY AREA & PRICING" → "Delivery Area & Pricing"
- `src/components/DeliveryEstimator.tsx`: "DELIVERY AREA & PRICING" → "Delivery Area & Pricing"
- `src/components/About.tsx`: "WHY NEW ORLEANS CONTRACTORS CHOOSE RIVERSAND.NET" → "Why New Orleans Contractors Choose RiverSand.net"
- `src/components/RiverSandInfo.tsx`: "WHAT IS RIVER SAND AND WHEN SHOULD YOU USE IT?" → "What Is River Sand and When Should You Use It?"
- `src/components/Features.tsx`: "DELIVERY SCHEDULE & AVAILABILITY" → "Delivery Schedule & Availability"
- `src/components/Testimonials.tsx`: "WHAT NEW ORLEANS CUSTOMERS SAY" → "What New Orleans Customers Say"
- `src/components/CTA.tsx`: "READY TO ORDER?" → "Ready to Order?"
- `src/components/FAQ.tsx`: "FREQUENTLY ASKED QUESTIONS ABOUT RIVER SAND DELIVERY" → "Frequently Asked Questions About River Sand Delivery"
- `src/components/ContactForm.tsx`: "TALK TO US" → "Talk to Us"

### 4. FAQ Semantic Headings — `src/components/FAQ.tsx`
- Wrap each FAQ question in an `h3` tag instead of relying on AccordionTrigger's default `span`
- Ensure answers render in `p` tags within AccordionContent

### 5. Related Products Section — New Component `src/components/RelatedProducts.tsx`
- Heading: `<h2>Also Available for Same-Day Delivery</h2>`
- 4 cards linking to `/products/fill-dirt`, `/products/limestone`, `/products/masonry-sand`, `/products/topsoil`
- Descriptive anchor text: "Fill Dirt Delivery", "Limestone Delivery", etc.
- Place in `src/pages/Index.tsx` between CTA and FAQ

### 6. E-E-A-T Trust Block — `src/components/Stats.tsx`
- Add a single paragraph below the stats grid:
  > "Family-owned and operated in New Orleans since 2009. Licensed, insured, and GPS-tracked on every delivery."
- Styled as body text, centered, subtle

### 7. Routing — `src/App.tsx`
- Add route: `/products/river-sand` → `<Index />`
- Add redirect: `/` → `/products/river-sand` using `<Navigate to="/products/river-sand" replace />`
- This ensures the canonical URL matches and existing links still work

---

### Files touched
| File | Change |
|---|---|
| `index.html` | Meta tags, Product/FAQ/Breadcrumb JSON-LD |
| `src/App.tsx` | Add `/products/river-sand` route + redirect |
| `src/components/Pricing.tsx` | Title case H2 |
| `src/components/DeliveryEstimator.tsx` | Title case H2 |
| `src/components/About.tsx` | Title case H2 |
| `src/components/RiverSandInfo.tsx` | Title case H2 |
| `src/components/Features.tsx` | Title case H2 |
| `src/components/Testimonials.tsx` | Title case H2 |
| `src/components/CTA.tsx` | Title case H2 |
| `src/components/FAQ.tsx` | Title case H2 + semantic h3/p |
| `src/components/ContactForm.tsx` | Title case H2 |
| `src/components/Stats.tsx` | E-E-A-T trust line |
| `src/components/RelatedProducts.tsx` | New — related products section |
| `src/pages/Index.tsx` | Insert RelatedProducts component |

