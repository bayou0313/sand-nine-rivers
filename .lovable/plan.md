

# Revised Plan: Static HTML City Pages for Google Crawlability (GitHub Pages)

## Problem

City pages are client-side React (SPA). GitHub Pages serves only static files — no server-side rewrites or edge function routing like Vercel. Googlebot gets an empty HTML shell.

## Solution: Pre-render static HTML at build time

Generate a static `.html` file for each active city page during the GitHub Actions build step. These files live at `dist/{citySlug}/river-sand-delivery/index.html` and are served directly by GitHub Pages as fully crawlable HTML.

### How it works

```text
┌──────────────────────────────────┐
│  GitHub Actions build step       │
│                                  │
│  1. npm run build (Vite)         │
│  2. node scripts/prerender.mjs   │
│     → fetch city_pages from DB   │
│     → generate HTML per city     │
│     → write to dist/             │
│  3. Deploy dist/ to GH Pages    │
└──────────────────────────────────┘
```

### Files to create/change

| File | Change |
|------|--------|
| `scripts/prerender-cities.mjs` | **New.** Node script that queries `city_pages` table, generates a full HTML file per city with all SEO content (meta tags, JSON-LD, semantic HTML), and writes to `dist/{slug}/river-sand-delivery/index.html`. Includes a `<script>` redirect to load the SPA for interactive features. |
| `.github/workflows/deploy.yml` | Add `node scripts/prerender-cities.mjs` step **after** `npm run build` and **before** the deploy step. Pass `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as env vars from GitHub Secrets. |

### What each static HTML file contains

- Full `<head>`: title, meta description, canonical URL, Open Graph tags
- JSON-LD: `LocalBusiness`, `BreadcrumbList`, `FAQPage` schemas
- Semantic HTML body: h1, hero intro, pricing, why-choose, delivery details, local uses, local expertise, FAQ sections, other-cities links
- Inline minimal CSS for readability without JS
- A `<script>` tag that bootstraps the React SPA for interactive components (estimator, contact form)

### Pre-render script logic (`scripts/prerender-cities.mjs`)

1. Fetch all rows from `city_pages` where `status = 'active'`
2. For each city page, build a complete HTML document using the stored structured fields (`h1_text`, `hero_intro`, `meta_title`, `meta_description`, `faq_items`, `local_uses`, `local_expertise`, `delivery_details`, `why_choose_intro`, `content`)
3. Write to `dist/{city_slug}/river-sand-delivery/index.html`
4. Also fetch other active cities for internal linking in each page

### GitHub Actions changes

```yaml
- run: npm run build
- run: node scripts/prerender-cities.mjs
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
- uses: peaceiris/actions-gh-pages@v3
```

### User action required

You will need to add two GitHub Secrets to your repository:
- `SUPABASE_URL` — your backend URL
- `SUPABASE_SERVICE_ROLE_KEY` — your service role key (for server-side DB access during build)

### What stays the same

- `CityPage.tsx` remains unchanged — handles client-side navigation and interactive components
- `vercel.json` can be removed (not used with GitHub Pages)
- The React SPA still works for all routes via the existing 404.html fallback

