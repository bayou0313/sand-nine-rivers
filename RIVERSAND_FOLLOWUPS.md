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

**Architecture decisions confirmed (2026-04-25):**

- **Architecture path: Hybrid (Option C).** Phase 4 ships as Web PWA first. Phase 5 wraps with native iOS + Android shell via Capacitor or React Native (~5-7 days additional effort).
- **iOS push tolerance for v1: acceptable.** Web Push API limitations on iOS are tolerated for Phase 4. Phase 5 native shell resolves them.
- **Driver onboarding deadline: none fixed.** Phase 4 builds without compression pressure. Real drivers onboard onto fully-validated system.

**Architectural constraints flowing from these decisions:**

- Phase 4 must be Capacitor-wrappable from day one. No web-only APIs where native equivalents exist. Service worker design must accommodate native packaging.
- Push notification infrastructure uses Web Push API + FCM for Phase 4. Phase 5 swaps in native FCM (Android) and APNs (iOS) without rewriting the assignment-trigger logic.
- Asset bundle (icons, fonts, splash screens) sized for native packaging from start.
- Route preview map uses Google Maps embed (no live tracking in v1) — live tracking added when Phase 5 native unlocks reliable background geolocation.

**Next deliverable:** Phase 4 design document (~60-90 minutes structured writing). To be drafted next session. Phase 4 implementation begins only after design document is approved by CVO.

**Owner:** Silas Caldeira (CVO)
**Logged:** 2026-04-25
**Target phase:** Phase 4

---

**Dispatch architecture additions (2026-04-25, late session):**

Beyond the workflow redesign + decline + map + design system already
captured, Phase 4 must include:

- On-Duty / Off-Duty driver toggle (Uber-style availability self-management)
- Driver location reporting (periodic geolocation updates while on-duty)
- Driver state machine: offline → on_duty → busy → on_duty → off_duty
- Manual assignment path (operator picks driver, current pattern)
- Auto-dispatch path (no driver assigned, system finds nearest eligible)
- Proximity calculation: driver location → pit → delivery address total distance
- First-Accept-Wins logic with atomic single-winner enforcement
- Push cascade on decline or timeout (next-nearest driver gets push)
- Operator visibility into fleet status (all drivers + states + locations)

**Phase 4 split recommendation:**

- Phase 4.1 (~7-10 days): Workflow redesign + decline + design system +
  manual assignment push notifications + route preview. Operationally
  usable as standalone.
- Phase 4.2 (~5-7 days): On-duty toggle + location tracking + auto-dispatch
  + proximity routing + cascade logic. Automation layer on top of 4.1.

**Total Phase 4 (4.1 + 4.2): ~12-15 working days focused effort.**

**Open dispatch design decisions (pending CVO):**

- Decision A: Ship 4.1 and 4.2 sequentially, or as one Phase 4?
- Decision B: Push timeout window (30s / 60s / 2min)?
- Decision C: Push cascade automatic or operator-controlled?
- Decision D: Location update frequency for on-duty drivers?

These decisions are required before Phase 4 design document can be
finalized.

---

**ETA tracking + schedule arithmetic (2026-04-25, late session):**

Required Phase 4 capability:

- Per-order ETA at pit and at delivery, calculated from driver current
  location + Google Maps Distance Matrix
- 10 min load time at pit + 10 min unload time at customer baked into
  schedule arithmetic
- Chained ETAs across driver's order queue (each order's ETA depends
  on prior order completion)
- Recalculation on: driver location update, order assignment, workflow
  advance, completion
- Schedule visualization for driver (own day) and operator (fleet view)
- ETA-aware auto-dispatch: prefer driver who finishes soonest, not just
  nearest

Schema additions:

- orders.eta_at, orders.eta_at_pit, orders.eta_calculated_at
- orders.queue_position
- Possibly: configurable load_time_minutes / unload_time_minutes per
  business or per driver

Cost implication: Distance Matrix API call volume increases significantly.
Mitigation: smart recalc triggers (location delta thresholds, not blind
interval polling).

**Phase 4 sub-phase split (revised from 2-way to 3-way):**

- **Phase 4.1 — Foundation (~7-10 days):** Workflow redesign + decline +
  design system compliance + manual assignment + push notifications +
  static route preview map. Operationally usable as standalone.
- **Phase 4.2 — Dispatch automation (~5-7 days):** On-duty toggle +
  location tracking + auto-dispatch + proximity routing + push cascade
  + operator fleet visibility. Layered on 4.1.
- **Phase 4.3 — ETA + schedule (~3-4 days):** Chained ETA calculation +
  driver schedule view + operator fleet schedule + ETA-aware dispatch +
  customer ETA notifications (or deferred to Phase 5). Layered on 4.2.

**Total Phase 4 (all three sub-phases): ~15-19 working days focused effort.**

**Phase 4 design document:** Deferred to next session per CVO direction.
All three sub-phases captured here; design document will spec each
sub-phase with state machines, schemas, action contracts, and slice plans.

---

**Communication architecture (2026-04-25, late session):**

Decisions confirmed by CVO:

**SMS-first with voice as escape hatch:**

- Driver-customer communication primarily via SMS templates (pre-approved,
  pre-translated, professional)
- Free-text input available for both driver and customer when templates
  don't fit
- Voice calling reserved as escape hatch for genuinely complex situations
- Both directions translated automatically (Google Translate API or DeepL
  for free-text; pre-translated templates for common messages)
- All SMS and voice communication logged to driver_customer_communications
  table (or split into _sms and _calls tables)

**Bidirectional translation:**

- Customer's preferred language captured at order time (form field) with
  auto-update if customer's reply language differs
- Driver sends in English → customer receives in preferred language
- Customer sends in any language → driver receives in English
- Original + translation both stored for operator review and dispute resolution
- Confidence scoring on free-text translations; low-confidence flagged

**Customer arrival notifications:**

- Automated SMS/email at T-60 minutes and T-30 minutes before driver's
  calculated arrival
- Each notification includes "Refuse delivery" option (tap link, reply STOP)
- Customer refusal flips order to refused state, dispatch cancelled before
  truck departure (or recall if en route)
- Refusal reason captured for operator analytics
- Billing implications: refusal before T-60 = no charge, T-60 to arrival =
  potential cancellation fee (policy decision deferred)

**Pending CVO inputs:**

- Specific languages to support (likely English + Spanish minimum;
  Vietnamese, French, others TBD based on customer demographics)
- Free-text vs templates-only for driver outbound (recommendation: both,
  templates default with free-text fallback)
- Operator monitoring posture for SMS (recommendation: search-when-needed
  for SMS; spot-check or triggered review for voice)

---

**Hardware platform (2026-04-25, late session):**

Decision confirmed by CVO:

- Driver app deployed on company-owned Samsung Galaxy Tab A11+ 5G tablets
- Mounted in trucks, dedicated work device per truck
- Android-only (iOS not in scope — every driver gets the same tablet)
- Native Android via Capacitor wrap of existing web codebase

Tablet specifications:

- Samsung Galaxy Tab A11+ 5G
- 11-inch TFT LCD, 1920x1200, 90Hz
- MediaTek Dimensity 7300 (4nm)
- 6GB or 8GB RAM, 128GB or 256GB storage
- 7,040mAh battery, 25W fast charging
- 5G sub-6, Wi-Fi 5, Bluetooth 5.3
- Android 16, 7 years of support
- ~$400-600 per truck including mount, case, screen protector

Implications:

- Phase 4 architecture is native Android via Capacitor from baseline
  (not "PWA first, native later" — go native immediately)
- Push notifications, background processing, NFC, full-screen alerts all
  reliable on native Android
- Sideload via APK or Google Play internal testing track
- Mobile Device Management (MDM) recommended at 5+ tablets — deferred
- Cellular data plan needed per tablet (~$20-30/month per device)

**Pending CVO verification before ordering:**

- Stripe Tap to Pay certification for Samsung Galaxy Tab A11+ 5G
- Action: contact Stripe Terminal support to confirm device is on certified
  hardware list before ordering
- If not certified: switch to Galaxy Tab S9 or other certified model (NOT
  add separate card reader — defeats the purpose of NFC)

**Pending CVO decisions:**

- NFC use cases beyond Stripe Tap to Pay (driver sign-in, pit yard tap-in,
  truck pairing, etc. — none currently committed)
- Tablet acquisition timeline (development-only first vs immediate truck
  deployment)
- Number of tablets in initial purchase (1 for development, 1 for Silas's
  truck, more as drivers onboard)

---

**Stripe Tap to Pay (2026-04-25, late session):**

Required Phase 4 capability:

- Customer payment via NFC at delivery — customer taps card or phone on
  tablet's NFC chip
- No separate card reader hardware (tablet IS the reader)
- Stripe Terminal SDK integrated into native Android app
- Driver taps "Collect Payment" → customer taps card → payment processes
  → workflow advances to delivered

Architectural implications:

- Tap to Pay forces native Android (Stripe Terminal SDK is a native
  dependency, not web-compatible)
- Confirms native-Android-from-baseline decision (cannot do PWA first
  if tap-to-pay is a Phase 4 requirement)
- Stripe Terminal account configuration required (extension of existing
  Stripe account or separate Terminal account)
- PCI compliance posture remains Stripe-handled, but our app must follow
  Stripe Terminal integration requirements

Cost estimate:

- 2.7% + $0.05 per transaction (vs 2.9% + $0.30 for online)
- For $232 sand delivery: $6.31 in fees
- No monthly device fee, no separate hardware cost beyond tablet itself

Pending CVO action:

- Verify Galaxy Tab A11+ 5G certification (see Hardware section above)
- If certified: order tablets, build Tap to Pay into Phase 4
- If not certified: switch tablet model OR build with online payment only
  initially, add Tap to Pay when certified hardware available

---

**Phase 4 sub-phase split (revised again — final pending prioritization):**

Given full scope including hardware, native Android, Tap to Pay, and
communication infrastructure, Phase 4 is now larger than any single
shippable unit. Realistic sub-phase split:

- **Phase 4.1 — Foundation (~10-13 days):** Workflow redesign + decline +
  design system + manual assignment + push notifications + route preview.
  Web PWA initially, runs on tablet via Chrome.
- **Phase 4.2 — Native Android wrap (~5-7 days):** Capacitor wrap, deploy
  as APK to tablet. Adds reliable push, background, NFC capability,
  full-screen alerts. Same app, native shell.
- **Phase 4.3 — Stripe Tap to Pay (~4-6 days):** Stripe Terminal SDK
  integration, NFC payment flow at delivery.
- **Phase 4.4 — SMS communication (~4-5 days):** Templates with
  pre-translation, free-text translation, bidirectional flow, operator
  monitoring.
- **Phase 4.5 — Dispatch automation (~5-7 days):** On-duty toggle,
  location tracking, auto-dispatch, proximity routing, push cascade.
- **Phase 4.6 — ETA + customer notifications (~3-5 days):** Chained ETAs,
  driver schedule, customer arrival notifications, refuse-before-arrival.
- **Phase 4.7 — Twilio voice escape hatch (~3-4 days):** Voice calls when
  SMS won't suffice, recording, transcription via Whisper API.

**Total Phase 4: ~34-47 working days (7-10 weeks focused effort).**

**Roadmap prioritization session required before Phase 4 design document.**
This level of scope cannot ship as one phase. Next session opens with:

- Score each capability on operational pain, build complexity, dependencies
- Identify minimum viable Phase 4.1 (likely smaller than current ~10-13 day estimate)
- Sequence remaining sub-phases or defer to Phase 5+
- Phase 4 design document is written ONLY for the prioritized minimum viable scope

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
