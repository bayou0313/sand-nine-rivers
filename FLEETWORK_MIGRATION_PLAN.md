# FLEETWORK_MIGRATION_PLAN.md — Driver Portal Production Home Migration

**Version:** 1.0 (2026-04-25)
**Status:** Planning. Migration will NOT execute until Phase 3c is shipped and validated.
**Target date:** Approximately 6-8 weeks from Phase 3a shipped (2026-04-24). Actual execution TBD based on Phase 3b/3c completion.

---

## Decision record

**What:** The driver-facing portal will be migrated from `riversand.net/driver` to `fleetwork.net` as its production home.

**Why:**
1. **Brand separation** — Drivers accessing a work tool should not see the customer-marketing URL. "fleetwork.net" is clearly an operational tool; "riversand.net" is where customers buy sand.
2. **SEO protection** — riversand.net has 47 city pages, #1 Chalmette organic ranking, active sitemap crawl strategy. Isolating driver-side code changes from that surface reduces risk of accidentally breaking customer-facing SEO.
3. **Deploy independence** — A broken customer-site deploy won't take drivers offline mid-shift. A driver-portal hotfix won't risk the city pages.
4. **PWA-friendliness** — fleetwork.net can be installed on drivers' phone home screens with proper branding ("Fleetwork" app icon, not "Riversand").
5. **Scalability** — As driver count grows past 10+, the separation pays off in operational independence.

**Why not earlier:**
- Phase 3a through 3c are built and tested at `riversand.net/driver` first because building in a known-working environment is faster than building + migrating + debugging simultaneously.
- Migration before Phase 3c complete = porting half-built code with risk of dropping payment-capture or signature bugs during port.

---

## Migration scope — what moves, what stays, what's shared

### MOVES to fleetwork.net (driver-side frontend)

- `src/pages/Driver.tsx` — login + order list view
- `src/pages/DriverOrder.tsx` — per-order detail view (Phase 3b)
- Any driver-facing components added in 3b/3c
- Minimal supporting lib code (brand constants, format helpers, Supabase client initialization)
- Route structure for /driver and /driver/order/:id (become root and /order/:id on fleetwork.net)

### STAYS at riversand.net

- Entire customer-facing site (homepage, city pages, Order.tsx, OrderMobile.tsx, etc.)
- `/leads` operator surface (LMT)
- Customer authentication, Stripe integration, email flows
- SEO/sitemap/crawl infrastructure
- `/driver` and `/driver/order/:id` routes become 60-day redirects to fleetwork.net, then removed entirely

### SHARED (neither moves — both surfaces call these)

- Supabase database (single project: `lclbexhytmpfxzcztzva`)
- All edge functions:
  - `driver-auth` — called by fleetwork.net only (after migration)
  - `leads-auth` — called by riversand.net/leads only
  - All other edge functions — unchanged
- Database schema (single schema, shared tables: drivers, orders, driver_sessions, customers, leads, etc.)
- Row Level Security policies — unchanged

---

## Technical migration steps (high-level)

### Pre-migration (before any code moves)

1. **Tighten CORS allowlist on driver-auth** to include both riversand.net (for the transition period) and fleetwork.net
2. **Verify fleetwork.net DNS + HTTPS** — confirm GitHub Pages or chosen host serves HTTPS cleanly with auto-renewing certs
3. **Decide on session token storage strategy** — localStorage (current) or httpOnly cookies (recommended; cross-origin cookies require SameSite=None + Secure)
4. **Create fleetwork.net repo** — separate Lovable project or standalone GitHub repo depending on deployment approach chosen
5. **Document the cutover plan** — explicit step-by-step including rollback trigger conditions

### Migration day

1. Deploy fleetwork.net with the driver portal code (copy + adapt from riversand.net/driver)
2. Smoke test on fleetwork.net in parallel — set a test PIN, log in, verify order list
3. Announce to all active drivers: "New URL: fleetwork.net. Old URL still works for 60 days."
4. Flip `/driver` on riversand.net to redirect to fleetwork.net (HTTP 301)
5. Monitor Supabase edge function logs for 48 hours — any unexpected 401/403 or origin rejections

### Post-migration cleanup (60 days later)

1. Remove `/driver` and `/driver/order/:id` routes from riversand.net App.tsx
2. Remove Driver.tsx, DriverOrder.tsx, and supporting code from riversand.net repo
3. Remove isAdminRoute extension for /driver (no longer needed)
4. Supabase CORS allowlist tightens to fleetwork.net only
5. Update documentation: CORE_FLOW_REFERENCE, LMT_REFERENCE, RIVERSAND_CONTEXT

---

## Estimated effort and cost

**Effort:** 12-16 hours of focused work across 2-3 sessions.
- Pre-migration prep: ~4 hours
- Migration day execution: ~4-6 hours
- Post-migration cleanup (60 days later): ~2-3 hours
- Documentation updates: ~2-3 hours

**Cost:** Zero incremental hosting cost (GitHub Pages is free for fleetwork.net). Supabase costs unchanged. DNS is already paid.

**Risk level:** Low, if done after Phase 3c is validated.
- Zero risk to customer-facing riversand.net (nothing moves there that would affect SEO or checkout)
- Drivers have 60-day transition window with both URLs working
- Rollback is trivial: if fleetwork.net has problems, drivers stay on riversand.net/driver until fixed

---

## Decisions deferred to the migration session

These don't need answers now, but will need answers before the migration slice:

1. **Session token storage** — stay with localStorage, or upgrade to httpOnly cookies during migration? (Recommendation: upgrade; addresses Priority 2.1 from SECURITY_ROADMAP)
2. **CSP headers** — add CSP on fleetwork.net from day one, or defer? (Recommendation: add from day one; addresses Priority 2.3 from SECURITY_ROADMAP)
3. **PWA manifest** — add PWA installability (icon, splash screen, offline shell) during migration? (Recommendation: yes; zero cost and improves driver UX)
4. **Deployment approach** — separate Lovable project, or standalone GitHub repo with direct GitHub Pages? (Recommendation: start with GitHub Pages for simplicity; Lovable project if complexity grows)
5. **Authentication cookie domain strategy** — cookies scoped to fleetwork.net, or broader? (Recommendation: fleetwork.net only; tighter scope = safer)
6. **Analytics** — add GA4/GTM to fleetwork.net to track driver behavior, or keep it analytics-free for operational tool? (Recommendation: analytics-free; operators watch usage via /leads)

---

## Gates that must be passed before migration starts

Do not begin migration work until ALL of these are true:

- [ ] Phase 3a smoke-tested and confirmed working with real drivers
- [ ] Phase 3b shipped, smoke-tested, stable for 2+ weeks
- [ ] Phase 3c shipped, smoke-tested, stable for 2+ weeks
- [ ] Signature and photo capture working reliably on real driver devices (iOS + Android)
- [ ] Payment capture reconciliation validated against at least one real delivery week
- [ ] Priority 1 security items from SECURITY_ROADMAP resolved (CORS allowlist, pin_set boolean)
- [ ] Documented runbook exists for "what if fleetwork.net breaks mid-shift"

---

## Rollback plan

If fleetwork.net has critical issues after cutover:

1. **Immediate (under 1 hour):** Revert the 301 redirect on riversand.net/driver. Drivers use riversand.net/driver again. Supabase CORS still allows both origins during transition period, so no backend change needed.
2. **Within 24 hours:** Fix whatever's broken on fleetwork.net, redeploy, test, re-enable redirect.
3. **Communication:** Operators can message drivers directly via existing WhatsApp comms pattern (Phase 2 shipped) if the URL change is causing confusion.

---

## Ownership and update log

**Owner:** Silas Caldeira (CEO/CVO)
**Last reviewed:** 2026-04-25
**Next review:** When Phase 3c ships, before any migration work begins.

**Update log:**
- 2026-04-25 — v1.0 initial draft. Migration target date TBD based on Phase 3b/3c completion.

---

End of FLEETWORK_MIGRATION_PLAN.md v1.0
