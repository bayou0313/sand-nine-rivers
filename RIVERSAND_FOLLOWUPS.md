# Riversand — Known Follow-ups

_Tracking deferred work. Not a feature backlog — these are concrete, scoped items already audited and approved-for-later._

Last updated: 2026-04-25

---

## P2 — Server-side normalization (single backend cleanup pass)

Tackle as one backend pass **after all P1 frontend slices (1.A–1.D) ship**. Do not interleave with P1.

### P2-01 — Server-side phone digit normalization across all lead capture paths
**Rule**: `phone.replace(/\D/g, "")` before insert. Store digits only.

Reference implementation: `supabase/functions/leads-auth/index.ts:2907` (driver upsert path) — already does this correctly.

Paths to fix:
- `leads-auth` waitlist insert (writes to `waitlist_leads.customer_phone`)
- `leads-auth` `create_lead` action (if/where present — writes to `delivery_leads.customer_phone`)
- `send-email` `contact` type handler — ContactForm submission path
- `send-email` `out_of_area_lead` type handler — OutOfAreaModal submission path
- Any other server-side lead capture entry points discovered during the pass

**Audit step before fix**: grep all `.from("waitlist_leads"|"delivery_leads"|"customers")` writes and `customer_phone:` assignments in `supabase/functions/` to confirm coverage.

### P2-02 — Server-side email lowercase + trim across same paths
**Rule**: `email.trim().toLowerCase()` before insert.

Same path list as P2-01.

Reference gap: `leads-auth` driver upsert (lines 2927, 2956) currently trims email but does **not** lowercase. Fix here too.

**Why it matters**: Client-side `formatEmail` only runs in Order/OrderMobile/DriverModal/CityPage(post-1.A)/ContactForm(post-1.C)/OutOfAreaModal(post-1.B). Server-side normalization is the safety net against duplicates like `John@X.com` vs `john@x.com` in `customers.email`, `waitlist_leads.customer_email`, `delivery_leads.customer_email`.

---

## P4 — Edge function maintenance

### P4-01 — Deno npm: import drift in edge functions
- `send-email/index.ts` line 3: `import { createClient } from "npm:@supabase/supabase-js@2.57.2"` fails Deno runtime check
- Affected: `send-email` + build-chain-related failures in `holiday-confirm`, `holiday-notifier`, `send-holiday-email`
- Fix: swap to `https://esm.sh/@supabase/supabase-js@2.57.2` (matches other edge functions' pattern)
- Scope: small, one-line change per file, 4 files total
- Risk: `send-email` is on file-protection list — requires isolated audited slice with smoke test on transactional emails (order confirmation, lead emails, etc.)
- Priority: Medium — functions currently work in production (errors are build-check warnings, not runtime failures); but any future deploy that triggers a full recheck will fail
- Discovered: Phase 3a migration post-check (2026-04-25)

### P4-02 — Driver portal today/tomorrow view uses UTC date slicing
Phase 3b should add explicit operator timezone setting (likely America/Chicago for Louisiana) to the `driver-auth` `list_my_orders` action. Current ±1 day slop is acceptable for Phase 3a but will cause edge-case confusion during late-night driver sessions.
- Discovered: Phase 3a code review (2026-04-25)

## P4 — Driver workflow redesign + decline mechanism + embedded map (CVO-flagged 2026-04-25)

**Decision (2026-04-25):** CVO confirmed Phase 3b workflow does not model operational reality. Phase 4 redesign is committed and prioritized ahead of real driver onboarding. Phase 3b polish work (UI/UX compliance pass, embedded map exploration, navigation modals) HALTED. Phase 3b+1 (rate limiter, SECURITY_ROADMAP §1.4) continues independently as a security item.

**Status:** Scope captured. Implementation deferred to Phase 4 driver
financial module + dispatch foundation.

**Background:** Three Phase 4 requirements surfaced during Phase 3b smoke:
1. Workflow redesign (pit expense + customer collection separation, Google
   Maps handoffs, granular states)
2. Driver decline mechanism (return order to unassigned pool)
3. Embedded driver map at top of order detail view (live driver location +
   route to current destination)

All three touch driver workflow layer; bundle as single Phase 4 effort.

**Required workflow (replaces current 4-state machine):**
1. Accepted → driver accepts assignment
2. (Driver may decline at this state — order returns to unassigned pool)
3. En route to pit → driver navigating (embedded map shows route to pit)
4. At pit → driver arrived, loading truck
5. Pit purchase recorded → cash/check/card paid TO the pit (business outflow)
6. Loaded → truck loaded, expense recorded, decline no longer allowed
7. En route to customer → driver navigating (embedded map switches to
   customer destination)
8. At delivery → driver arrived at customer site
9. Delivered → load delivered, customer payment collected (business inflow)
10. Order complete → driver advances to next assigned order

**Schema additions:**
- New columns on orders:
  - pit_purchase_cash, pit_purchase_check, pit_purchase_card
  - pit_purchase_at
  - declined_at, declined_by_driver_id, decline_reason, decline_count
- New workflow states: en_route_to_pit, en_route_to_customer, at_delivery
- Possibly: pit_transactions table (multi-order pit trips)
- Possibly: driver_locations table (if persisting driver positions for
  operator fleet view — see embedded map design notes below)

**New edge function actions (driver-auth):**
- decline_order — sets driver_id NULL, stamps declined_at, increments
  decline_count, records reason; only allowed at acknowledged or earlier
- record_pit_purchase — records material expense at pit
- advance_workflow needs to support new states with proper gates
- Possibly: update_driver_location — if persisting positions

**Integrations:**
- Embedded Google Maps in DriverOrder.tsx (vs current deep link only)
  - Browser Geolocation API for live driver position
  - Map shows driver marker + current destination marker + route polyline
  - Destination marker swaps based on workflow state (pit → customer)
  - Permission flow: prompt on first state transition that needs map
- Possibly pit selection engine (closest + cheapest tie-break)
- Google Maps deep link as fallback if embedded map fails

**Embedded map design decisions (Phase 4 spec phase):**
- Live tracking vs static destination map
  (live = battery/data/cost; static = simpler, ~80% of value)
- Persist driver location server-side (enables fleet view) vs client-only
  (lower privacy footprint, no PII custody)
- Update frequency for live tracking (every 5s, 30s, 60s?)
- Battery saver / pause tracking option for drivers
- Permission denial fallback (static destination map only)
- Dead zone behavior (freeze last position, show offline state)
- Cost modeling — Google Maps embedded loads have per-impression pricing;
  negligible at 2 drivers, real at 50

**Operator dashboard updates:**
- Pit expense ledger view
- End-of-day reconciliation report
- Declined order queue with reassignment workflow
- Decline pattern analytics per driver
- Per-order decline_count flag (3+ declines = problematic order alert)
- Possibly: fleet map view (all drivers on one map) — only if location is
  persisted server-side

**Effort estimate:** ~5-7 working days focused effort.
- Schema: ~1.5 hours
- driver-auth: ~6-8 hours
- DriverOrder.tsx: ~10-14 hours (workflow UI + decline + embedded map)
- Operator dashboard: ~6-8 hours
- Notifications: ~1 hour
- Map integration design + cost modeling: ~2-3 hours
- Testing + smoke: ~3-4 hours
- Documentation: ~2 hours

**Dependencies:**
- Audit log (SECURITY_ROADMAP §2.4) becomes Priority 1
- Server-side parity gates (§2.5) need symmetric enforcement on both
  payment transactions
- Realtime subscriptions on orders table (currently only on notifications)
  — required for operator visibility on declined orders if 15-second
  polling delay is unacceptable
- Decision on driver location PII persistence (privacy/security review)

**Threat model expansion (vs current Phase 3b):**
- Driver under-reporting pit purchase
- Driver over-reporting pit purchase
- Driver cherry-picking via decline
- Two-sided financial fraud surface
- Driver location PII custody (if persisted)
- Driver location spoofing (if used for any business logic) — currently
  display-only so not a vector, but flagged for future
- Mitigation: pit receipts, supplier invoices, periodic reconciliation,
  decline pattern analytics, location persistence governance

**Edge cases to design for:**
- Multiple loads from same pit on same trip
- Mixed payment methods (cash to pit, Stripe from customer)
- Pit on terms (accounts payable tracking)
- Customer underpayment or dispute at delivery
- Google Maps offline / dead zone (both deep link and embedded map)
- Truck breakdown mid-route
- Pit closes mid-day, driver redirects
- Driver declines after 3 prior drivers also declined (cascade)
- Customer-paid Stripe order gets declined (no auto-refund; operator decides)
- Driver denies location permission
- Battery drain complaints / driver requests pause tracking

**Notes:**
- Foundational for business model, not feature polish
- Required before owner-operator marketplace, franchise, multi-pit expansion
- Required before DriveDigits-style automated dispatch
- Required before operator fleet visibility (location-dependent)
- Phase 3b's payment-at-delivery correction is the interim solution
  until Phase 4 ships
- "Acknowledge → Accept" vocabulary fix shipped in Phase 3b polish (2026-04-25)

**Owner:** Silas Caldeira (CVO)
**Logged:** 2026-04-25
**Target phase:** Phase 4

---

## P3 — UX polish (deferred indefinitely until prioritized)

- `formAttempted` red-border validation pattern → ContactForm, WhatsAppButton, OutOfAreaModal, CityPage (match Order.tsx UX)
- DriverModal Notes → `formatSentence` wrapper (low priority — operator-only field)

---

## Pending — Security hardening

### P5-03 — CORS allowlist tightening on remaining edge functions
- `leads-auth` and others still use `Access-Control-Allow-Origin: "*"` wildcard
- Same approach as P5-01 (driver-auth model: ALLOWED_ORIGINS array + isAllowed() + corsFor() + per-request `const cors = ...` injection)
- Effort: ~30 min per function, can batch into one slice
- Priority: Medium (less urgent now that the most-exposed function is hardened)
- Discovered: Security Roadmap Priority 1.1 follow-on (2026-04-25)

### P5-04 (Security Priority 2.1) — Move driver session tokens from localStorage to httpOnly cookies
- Current: `localStorage["driver_session_token"]` readable by any JavaScript
- Risk: XSS attack could steal session tokens
- Fix: server sets `Set-Cookie` with `httpOnly` + `Secure` + `SameSite=None` flags
- Effort: ~4–6 hours; refactor `driver-auth` + `Driver.tsx`
- Priority: Should ship before fleetwork.net migration
- Discovered: Security Roadmap (2026-04-25)

### P5-05 (Security Priority 2.3) — CSP headers on all surfaces
- Current: no Content Security Policy headers anywhere
- Fix: add CSP via Lovable config (riversand.net) and meta tag (fleetwork.net)
- Effort: ~4 hours including report-only testing period
- Priority: Before ways.us brand launch
- Discovered: Security Roadmap (2026-04-25)

---

## Completed

### Phase 3a + Priority 1 security hardening (2026-04-25)
- ✅ **P5-01 (Security Priority 1.1)** — CORS allowlist tightened on `driver-auth`
  - Replaced `Access-Control-Allow-Origin: "*"` with origin-based allowlist
  - Allowed: `riversand.net`, `www.riversand.net`, `fleetwork.net`, `www.fleetwork.net`, `*.lovable.app`, localhost ports (3000/5173/8080)
  - Disallowed origins receive no ACAO header (browser blocks); missing origin processed without ACAO (server-to-server unaffected)
  - Smoke tests passed: 5 origin scenarios verified (allowed echoes, no-origin, malicious-origin, lovable preview wildcard, OPTIONS preflight)
- ✅ **P5-02 (Security Priority 1.2)** — `pin_hash` → `pin_set` boolean in `list_drivers`
  - `leads-auth` `list_drivers` now returns derived `pin_set: !!pin_hash`
  - `pin_hash` field stripped from API response (still selected server-side for the `!!` derivation)
  - `DriverModal` and `Driver` type updated to read `pin_set` instead of `pin_hash`
  - Server-side verified via curl: `pin_set` present as bool, `pin_hash` absent

### P1 frontend formatting cleanup (2026-04-24)
- ✅ **Slice 1.A** — CityPage waitlist form
- ✅ **Slice 1.B** — OutOfAreaModal
- ✅ **Slice 1.C** — ContactForm
- ✅ **Slice 1.D** — WhatsAppButton callback form

### Documentation (2026-04-24)
- ✅ **CORE_FLOW_REFERENCE regeneration** — split into `CORE_FLOW_REFERENCE.md` (customer flow) + `LMT_REFERENCE.md` (operator surface). Both supersede the April 1 snapshot.

### Earlier
- ✅ DriverModal Name field — `formatProperName` + `formatProperNameFinal` wrappers (applied 2026-04-24)
