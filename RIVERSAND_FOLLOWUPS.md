# Riversand — Known Follow-ups

_Tracking deferred work. Not a feature backlog — these are concrete, scoped items already audited and approved-for-later._

Last updated: 2026-04-24

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

## P3 — UX polish (deferred indefinitely until prioritized)

- `formAttempted` red-border validation pattern → ContactForm, WhatsAppButton, OutOfAreaModal, CityPage (match Order.tsx UX)
- DriverModal Notes → `formatSentence` wrapper (low priority — operator-only field)

---

## Done / superseded

- ✅ DriverModal Name field — `formatProperName` + `formatProperNameFinal` wrappers (applied 2026-04-24)
- ⏳ P1 frontend slices in progress:
  - ✅ Slice 1.A — CityPage waitlist (applied 2026-04-24, awaiting smoke test approval)
  - ⏳ Slice 1.B — OutOfAreaModal
  - ⏳ Slice 1.C — ContactForm
  - ⏳ Slice 1.D — WhatsAppButton callback form
- ⏳ Doc regen — `CORE_FLOW_REFERENCE.md` fresh snapshot dated 2026-04-24 after all P1 slices ship
