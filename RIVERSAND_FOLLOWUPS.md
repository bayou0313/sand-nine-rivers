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
