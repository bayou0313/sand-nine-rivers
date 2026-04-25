# SECURITY_ROADMAP.md — Ways Materials LLC

**Version:** 1.4 (2026-04-25)
**Scope:** riversand.net (customer-facing), /leads operator surface (LMT), fleetwork.net (planned driver-facing home), and all shared Supabase infrastructure.
**Audience:** Silas Caldeira (CEO/CVO), future CSO or security consultant, future operator hires.

---

## Purpose

Document current security posture, known gaps, and planned hardening work for Ways Materials LLC's digital infrastructure. This is NOT a build plan for immediate execution. It is a living reference to:

1. Prevent drift between security intent and implementation reality
2. Give future contributors (engineers, CSOs, pen testers) a clear map
3. Schedule hardening work in proportion to business growth and threat evolution
4. Support future compliance conversations (insurance, enterprise customers, financing due diligence)

**Review cadence:** Quarterly. Next review: 2026-07-25.

**Version history:**
- v1.4 (2026-04-25) — §2.5 gap location updated from at_pit→loaded to loaded→delivered transition per Phase 3b workflow correction. Same gap, new location. Fix plan unchanged.
- v1.3 (2026-04-25) — Phase 3b shipped (driver order detail + workflow actions). New Priority 2 item §2.5 documents the client-side COD parity gate as a known limitation: server accepts `driver_collected_at` non-null as the gate to advance from at_pit → loaded; UI prevents under-collection but a malicious driver bypassing the UI could mark "loaded" with $0 collected. Threat model = honest-mistake prevention only. Server-side parity check deferred to a later slice.
- v1.2 (2026-04-25) — Phase 3a validation completed (T1/T2 PASS, T3 FAIL). Driver-auth rate limiter recategorized from "best-effort acknowledged" to "non-functional in production." New Priority 1 item §1.4. See PHASE_3_PLAN.md §"Phase 3a Validation Results" for test details.
- v1.1 (2026-04-25) — Updated planned driver portal home from izons.com to fleetwork.net per brand decision
- v1.0 (2026-04-24) — Initial draft

---

## 1. Current security posture — what's solid

### Authentication

**Driver authentication (Phase 3a, April 2026):**
- Phone + PIN login via dedicated `driver-auth` edge function
- PINs hashed with bcryptjs cost factor 10 (matches 2FA backup code pattern)
- Session tokens: 256-bit cryptographically random, base64url encoded (RFC 4648 §5), returned to client once, stored server-side as SHA-256 hash
- 30-day session expiry, revocable via `revoked_at` column
- Rate limiting: nominally 5 login attempts per 60 seconds per IP, **non-functional in production** — in-memory limiter does not survive Supabase isolate boots; effective rate is ~14 attempts/sec/IP gated only by bcrypt latency. Scheduled fix: Phase 3b+1 (DB-backed `driver_login_attempts` table with `(ip_address, attempted_at)` index, server-side count check before bcrypt comparison, ~30–45 min slice). See §2.1.4. Validated 2026-04-25 (PHASE_3_PLAN.md T3).
- Generic "Invalid credentials" error message prevents enumeration
- Constant-time bcrypt comparison even when driver not found (dummy hash defense against timing-based enumeration)

**Operator authentication (LMT at /leads):**
- Shared `LEADS_PASSWORD` environment secret
- Session-storage-based gate in the browser
- 2FA infrastructure deployed but dormant (backup codes table, TOTP setup page built; not yet enforced in login flow)

### Authorization

- Row Level Security enabled on all sensitive tables (`drivers`, `driver_sessions`, `orders`, `waitlist_leads`, `customers`, etc.)
- All sensitive tables have `service_role`-only policies — no anonymous or authenticated-user direct access
- Edge functions are the exclusive data access path, which provides a controlled choke point for auth enforcement and input validation

### Data transmission

- TLS 1.3 on all public surfaces:
  - riversand.net (Lovable hosting, HTTPS enforced)
  - fleetwork.net (planned driver-facing home; to be hosted on GitHub Pages with HTTPS enforced and auto-renewing certs)
  - *.supabase.co (Supabase enforces HTTPS, rejects HTTP)
- Supabase internal database connections use TLS within their network
- No known HTTP endpoints anywhere in production infrastructure

### Data at rest

- Supabase provides disk-level encryption on all database instances
- PINs stored as bcrypt hashes (irreversible)
- Session tokens stored as SHA-256 hashes (irreversible)
- Card payment data never touches our infrastructure (Stripe handles all PAN data end-to-end via their hosted checkout and Payment Intents API)

### Architectural choices

- Stripe integration uses hosted checkout and Payment Intents — we never see PAN, CVV, or full card numbers; PCI scope limited to SAQ-A
- Google Maps server-side API key (distance matrix) held in edge function secret, never exposed to browser
- Separate auth surfaces for customer, operator, and driver — no shared sessions or credentials across roles
- Brand architecture separates customer-facing domains (riversand.net, spillwaydirt.com) from driver-facing (fleetwork.net planned) — reduces blast radius if one surface is compromised

---

## 2. Known gaps — ordered by priority

### Priority 1 — Address within 2 weeks

#### 1.1 CORS is wide open on all edge functions
- **Current:** All edge functions set `Access-Control-Allow-Origin: *`
- **Risk:** Any website in the world can make authenticated requests to your edge functions from a user's browser. Creates opening for cross-site attacks where a user logged into riversand.net (today) or fleetwork.net (future) visits a malicious site that can call your APIs with their credentials.
- **Fix:** Replace `*` with an explicit allowlist — `https://riversand.net`, `https://fleetwork.net`, `http://localhost:*` for dev. Requires checking request origin and responding appropriately.
- **Effort:** ~1 hour across all edge functions, one redeploy.
- **Owner:** Fold into Phase 3b planning OR handle as standalone security slice.

#### 1.2 list_drivers action returns pin_hash to operator browsers
- **Current:** `list_drivers` in leads-auth now selects and returns `pin_hash` so DriverModal can show "Set PIN" vs "Reset PIN"
- **Risk:** Operator browsers see bcrypt hashes in the network response. Even though hashes are irreversible with proper cost factor, this is unnecessary attack surface. A leaked operator browser dump would include these.
- **Fix:** Replace returned `pin_hash` with derived boolean `pin_set: !!pin_hash`. Update DriverModal to read `pin_set` instead.
- **Effort:** ~30 min, one edge function redeploy plus one frontend update.
- **Owner:** Fold into Phase 3b or standalone hardening slice.

#### 1.3 No documented incident response procedure
- **Current:** If a driver reports their PIN leaked, if operators discover shared LEADS_PASSWORD exposure, if Supabase reports a breach — no runbook exists
- **Risk:** Under stress, wrong decisions get made. No clear owner for each type of incident.
- **Fix:** Write a one-page INCIDENT_RESPONSE.md covering: credential compromise, data breach, payment fraud, edge function outage. Include who to call, what to revoke, how to notify affected users.
- **Effort:** 2 hours of writing, no code.
- **Owner:** Silas or future CSO.

#### 1.4 Driver-auth rate limiter non-functional in production
- **Current:** In-memory `rateMap` in `supabase/functions/driver-auth/index.ts` (lines 88–106) intends to enforce 5 login attempts per 60 seconds per IP. Validated 2026-04-25 (PHASE_3_PLAN.md T3): 21 rapid bad-PIN attempts from a single IP produced 21 × HTTP 401 and zero × HTTP 429. Root cause: Supabase boots a fresh isolate frequently, resetting the in-memory counter on nearly every request. The code's prior "cold-start bypass acknowledged" comment understated the gap — it is non-functional in production, not best-effort.
- **Risk:** With ~70ms bcrypt latency per attempt, a determined attacker who knows a valid driver phone number can brute-force a 4-digit PIN in roughly 12 minutes (10K possibilities ÷ ~14 attempts/sec). Bcrypt latency is currently the only real brake. The driver's own login still works during the attack, so a successful brute force is noisy but not blocked.
- **Fix:** DB-backed rate limiter — new `driver_login_attempts` table with `(ip_address, attempted_at)` index. In `driver-auth` login action, before bcrypt comparison: `SELECT count(*) FROM driver_login_attempts WHERE ip_address = $1 AND attempted_at > now() - interval '60 seconds'` → if ≥ 5, return 429. Always insert the attempt row. Background cleanup job prunes rows older than 24 hours.
- **Effort:** 30–45 min slice. One migration (table + index + cleanup function), one edit to `driver-auth/index.ts` (replace `checkRate` with DB query), one redeploy.
- **Owner:** Phase 3b+1 — ship immediately after Phase 3b code brief, before any real driver onboards. Update this entry to "fixed" and remove from Priority 1 once shipped.
- **Status (2026-04-25):** Phase 3b+1 still ships ahead of Phase 4 design as a parallel security workstream. Phase 3b polish work HALTED on CVO direction (workflow redesign required — see RIVERSAND_FOLLOWUPS.md P4-03), but the rate limiter slice is independent of workflow design and proceeds on its own track.

### Priority 2 — Address within 2 months

#### 2.1 Session tokens in localStorage (XSS exposure)
- **Current:** Driver portal stores session token in `localStorage["driver_session_token"]`; readable by any JavaScript running on the same origin
- **Risk:** Any successful XSS attack (including supply chain attack on a dependency, or injection through an unsafe user input) can steal session tokens and impersonate drivers. Mitigating factor: we currently have no user-generated content rendered unsanitized, so XSS surface is small. But this will grow as features expand.
- **Fix:** Move session tokens to httpOnly cookies. Server sets `Set-Cookie` header with httpOnly, Secure, SameSite=Strict flags on login. Browser automatically sends cookie in subsequent requests. JavaScript cannot read or manipulate.
- **Effort:** ~4-6 hours. Requires refactoring driver-auth to set/read cookies, updating Driver.tsx to rely on implicit cookie auth instead of explicit token passing. Some browser compatibility testing. Note: cross-origin cookies (fleetwork.net calling Supabase) require SameSite=None + Secure, which works but adds subtle deployment considerations.
- **Owner:** Phase 3b candidate, ideally paired with CORS tightening in the same session.

#### 2.2 Complete 2FA for operator login
- **Current:** 2FA infrastructure deployed (Slice 1a shipped 2026-04-24) but dormant. `verify_password`, `verify_totp`, `setup_totp_preview` actions exist but aren't invoked in the operator login flow. LeadsSetup2FA page built but not linked from /leads auth flow.
- **Risk:** Shared LEADS_PASSWORD means if one operator's credentials leak (phishing, shoulder-surfing, password manager export), all operators effectively lose access control. No second factor mitigates this.
- **Fix:** Slice 1b (frontend cutover to 2FA-aware login) + Slice 1c (enforcement — require 2FA for all operators after grace period).
- **Effort:** Slice 1b ~4 hours, Slice 1c ~2 hours plus grace period communication with operators.
- **Owner:** Planned Phase 4 or dedicated security sprint.

#### 2.3 Content Security Policy headers missing
- **Current:** No CSP headers on riversand.net or fleetwork.net (when it launches) responses
- **Risk:** If XSS does succeed, attacker has unrestricted ability to load external scripts, exfiltrate data to arbitrary domains, modify page content. CSP is a defense-in-depth layer that limits damage.
- **Fix:** Add CSP headers via Lovable configuration (riversand.net) and GitHub Pages custom headers or meta tag (fleetwork.net). Start with report-only mode for 2 weeks, then enforce.
- **Effort:** ~4 hours total. Requires cataloging all legitimate external resources (GTM, Clarity, Google Maps, Stripe, Supabase endpoints) and constructing policy. CSP reports to monitor violations.
- **Owner:** Before ways.us brand launch or before driver fleet grows past 10.

#### 2.4 Authentication event audit log
- **Current:** We log `last_login_at` and create `driver_sessions` rows, but failed login attempts, PIN resets, session revocations are not individually recorded in an audit-friendly way
- **Risk:** After a security incident, investigation requires reconstructing what happened. Without audit logs, we rely on fragmentary data (Supabase request logs, application logs) that may be rotated or incomplete.
- **Fix:** Add `auth_audit_log` table with append-only schema: (id, timestamp, actor_type, actor_id, event_type, ip, user_agent, metadata). Edge functions append on every auth event (login success, login fail, PIN set, session create, session revoke, rate limit hit). RLS: service_role only. Retention: 2 years rolling.
- **Effort:** ~6 hours. New migration, new helper function in both edge functions, minor code changes at each auth decision point.
- **Owner:** Phase 4 or dedicated security work.

#### 2.5 COD payment-parity check is client-side only
- **Current:** Driver order detail UI (DriverOrder.tsx) disables the "Mark Delivered" button until `driver_collected_cash + check + card >= price`. The server (`advance_workflow`) only verifies that `driver_collected_at` is non-null before allowing loaded → delivered; it does not re-check the sum against `price`.
- **Risk:** Honest-mistake prevention only. A malicious driver who bypasses the UI (curl, devtools) can record `$0/$0/$0`, get `driver_collected_at` stamped, then advance to delivered with the order under-collected. Threat model is fraud-by-employee, not external attacker.
- **Fix:** Move the parity check server-side. Either inside `record_payment_collected` (reject sums below price for COD) or inside `advance_workflow` (re-fetch sums and gate loaded → delivered). The latter is cleaner because it keeps the recording action permissive (driver can save partial progress) and the gate at the state transition.
- **Effort:** ~1-2 hours. One SQL/business-logic change in driver-auth, one new test case in the smoke suite, decision on which action to host it in. Coordinate with how operators currently handle partial-collection situations (e.g., customer pays half cash on arrival, half check after unload) — moving the gate too aggressively could block legitimate workflows.
- **Owner:** Before driver fleet grows past 5, or before any compensation/incentive structure that creates pressure to under-collect (e.g., hauls-per-day bonuses).

### Priority 3 — Address within 12 months

#### 3.1 Individual operator accounts
- **Current:** All operators share `LEADS_PASSWORD`. No per-person audit trail.
- **Risk:** Cannot attribute actions to specific operators. Cannot revoke one operator's access without changing password for everyone. Regulatory gap if ever required to produce "who changed X record."
- **Fix:** Add `operators` table with email + password_hash + role + active. Rename LEADS_PASSWORD auth to legacy fallback. Build operator login screen that issues individual sessions. 2FA applies per-operator. Audit log attributes actions to operator_id.
- **Effort:** ~2-3 weeks. Touches most of /leads. Requires careful migration so current shared access doesn't break during rollout.
- **Owner:** Phase 5 or beyond.

#### 3.2 Third-party penetration test
- **Current:** Never tested by outside security professionals
- **Risk:** Unknown vulnerabilities persist. Blind spots in your own security analysis.
- **Fix:** Engage a reputable firm (NCC Group, Bishop Fox, Trail of Bits, or similar — for small business, consider Hackrate or HackerOne managed programs). Scope: all public surfaces (riversand.net, fleetwork.net, Supabase edge functions, driver portal auth).
- **Effort:** 2-3 weeks of engagement, $8k-25k cost depending on scope and firm
- **Owner:** Before ways.us brand launch, before taking institutional financing, or if ever required by a customer contract (e.g., municipal sand delivery contracts).

#### 3.3 Backup and disaster recovery documentation
- **Current:** Supabase handles automated backups (daily for Pro tier, point-in-time recovery). No documented RTO/RPO, no documented restore procedure, no documented vendor outage fallback.
- **Risk:** In an actual disaster (database corruption, Supabase regional outage, accidental destructive migration), recovery time is unknown and possibly prolonged.
- **Fix:** Document:
  - Recovery Time Objective (RTO): how long can driver portal or customer checkout be down before business impact is severe? (Answer likely: 4 hours for checkout, 24 hours for driver portal.)
  - Recovery Point Objective (RPO): how much data loss is acceptable? (Answer likely: 1 hour for orders, 24 hours for analytics.)
  - Restore procedure: step-by-step from Supabase backup interface
  - Vendor outage fallback: what manual processes operate during Supabase downtime? (Phone ordering? Manual dispatch from printed schedules?)
- **Effort:** ~8 hours to write properly, including testing a restore to a dev project to verify the procedure actually works.
- **Owner:** Annually, Silas or future CSO.

#### 3.4 Anomaly detection and alerting
- **Current:** No alerts on unusual activity
- **Risk:** Breaches or attacks go undetected for extended periods
- **Fix:** Add basic monitoring:
  - Alert on >50 failed logins per hour across all drivers
  - Alert on PIN reset frequency >normal baseline
  - Alert on driver session creation from unusual geographic locations (first time a driver logs in from outside Louisiana)
  - Alert on order volume anomalies (sudden spike or drop)
- **Effort:** ~1-2 weeks depending on tooling choice. Options: Supabase webhooks + custom alerting, or third-party (e.g., Sentry, Datadog, PostHog with monitors).
- **Owner:** When fleet grows past 10 drivers, or when revenue exceeds level requiring SOC 2 attestation.

---

## 3. Explicit non-concerns — what NOT to worry about at current scale

These are things that sometimes feel urgent but aren't, given Ways Materials LLC's current size and threat model:

- **End-to-end encryption between driver and operator.** Not needed. Your backend is the coordination point; it NEEDS to read data to work. E2E encryption prevents this by design.
- **Hiding or rotating the Supabase anon key.** It's public by design. RLS + session tokens are the real defenses.
- **Custom cryptography.** Never. TLS + bcrypt + SHA-256 via standard libraries cover all cryptographic needs. Rolling your own is a universally bad idea.
- **HMAC-signed requests between edge functions and clients.** Overkill at this scale. Session tokens serve the same purpose with less complexity.
- **SOC 2 / ISO 27001 certification.** Not needed until you pursue institutional customers (Fortune 500, large municipalities, regulated industries) that require it. Worth planning toward when annual revenue crosses ~$5M or when contracts explicitly ask.
- **GDPR compliance.** You're a US-only business serving Louisiana/Gulf South. GDPR applies to EU residents. Not a current concern. CCPA / Louisiana privacy laws are relevant; covered adequately by current privacy policy on riversand.net (assuming one exists — if not, that's a separate item).

---

## 4. Threat model summary

**Who might attack Ways Materials LLC, in order of realistic likelihood:**

1. **Automated bots scanning for common vulnerabilities.** Constant low-level background noise. Covered by: TLS, strong auth, no known CVEs in stack.
2. **Disgruntled former driver or operator.** Has insider knowledge. Covered by: session revocation, password rotation, RLS. Weakened by: shared LEADS_PASSWORD (Priority 3.1 addresses this).
3. **Phishing targeting operators.** Attempts to steal LEADS_PASSWORD via email/SMS. Covered partially by: nothing currently automated. Needs: 2FA completion (Priority 2.2).
4. **Competitive espionage (another sand delivery business).** Low likelihood given industry norms. Covered by: current RLS preventing direct data access.
5. **Fraud targeting customers.** Fake riversand.net phishing sites collecting customer payment info. Covered by: Stripe handles payment flow; our domain has HSTS/valid cert; customers paying via real Stripe forms protected.
6. **Nation-state or sophisticated targeted attack.** Extremely unlikely for a Gulf South sand delivery business. Covered minimally.

**Not in the threat model at current scale:**

- Ransomware on internal systems (no internal network; all infrastructure is SaaS)
- Physical security of servers (Supabase's concern, not yours)
- Insider threats from engineering team (you ARE the engineering team currently)

---

## 5. Quarterly review checklist

Every 3 months, review:

- [ ] Has any Priority 1 item remained open past deadline? Why?
- [ ] Any new edge functions added? Do they have CORS, auth validation, rate limiting?
- [ ] Any new data tables? Do they have RLS enabled and appropriate policies?
- [ ] Any new third-party integrations? Have they been reviewed for data flow and trust level?
- [ ] Any security incidents in the quarter? Were they handled per the incident response doc?
- [ ] Dependency audit: any CVEs in npm packages, Deno imports, or Supabase extensions?
- [ ] Credential rotation: has LEADS_PASSWORD been rotated in the last 12 months? Service role key? API keys?
- [ ] Driver fleet size changed significantly? Does the roadmap priority need to shift?
- [ ] fleetwork.net migration status: still at riversand.net/driver, or migrated?

---

## 6. Escalation triggers

Move roadmap items UP in priority if any of these happen:

- First unauthorized access detected (any kind)
- Driver fleet grows past 10 active drivers (triggers Priority 2 hardening)
- Operator team grows past 2 people (triggers Priority 3.1 — individual accounts)
- Annual revenue exceeds $2M (triggers CSO consultant engagement consideration)
- Any B2B contract or insurance policy requires documented security posture
- ways.us brand launch (triggers Priority 2 completion as a pre-launch gate)
- fleetwork.net migration from riversand.net/driver (triggers CORS allowlist update as a blocking pre-migration item)
- Institutional financing conversation begins (triggers pen test + SOC 2 evaluation)

---

## 7. Brand and domain architecture

**Customer-facing:**
- riversand.net — primary customer funnel, SEO-optimized, 47 city pages
- spillwaydirt.com — secondary customer funnel
- ways.us — future parent brand anchor (not yet launched)

**Operator-facing:**
- riversand.net/leads — Leads Management Tool (LMT), operator dashboard
- riversand.net/admin — legacy admin interface

**Driver-facing:**
- riversand.net/driver — current staging home (Phase 3a shipped 2026-04-24)
- fleetwork.net — planned production home (migration target after Phase 3c validation)

**Shared infrastructure:**
- Supabase project `lclbexhytmpfxzcztzva` — single database for all surfaces, accessed via edge functions from each frontend
- GitHub: `bayou0313/sand-nine-rivers` (customer site + LMT + current driver staging)
- GitHub: drive-digits repo (legacy prototype, preserved as reference, not active)
- Future: fleetwork.net repo (to be created when migration is planned)

---

## 8. Document ownership and update log

**Owner:** Silas Caldeira (CEO), delegating to future CSO when hired.
**Last reviewed:** 2026-04-25 (v1.3 Phase 3b ship)
**Next review:** 2026-07-25

**Update log:**
- 2026-04-25 — v1.3 Phase 3b shipped (driver order detail + workflow actions). New Priority 2 item §2.5 added documenting client-side COD parity gate as known limitation; honest-mistake threat model only. Server-side parity check deferred to a later slice (~1-2 hrs).
- 2026-04-25 — v1.2 Phase 3a validation completed (T1/T2 PASS, T3 FAIL). Driver-auth rate limiter recategorized non-functional in production; new Priority 1 item §1.4 added with DB-backed fix scoped at 30–45 min for Phase 3b+1. §1 Authentication entry updated to match. OWASP A07 status updated.
- 2026-04-25 — v1.1 Updated planned driver portal home from izons.com to fleetwork.net per brand decision
- 2026-04-24 — v1.0 Initial draft covering Phase 3a security posture, 10 identified gaps, threat model, quarterly review process

---

## Appendix A — References

- Phase 3a implementation details: `CORE_FLOW_REFERENCE.md` (driver-auth, sessions) and `LMT_REFERENCE.md` (leads-auth, DriverModal)
- Current database schema: `DATABASE_SCHEMA.sql`
- Deferred technical work: `RIVERSAND_FOLLOWUPS.md` (P4-01 npm drift, P4-02 timezone)
- Brand architecture: `RIVERSAND_CONTEXT.md` (v1.12 — note: fleetwork.net brand decision post-dates this context file version)
- Planned fleetwork.net migration: to be documented separately before Phase 3b begins (or during if migration is interleaved)

## Appendix B — OWASP Top 10 coverage

Quick self-assessment against OWASP Top 10 (2021):

| # | Risk | Status |
|---|---|---|
| A01 | Broken Access Control | Partial — RLS strong, CORS loose (Priority 1.1) |
| A02 | Cryptographic Failures | Strong — TLS, bcrypt, proper key management |
| A03 | Injection | Strong — parameterized Supabase queries, no dynamic SQL |
| A04 | Insecure Design | Mixed — auth design sound, audit logging gap (Priority 2.4) |
| A05 | Security Misconfiguration | Mixed — no CSP, loose CORS (Priorities 1.1, 2.3) |
| A06 | Vulnerable & Outdated Components | Unknown — no regular dep audit (add to quarterly review) |
| A07 | Identification & Authentication Failures | Mixed — driver PIN auth + sessions strong (T1/T2 PASS 2026-04-25), driver-auth rate limiter non-functional in production (Priority 1.4), operator auth weaker without 2FA enforcement (Priority 2.2) |
| A08 | Software & Data Integrity Failures | Strong — no supply chain automation, all deploys reviewed |
| A09 | Security Logging & Monitoring Failures | Weak — no audit log (Priority 2.4), no alerting (Priority 3.4) |
| A10 | Server-Side Request Forgery | Strong — no user-controlled URLs in server code |

---

End of SECURITY_ROADMAP.md v1.4
