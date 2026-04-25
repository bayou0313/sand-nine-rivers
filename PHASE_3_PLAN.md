# PHASE_3_PLAN.md — Path B Phase 3 Driver Portal

**Version:** 1.2 (2026-04-25, Phase 3a validated with one P1 follow-up)
**Status:** Phase 3a shipped + validated 2026-04-25 (T1/T2 PASS, T3 FAIL → SECURITY_ROADMAP.md §1.4 Priority 1 follow-up scheduled Phase 3b+1). Phase 3b code brief pending.

### Phase 3b Status

**Status (2026-04-25):** Shipped. Post-deploy corrections applied (FK migration, payment gate move, Accept vocabulary). Smoke testing HALTED on CVO direction — workflow design does not match operational reality. Phase 4 redesign required before driver onboarding. See RIVERSAND_FOLLOWUPS.md P4-03 for redesign scope. Phase 3b code remains deployed but unvalidated for real-world use.
**Scope:** Operational dispatch only. Financial features (payroll, petty cash, check tracking) deferred to Phase 4. Tap to Pay NFC deferred to future web-compatible payment project.
**Estimated timeline (3b + 3c):** 3-4 weeks across two sub-slices. Each independently shippable and rollback-able.
**Production home:** Currently building at `riversand.net/driver` as staging surface. Migration to `fleetwork.net` happens after Phase 3c validated.

**Phase 4 scoping (2026-04-25):** Phase 4 scope expanded significantly
in late-session conversation. Now ~34-47 day total effort across 7
sub-phases. Roadmap prioritization required before Phase 4 design
document is written. See RIVERSAND_FOLLOWUPS.md P4-03 for full scope
capture and pending decisions.

---

## Architectural decisions (locked)

**Auth:** PIN-based. Driver enters phone + 4-6 digit PIN. PIN set by operator in `/leads` Drivers tab via DriverModal. Persistent 30-day session tokens stored in localStorage (move to httpOnly cookies planned for migration slice or before). No SMS OTP, no magic links.

**Visibility window:** Today + tomorrow's assigned orders, grouped by day. No history view, no further-future view. Real-time updates when operator reassigns an order (via Supabase Realtime in Phase 3b, or polling fallback at 30s intervals — already implemented in 3a).

**Workflow states:** `acknowledged` → `at_pit` → `loaded` → `delivered`. Four states. Driver advances each state via tap. Each transition timestamps and syncs back to `/leads`.

**Payment capture (at_pit step):** Driver enters cash amount, check amount, card amount as three separate free-form dollar fields. No validation against expected order total at entry time (driver-reported model). Reconciliation happens later in `/leads` operator UI.

**Proof of delivery (delivered step):** Customer signature on a canvas, plus required photo capture. Both stored in Supabase Storage with RLS protecting per-driver and per-order access.

**Maps:** Embedded static Google Maps per order showing pit + delivery pin. Plus an "Open in Google Maps" deep link button for actual navigation. Static maps for in-portal orientation, deep link for turn-by-turn.

**Connectivity:** Persistent web app. 30-second auto-refresh when foregrounded. No PWA push notifications, no background sync, no offline support.

**Stripe Tap to Pay:** NOT in Phase 3. Deferred to future web-compatible payment project. Driver records collected amounts only.

---

## Sub-slice 3a — Auth foundation + portal shell

**Status:** SHIPPED 2026-04-24. Deployed to production. Unvalidated pending smoke test.

**What shipped:**
- `drivers` table additions: `pin_hash`, `pin_set_at`, `last_login_at`
- New `driver_sessions` table with RLS (service_role only)
- New edge function `driver-auth` at supabase/functions/driver-auth/index.ts (314 lines)
- New leads-auth action `set_driver_pin` (inserted after upsert_driver at line 2990)
- New page `src/pages/Driver.tsx` at `/driver` route
- App.tsx: lazy import, 2 routes (driver + driver/order/:id placeholder), isAdminRoute extension to include /driver
- DriverModal.tsx: PIN management section (Edit mode only, bcrypt hashing via leads-auth, revokes sessions on change)
- Type update: `pin_hash?: string | null` added to Driver interface
- leads-auth list_drivers SELECT extended to include pin_hash

**Known deferred items (logged in RIVERSAND_FOLLOWUPS.md):**
- P4-01: Deno npm: import drift in send-email + holiday-* functions (pre-existing, out of Phase 3a scope)
- P4-02: Driver portal today/tomorrow uses UTC date slicing with ±1 day timezone slop (Phase 3b should add explicit operator timezone)

**Security notes:**
- CORS currently wide open (`*`). Priority 1 security hardening item — fold into Phase 3b or address as standalone security slice before fleetwork.net migration.
- Session tokens in localStorage (XSS-readable). Priority 2 security hardening — move to httpOnly cookies before or during fleetwork.net migration.
- list_drivers returns pin_hash to operator browsers. Priority 1 — replace with derived boolean `pin_set`.

**Smoke test checklist (T1–T9):** 
T1 — Drivers tab PIN management (set/reset PIN via DriverModal)
T2 — Driver login happy path
T3 — Driver login validation (red borders, inline errors)
T4 — Orders polling (assign in /leads, appears in /driver within 30s)
T5 — Logout + revocation (PIN reset from /leads kills active sessions)
T6 — Rate limit (5 attempts/60s/IP, with cold-start bypass tolerance)
T7 — Route gating (maintenance mode bypass for /driver)
T8 — Session expiry message (invalid token → "Signed out. Please sign in again.")
T9 — First-time visitor (fresh incognito, login renders cleanly)

### Phase 3a Validation Results — executed 2026-04-25

Method: bootstrapped a test driver row directly in production DB (`name='TEST_VALIDATION_DRIVER'`, `phone='5555550199'`, `pin='9999'`, bcrypt cost 10, id `98dd74c6-d8f0-4a1e-b07f-131abf783b70`), ran 3 tests against the deployed `driver-auth` edge function with `User-Agent: riversand-validation-2026-04-25`, then deactivated the driver and revoked the session via cleanup migration. Row retained for audit trail; not deleted.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T1 | PIN login (5555550199 / 9999) | HTTP 200 + session_token; `driver_sessions` row created with correct UA + IP + 30-day expiry; `drivers.last_login_at` updated | HTTP 200, token issued; session row present (UA=`riversand-validation-2026-04-25`, IP=34.7.97.187, `expires_at = now() + 30d`, `revoked_at IS NULL`); `last_login_at` set | ✅ PASS |
| T2 | Session round-trip via `list_my_orders` (valid + tampered token) | Valid token → HTTP 200 + driver identity; tampered token → HTTP 401 | Valid → HTTP 200, returned `{driver: {…}, orders: []}`; tampered → HTTP 401 `{"error":"Unauthorized"}` | ✅ PASS |
| T3 | Warm rate limiter (6 bad PINs from same IP within 60s) | Attempts 1–5: HTTP 401, attempt 6: HTTP 429 | 21 rapid bad-PIN attempts in ~25s, all 21 returned HTTP 401, **zero HTTP 429s** | ❌ FAIL |

**T3 root cause:** The in-memory `rateMap` in `supabase/functions/driver-auth/index.ts` lines 88–106 does not survive Supabase isolate boots. Edge function logs confirm frequent `Boot` events (effectively per-request under low traffic). Each request lands on a fresh isolate with an empty rate map, so the counter never reaches the threshold. The code's prior comment "cold-start bypass acknowledged" understated the gap — it is non-functional in production, not best-effort.

**Severity:** Bcrypt at cost 10 (~70ms per attempt) caps an attacker at ~14 attempts/sec/IP, ~50K/hour. A 4-digit PIN has 10K possibilities — worst-case brute force of a known-phone driver is ~12 minutes. Bcrypt latency is currently the only real brake. Not catastrophic (attacker must know a valid driver phone first; legitimate driver login still works during attack so it's noisy), but not the "5 attempts then locked out" defense the code claims to provide.

**Follow-up plan:** Logged as Priority 1 in SECURITY_ROADMAP.md §1.4. Fix is a DB-backed limiter (`driver_login_attempts` table, `(ip_address, attempted_at)` index, server-side count check before bcrypt), ~30–45 min slice. **Ship immediately after Phase 3b code brief, before any real driver onboards.** Does not block Phase 3b.

**Test driver cleanup:** Migration `deactivate_phase_3a_test_driver` ran 2026-04-25. `drivers.active` set to `false` for the test driver id; outstanding `driver_sessions.revoked_at` set to `now()` for that driver_id. Row retained for audit (PIN hash unchanged; reactivation possible if revalidation needed).

---

## Sub-slice 3b — Workflow states + payment capture

**Status:** PENDING. Do not start until 3a smoke-tested.

**Goal:** Driver can advance an order through acknowledged → at_pit → loaded → delivered. At at_pit, driver enters payment amounts. Real-time sync to /leads.

### Schema additions

```sql
-- orders.driver_workflow_status text already added in Phase 0. 
-- Possible values: null, 'acknowledged', 'at_pit', 'loaded', 'delivered'

-- Track timestamps for each transition
ALTER TABLE orders ADD COLUMN acknowledged_at timestamptz;
ALTER TABLE orders ADD COLUMN at_pit_at timestamptz;
ALTER TABLE orders ADD COLUMN loaded_at timestamptz;
ALTER TABLE orders ADD COLUMN workflow_delivered_at timestamptz;
  -- named workflow_delivered_at to avoid collision with existing delivery_date

-- Payment capture at at_pit step
ALTER TABLE orders ADD COLUMN driver_collected_cash numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN driver_collected_check numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN driver_collected_card numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN driver_collected_at timestamptz;

-- Index for /leads "in progress" queries
CREATE INDEX idx_orders_driver_workflow ON orders(driver_id, driver_workflow_status) 
  WHERE driver_workflow_status IS NOT NULL;
```

### New driver-auth actions

**`advance_workflow`** — input: `{ order_id, new_status }`
- Verify session
- Load order, confirm driver_id matches session's driver_id
- Validate new_status is exactly one step ahead of current (strict state machine enforcement)
- Set corresponding timestamp column (acknowledged_at, at_pit_at, loaded_at, workflow_delivered_at)
- Update driver_workflow_status
- Return updated order row

**`record_payment_collected`** — input: `{ order_id, cash, check, card }`
- Verify session
- Confirm driver owns the order
- Validate current state allows payment capture (must be at_pit or loaded)
- Set driver_collected_cash, driver_collected_check, driver_collected_card, driver_collected_at
- Return updated order row

### Route: `/driver/order/:id`

New page `src/pages/DriverOrder.tsx`. Full order detail view:
- Order header: order_number, status pill
- Customer card: name, phone (tap to call), delivery window
- Delivery card: address + embedded static Google Maps + "Open in Google Maps" button, distance, quantity, date
- Payment card: payment method, expected amount due (if COD)
- Workflow card: current state, primary button to advance ("Mark Acknowledged" → "Mark At Pit" → "Mark Loaded" → "Mark Delivered"), disabled at terminal state
- At_pit payment form: three numeric inputs (cash, check, card), submit "Record Payment". Cannot advance to loaded until payment recorded (for COD orders). Paid Stripe orders get a "Skip" button since payment already collected.

### Real-time sync to /leads

Use Supabase Realtime. Subscribe to `orders` table changes filtered by `driver_id` from `/leads` Orders tab and Schedule tab. When workflow status or driver_collected_* changes, update local state. No new code in driver-auth needed beyond the advance_workflow and record_payment_collected actions.

Fallback if Realtime is problematic: continue 30-second polling pattern from 3a.

### Scope fence (hard)

ALLOWED:
- New: `src/pages/DriverOrder.tsx`
- New route in App.tsx: `<Route path="/driver/order/:id" element={<DriverOrder />} />`
- Modify: `supabase/functions/driver-auth/index.ts` — add `advance_workflow` + `record_payment_collected` actions
- Modify: `src/pages/Driver.tsx` — make order cards navigable (already placeholder from 3a)
- Modify: `src/pages/Leads.tsx` — Orders side panel adds workflow status display (read-only)
- New migration: orders table additions

NOT ALLOWED:
- Signature capture (that's 3c)
- Photo capture (that's 3c)
- Anything in /admin
- Existing customer-facing flow
- Any file on the protection list without isolated audited slice

### Stop points

Stop Point 1 — Audit Report
Stop Point 2 — Migration Review
Stop Point 3 — Edge function code additions
Stop Point 4 — Frontend code (Driver.tsx navigation wiring + DriverOrder.tsx + Leads.tsx workflow display)
Stop Point 5 — Smoke test plan

### Smoke tests (3b)

1. Driver acknowledges an assigned order
2. /leads Orders tab shows workflow status update in real-time (or within 30s)
3. Driver advances to at_pit
4. Driver enters payment amounts and records
5. Driver advances to loaded
6. Driver advances to delivered
7. Driver tries to skip a step → blocked with error
8. Multiple drivers simultaneously advancing different orders → no race conditions
9. /leads Orders side panel shows full workflow timeline with timestamps

### Recommended security hardening to fold into 3b

Since we're touching driver-auth anyway:
- Tighten CORS allowlist (Priority 1.1)
- Replace pin_hash return with pin_set boolean (Priority 1.2)
- Possibly move session tokens to httpOnly cookies (Priority 2.1)

Decision on cookies: consider at Stop Point 1. If the complexity disrupts the phase, defer to dedicated security slice.

---

## Sub-slice 3c — Signature + photo capture at delivery

**Status:** PENDING. Do not start until 3b shipped and validated.

**Goal:** Before driver can mark "delivered", they capture customer signature on a canvas and take/upload a photo. Both stored in Supabase Storage.

### Schema additions

```sql
ALTER TABLE orders ADD COLUMN delivery_signature_url text;
ALTER TABLE orders ADD COLUMN delivery_photo_urls text[];
ALTER TABLE orders ADD COLUMN delivery_proof_captured_at timestamptz;
```

### Supabase Storage setup

New bucket: `delivery_proof` (private, not public).

RLS policies:
- Drivers can INSERT to paths matching `{order_id}/...` only if their session's driver_id matches the order's driver_id
- Service role has full access
- /leads operator (admin path) can SELECT from any path in this bucket

### New driver-auth action

**`submit_delivery_proof`** — input: `{ order_id, signature_data_url, photo_urls }`
- Verify session, validate driver owns order
- Validate current workflow_status is "loaded" (proof must come before "delivered")
- Decode signature data URL, upload to Storage at `{order_id}/signature.png`
- Record photo URLs (uploaded separately by client via signed URLs) in delivery_photo_urls array
- Update delivery_proof_captured_at
- Return success

After proof captured, driver can advance to "delivered" state.

### Frontend additions to DriverOrder.tsx

When workflow status is "loaded" and "Mark Delivered" is tapped:
- Open delivery proof modal
- Section 1: Signature pad (react-signature-canvas or similar — verify existing deps first)
- Section 2: Photo capture (`<input type="file" accept="image/*" capture="environment">` opens camera on mobile)
- Section 3: Review screen showing captured signature + photo thumbnails
- "Confirm Delivery" button → calls submit_delivery_proof, then advances workflow to "delivered"
- Cancel returns to order without changing state

### /leads operator view

In Orders side panel, add "Delivery Proof" section that renders when delivery_signature_url is non-null. Shows signature image + photo thumbnails. Click thumbnail → lightbox. Legal-grade proof of delivery.

### Scope fence

ALLOWED:
- Modify: `src/pages/DriverOrder.tsx` — add delivery proof modal
- Modify: `supabase/functions/driver-auth/index.ts` — add submit_delivery_proof action
- Modify: `src/pages/Leads.tsx` — Orders side panel adds Delivery Proof section
- New migration: orders columns + Storage bucket + RLS policies
- New dep: signature canvas library (verify which one is already in deps before adding — react-signature-canvas is common, ~3KB)

NOT ALLOWED:
- Anything else

### Smoke tests (3c)

1. Driver advances order to loaded
2. Driver taps "Mark Delivered"
3. Delivery proof modal opens
4. Driver signs on canvas
5. Driver takes photo via device camera
6. Driver confirms → order advances to delivered, proof saved to Storage
7. Operator opens order in /leads → sees signature image and photo
8. Driver tries "Mark Delivered" without capturing proof → blocked
9. RLS test: different driver tries to GET another driver's signature URL via direct API call → denied

---

## Cross-cutting considerations

**Form guidelines compliance:** All driver-facing forms (login, payment capture, proof capture) follow `RIVERSAND_FORM_GUIDELINES_v1.1` operator track:
- Labels: `text-xs mb-1 uppercase tracking-wider`
- Inputs: `h-11 rounded-lg`
- Phone: formatPhone, type="tel", inputMode="tel"
- formAttempted validation pattern
- shadcn Select for any dropdowns

**Brand:** BRAND_NAVY headers, BRAND_GOLD primary actions, Bebas Neue display font for screen titles, Inter for body. Mobile-first sizing.

**Hard rules carrying forward:**
- No haversine distances
- No new top-level dependencies without explicit approval (signature lib is the exception for 3c, requires approval at Stop Point 1)
- Migrations forward-only
- Each sub-slice gets its own scope fence at Stop Point 1
- 24-hour soak between sub-slices (CEO has overridden this pattern repeatedly; pattern still recommended)
- All driver-facing endpoints session-validated, rate-limited where appropriate

**Comments on every new file:**
- 3b: `// Path B Phase 3b — driver workflow states + payment capture`
- 3c: `// Path B Phase 3c — delivery proof capture (signature + photo)`

---

## Migration to fleetwork.net

Planned sequence:
1. Phase 3a validated (smoke test passes)
2. Phase 3b shipped and validated (~2 weeks)
3. Phase 3c shipped and validated (~2 weeks)
4. Migration slice: port /driver React app to fleetwork.net, update CORS allowlist, DNS cutover, keep riversand.net/driver as 60-day redirect fallback
5. After 60 days, remove /driver from riversand.net

See `FLEETWORK_MIGRATION_PLAN.md` for detailed migration plan.

---

## Phase 4 (deferred, planned later)

- Driver-facing payroll view
- Driver-facing petty cash tracking  
- Driver-facing check tracking
- Individual operator accounts (Priority 3.1 security item)
- Audit log completion (Priority 2.4 security item)
- 2FA enforcement (Priority 2.2 security item)

Phase 4 built on Phase 3 foundation. Probably 2-3 weeks of work split into its own slices. Not designed in detail yet.

## Future projects (not Phase 4 scope)

- Stripe Tap to Pay (web-compatible alternatives when available, or native app project if strategic)
- Stripe payment-link generation from driver portal (Phase 4 or 5 candidate)
- Native iOS/Android driver app (only if growth past 20+ drivers makes web app insufficient)

---

## Ownership and update log

**Owner:** Silas Caldeira (CEO/CVO)
**Last reviewed:** 2026-04-25
**Next review:** Before Phase 3b execution starts

**Update log:**
- 2026-04-24 — v1.0 initial draft covering all three sub-slices
- 2026-04-25 — v1.1 Updated production home from riversand.net/driver to fleetwork.net (migration after 3c). Phase 3a marked shipped-unvalidated.
- 2026-04-25 — v1.2 Phase 3a validation executed against production. T1 PASS (login + session row + last_login_at), T2 PASS (session round-trip + tampered token rejection), T3 FAIL (in-memory rate limiter non-functional in production). T3 follow-up logged as Priority 1 in SECURITY_ROADMAP.md §1.4 and scheduled for Phase 3b+1. Test driver row retained, deactivated via migration. Driver-auth source comment (lines 88–106) updated to match SECURITY_ROADMAP.md language verbatim.

---

End of PHASE_3_PLAN.md v1.2
