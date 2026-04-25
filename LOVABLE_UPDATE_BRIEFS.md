# LOVABLE_UPDATE_BRIEFS.md — Pending Documentation Updates

Ready-to-paste prompts for the next Lovable session. These address the small documentation updates flagged during the "fix all" review.

---

## Brief 1 — Bump RIVERSAND_CONTEXT.md to v1.13

Paste into Lovable:

```
Small documentation update. Read-only in application code; text edits only in RIVERSAND_CONTEXT.md.

Update RIVERSAND_CONTEXT.md:

1. Change version line from "Version: 1.12 (2026-04-24)" to "Version: 1.13 (2026-04-25)"
2. Change "Last synced" line to "Last synced: 2026-04-25"
3. In the companion documents section, ADD these lines (if not already present):
   - "fleetwork.net (planned production home for driver portal — migration target after Phase 3c validated. See FLEETWORK_MIGRATION_PLAN.md)"
   - "SECURITY_ROADMAP.md — Security posture, known gaps, and hardening roadmap"
   - "INCIDENT_RESPONSE.md — Response runbooks for credential, breach, payment, and outage incidents"
   - "PHASE_3_PLAN.md — Driver portal phase planning (3a shipped, 3b/3c pending)"
   - "FLEETWORK_MIGRATION_PLAN.md — Migration plan for driver portal to fleetwork.net"
4. In the changelog section, ADD entry:
   "v1.13 (2026-04-25) — Committed fleetwork.net as driver portal production home (migration after Phase 3c). Added SECURITY_ROADMAP, INCIDENT_RESPONSE, PHASE_3_PLAN, FLEETWORK_MIGRATION_PLAN as companion documents."

No other changes to RIVERSAND_CONTEXT.md. No application code changes. No auto-commit. Post the diff for my review before applying.
```

---

## Brief 2 — Update RIVERSAND_FOLLOWUPS.md

Paste into Lovable:

```
Small documentation update. Text edits only to RIVERSAND_FOLLOWUPS.md. No application code changes.

Update RIVERSAND_FOLLOWUPS.md:

1. Mark P1 slices 1.B, 1.C, 1.D as COMPLETED (if they're still showing as "pending" or "⏳"). All four P1 slices shipped on 2026-04-24:
   - Slice 1.A — CityPage waitlist form → COMPLETED
   - Slice 1.B — OutOfAreaModal → COMPLETED
   - Slice 1.C — ContactForm → COMPLETED
   - Slice 1.D — WhatsAppButton callback → COMPLETED

2. Mark CORE_FLOW_REFERENCE regeneration as COMPLETED (shipped 2026-04-24, split into CORE_FLOW_REFERENCE.md + LMT_REFERENCE.md).

3. Verify P4-01 (Deno npm: import drift) and P4-02 (driver portal UTC date slicing) entries are present. If not, add them:

   P4-01: Deno npm: import drift in edge functions
   - send-email/index.ts line 3: import { createClient } from "npm:@supabase/supabase-js@2.57.2" fails Deno runtime check
   - Affected: send-email + build-chain-related failures in holiday-confirm, holiday-notifier, send-holiday-email
   - Fix: swap to https://esm.sh/@supabase/supabase-js@2.57.2 (matches other edge functions' pattern)
   - Scope: small, one-line change per file, 4 files total
   - Risk: send-email is on file-protection list — requires isolated audited slice with smoke test on transactional emails
   - Priority: Medium — functions currently work in production (errors are build-check warnings, not runtime failures); any future deploy triggering full recheck will fail

   P4-02: Driver portal today/tomorrow view uses UTC date slicing
   - Phase 3b should add explicit operator timezone setting (likely America/Chicago for Louisiana)
   - Current ±1 day slop is acceptable for Phase 3a but will cause edge-case confusion during late-night driver sessions
   - Location: supabase/functions/driver-auth/index.ts list_my_orders action

4. Add new sections for Priority 1 Security Hardening items (from SECURITY_ROADMAP):

   P5-01 (Security Priority 1.1): Tighten CORS allowlist on all edge functions
   - Replace Access-Control-Allow-Origin: "*" with explicit allowlist
   - Origins: https://riversand.net, https://fleetwork.net (when live), http://localhost:* for dev
   - Effort: ~1 hour across all edge functions, one redeploy

   P5-02 (Security Priority 1.2): Replace pin_hash with pin_set boolean in list_drivers response
   - Current: list_drivers returns full pin_hash value
   - Fix: return derived boolean pin_set: !!pin_hash instead
   - Effort: ~30 min, one edge function redeploy + DriverModal component update

No other changes. No application code changes. No auto-commit. Post the diff for my review before applying.
```

---

## When to use these

Run Brief 1 and Brief 2 in your next Lovable session. They're small, low-risk, docs-only changes. Total time: ~10-15 minutes for both combined.

Upload the new docs to project knowledge alongside these updates:
- SECURITY_ROADMAP.md (already uploaded)
- INCIDENT_RESPONSE.md (new, this session)
- PHASE_3_PLAN.md (new, this session)
- FLEETWORK_MIGRATION_PLAN.md (new, this session)

After uploads, project knowledge is complete and consistent with current state of planning and security posture.

---

End of LOVABLE_UPDATE_BRIEFS.md
