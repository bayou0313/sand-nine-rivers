

## Prompt 5 — Programmatic City Pages

### Overview
Create a system for auto-discovering cities near active PITs, generating AI content for each, and rendering dynamic SEO-optimized city landing pages. Adds a new database table, edge function for AI content generation, a new page component, and a management UI in the leads dashboard.

---

### Step 1 — Database Migration

**New table `city_pages`** with columns: `id`, `created_at`, `updated_at`, `pit_id` (FK to pits), `city_name`, `city_slug`, `state`, `zip_codes` (text[]), `lat`, `lng`, `distance_from_pit`, `base_price`, `status` (active/inactive/draft), `meta_title`, `meta_description`, `h1_text`, `content`, `content_generated_at`, `page_views`, `last_viewed_at`. UNIQUE on `(city_slug, pit_id)`.

RLS: public SELECT where `status = 'active'`, service_role ALL, anon UPDATE for page_views increment.

**Add column to `pits`**: `served_cities jsonb DEFAULT NULL`.

**RPC function** `increment_city_page_views(p_slug text)` — SECURITY DEFINER, increments `page_views` and sets `last_viewed_at`.

---

### Step 2 — Edge Function: `generate-city-page/index.ts`

New edge function using Lovable AI Gateway (`google/gemini-3-flash-preview`).

Accepts: `{ city_name, state, pit_name, distance, price, free_miles, saturday_available }`.

System prompt instructs SEO content generation for river sand delivery. User prompt requests `meta_title`, `meta_description`, `h1_text`, and HTML `content` — returned as JSON via tool calling (structured output).

Saves generated fields to city_pages record, sets `content_generated_at`.

CORS headers included. Auth via LEADS_PASSWORD in request body.

---

### Step 3 — Edge Function: Update `leads-auth/index.ts`

Add actions:
- **`list_city_pages`**: SELECT * from city_pages with pit name join, ordered by city_name.
- **`save_city_page`**: UPDATE city_pages record (meta_title, meta_description, h1_text, content, status).
- **`delete_city_page`**: DELETE from city_pages by id.
- **`discover_cities`**: Accept pit_id. Query pits record, use Google Places Nearby Search API (server-side fetch with `VITE_GOOGLE_MAPS_API_KEY` or a server-side key) to find localities within max_distance. Return list of cities with distances and prices. Does NOT auto-create records — returns candidates for confirmation.
- **`create_city_pages`**: Accept array of city objects. Bulk insert into city_pages. For each, invoke `generate-city-page` function to create AI content.
- **`toggle_city_page`**: Toggle status between active/inactive.

---

### Step 4 — New Page: `src/pages/CityPage.tsx`

Dynamic route component. On load:
1. Extract `citySlug` from URL params
2. Fetch from `city_pages` where `city_slug = param AND status = 'active'` (public RLS allows this)
3. If not found → redirect to `/`
4. Call `increment_city_page_views` RPC
5. Render with `react-helmet-async`: dynamic title, description, canonical, schema markup (LocalBusiness + BreadcrumbList)
6. Reuse homepage components: `Navbar`, `Hero` (with city-specific h1), `DeliveryEstimator`, rendered HTML content via `dangerouslySetInnerHTML`, internal links to other city pages, `Footer`
7. Fetch up to 5 other active city pages for "Other Areas We Serve" section

---

### Step 5 — Route Registration: `src/App.tsx`

Add route: `<Route path="/:citySlug/river-sand-delivery" element={<CityPage />} />`

Place above the catch-all `*` route but below explicit routes.

---

### Step 6 — Leads Dashboard: City Pages Manager

**NavPage type**: Add `"city_pages"` to union.

**NAV_ITEMS**: Insert `{ id: "city_pages", label: "City Pages", icon: MapIcon }` in EXPANSION section before "All Leads".

**State**: `cityPages` array, `cityPageFilter` (pit filter), `editingCityPage` for edit modal.

**Page content** (when `activePage === "city_pages"`):
1. Header with count + [Discover Cities] and [Regenerate All] buttons
2. Metrics bar: Active Pages, Total Views, Cities Covered, States Covered
3. PIT filter dropdown
4. Table: City, State, Slug/URL (clickable), PIT, Distance, Price, Status (pill), Views, Actions (View/Edit/Regenerate/Toggle)
5. Edit modal: city name, meta title (60 char counter), meta description (160 char counter), h1, status dropdown, content textarea, [Regenerate with AI] button

**Discover Cities flow**: Calls `discover_cities` action → shows confirmation dialog with city list, checkboxes, duplicate warnings → on confirm calls `create_city_pages` with selected cities → shows generation progress.

---

### Step 7 — Sitemap Edge Function: `generate-sitemap/index.ts`

Returns XML sitemap with static pages + all active city pages. Content-Type: `application/xml`. No auth required.

Note: Since Vercel serves static `public/sitemap.xml`, we'll add a Vercel rewrite for `/sitemap.xml` → the edge function URL, OR generate a static sitemap that gets rebuilt. Given the dynamic nature, the edge function approach is better — add a vercel.json rewrite.

---

### Files Changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | Create `city_pages` table, RLS, RPC, add `served_cities` to pits |
| `supabase/functions/generate-city-page/index.ts` | New — AI content generation via Lovable AI Gateway |
| `supabase/functions/generate-sitemap/index.ts` | New — dynamic XML sitemap |
| `supabase/functions/leads-auth/index.ts` | Add city page CRUD + discover actions |
| `src/pages/CityPage.tsx` | New — dynamic city landing page |
| `src/App.tsx` | Add `/:citySlug/river-sand-delivery` route |
| `src/pages/Leads.tsx` | Add City Pages nav item + management UI (~250 lines) |
| `vercel.json` | Add sitemap rewrite to edge function |

### Technical Notes
- AI content uses Lovable AI Gateway (LOVABLE_API_KEY already configured) with structured output via tool calling — no Anthropic API needed
- Google Places Nearby Search called server-side from leads-auth edge function using the existing API key
- City page views tracked via SECURITY DEFINER RPC to allow anonymous increment without broad UPDATE access
- Duplicate prevention: UNIQUE constraint + pre-check in discover flow; if two PITs cover same city, assign to lowest-price PIT

