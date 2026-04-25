# INCIDENT_RESPONSE.md — Ways Materials LLC

**Version:** 1.0 (2026-04-25)
**Scope:** Response procedures for security, infrastructure, and operational incidents affecting riversand.net, /leads (LMT), fleetwork.net (when launched), and shared Supabase infrastructure.
**Audience:** Silas Caldeira (current primary responder), future operators, future CSO or engineering hires.

---

## Purpose

When something goes wrong, clear-headed decision-making under stress depends on having thought through the scenarios in advance. This document is the runbook. Read it now, not during the incident.

**Coverage:**
1. Credential compromise (operator, driver, admin)
2. Data breach (confirmed or suspected)
3. Payment fraud (Stripe-related)
4. Edge function or Supabase outage
5. Customer-reported security issue
6. Driver or operator account takeover

---

## Section 0 — Before any incident: Know where the buttons are

**Key access points:**

- **Supabase dashboard** — https://supabase.com/dashboard/project/lclbexhytmpfxzcztzva
  - Can: disable edge functions, revoke API keys, manage RLS, view logs, initiate restore from backup
- **Lovable project** — repo `bayou0313/sand-nine-rivers`
  - Can: revert commits, redeploy, modify code
- **Stripe dashboard** — https://dashboard.stripe.com
  - Can: refund charges, block customers, view transaction history, dispute responses
- **DNS control** — wherever riversand.net and fleetwork.net registrars live
  - Can: point domain to maintenance page, take site offline entirely
- **GitHub** — https://github.com/bayou0313/sand-nine-rivers
  - Can: revert commits, force push, lock repo

**Critical secrets (where they live — NEVER paste them in logs, chats, or docs):**
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API
- `LEADS_PASSWORD` — Supabase edge function secrets
- `STRIPE_SECRET_KEY` — Stripe dashboard → Developers → API keys
- `GOOGLE_MAPS_SERVER_KEY` — Supabase edge function secrets
- `RESEND_API_KEY` — Supabase edge function secrets

**Contact list (fill in with real values):**
- Stripe Support: dashboard support + phone for major incidents
- Supabase Support: status.supabase.com + support portal
- DNS registrar support: (fill in based on actual registrar)
- Legal counsel: (fill in if retained)
- Customer communication email: orders@riversand.net

---

## Scenario 1 — Operator credential compromise

### Definition
The shared `LEADS_PASSWORD` has leaked (overheard, phished, shared outside the team, found in a password dump, suspected in use by unauthorized person).

### Immediate actions (first 15 minutes)

1. **Rotate LEADS_PASSWORD in Supabase.** Go to dashboard → Project Settings → Edge Functions → Secrets. Change `LEADS_PASSWORD` to a new strong value. Redeploy `leads-auth` edge function to pick up the new secret.
2. **Notify all authorized operators** via whatever channel you actually use (WhatsApp, SMS, in-person). Tell them: new password, where to find it, do not share.
3. **Review leads-auth access logs** in Supabase (Edge Functions → driver-auth → Logs) for the last 24 hours looking for unfamiliar IPs or unusual action patterns.

### Follow-up actions (first 24 hours)

4. **Review what the compromised actor could have done:** check `orders` table for recent changes, especially price modifications, driver reassignments, status changes. Look for anything inconsistent with normal operation.
5. **If data modification is suspected:** initiate point-in-time restore evaluation (Supabase supports this on Pro+ tiers). Don't restore impulsively; identify what was changed first.
6. **Document the incident:** what leaked, how, what was accessed, what was remediated. Save to `incidents/` folder in repo (create if doesn't exist).

### Prevention follow-up (within 2 weeks)

7. **Accelerate Priority 2.2** from SECURITY_ROADMAP — complete 2FA for operator login. Shared passwords are fundamentally brittle; 2FA + individual accounts is the long-term fix.

---

## Scenario 2 — Driver PIN compromise

### Definition
A driver reports their PIN was observed, stolen phone with saved session, or you suspect unauthorized access to a specific driver account.

### Immediate actions (first 15 minutes)

1. **Reset the driver's PIN** via /leads Drivers tab → DriverModal → Reset PIN. This action automatically revokes all active sessions for that driver (by design).
2. **Tell the driver their new PIN** via your normal comms pattern (in person, phone call, WhatsApp).
3. **Confirm with driver** that they can log in with new PIN and that their orders look correct.

### Follow-up actions (first 24 hours)

4. **Review `driver_sessions` table** for that driver_id. Check for sessions from unusual IPs or user agents (not the driver's normal phone).
5. **Review `orders` table** for any orders that driver recently interacted with (advance_workflow, record_payment_collected once 3b ships). Look for anomalies.
6. **If stolen device**: ensure device-level security (remote wipe if available). Session revocation handles server side, but the phone itself may have other company data.

### Prevention follow-up

7. If compromises become a pattern (more than 2 per quarter), prioritize moving session tokens to httpOnly cookies (SECURITY_ROADMAP Priority 2.1) to reduce XSS exposure.

---

## Scenario 3 — Data breach (confirmed or suspected)

### Definition
Evidence that customer, driver, or operational data has been accessed or exfiltrated by unauthorized parties. This is the most serious scenario.

### Immediate actions (first 60 minutes — escalate fast)

1. **Freeze the situation:** don't panic-delete evidence. Take screenshots of logs, preserve access records.
2. **Rotate ALL secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `LEADS_PASSWORD`, `STRIPE_SECRET_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `RESEND_API_KEY`. Each rotation requires a redeploy of dependent edge functions.
3. **Enable Supabase audit logging** if not already enabled (Pro tier feature). 
4. **Stop any ongoing data leak:** if a specific endpoint or action is the source, disable that edge function temporarily.
5. **Do NOT delete anything.** Forensic evidence matters.

### First 24 hours

6. **Consult legal counsel.** Louisiana data breach notification requirements may apply (LSA-R.S. 51:3071 et seq.). Requires 60 days notice to affected Louisiana residents under many circumstances. Legal counsel determines applicability and obligation.
7. **Identify scope:** what tables, what time window, what user count is potentially affected? Supabase query logs and edge function logs are your primary evidence.
8. **Notify Stripe** if payment data may be involved (Stripe handles PAN; if somehow that was exposed via a misconfiguration, they need to know immediately).
9. **Prepare customer communication draft** for legal review. Do not send without legal approval.

### First week

10. **If notification is required:** send per statutory timeline. Include what happened, what information was involved, what you're doing to remediate, what affected parties can do.
11. **Engage a security consultant or incident responder** if the scope is significant. Cost is typically $5k-20k for initial engagement; worth it to avoid further damage.
12. **File insurance claim** if you carry cyber liability insurance (you should; if you don't, add to SECURITY_ROADMAP as a must-acquire).

### Post-incident

13. **Full postmortem document:** timeline, root cause, what was accessed, what was remediated, what's changed to prevent recurrence.
14. **Update SECURITY_ROADMAP** to add the specific vulnerability class to Priority 1.
15. **Consider paid pen test** after remediation to verify the hole is closed.

---

## Scenario 4 — Payment fraud (Stripe-related)

### Definition
Unusual transaction patterns, chargebacks spiking, customer reports of fraudulent charges, or Stripe notifies you of suspicious activity.

### Immediate actions

1. **Check Stripe dashboard** for recent transactions. Look for: unusual amounts, repeat card numbers, geographic anomalies, velocity spikes.
2. **If specific fraudulent transactions identified:** issue refunds immediately via Stripe dashboard. Better to eat the cost than fight a chargeback.
3. **If a pattern of card testing** (small $1 charges to test stolen cards): enable Stripe Radar with stricter rules; consider rate limiting on `/order` endpoint if attacks come through your checkout.
4. **Review `orders` table** for corresponding records; investigate whether the fraudulent orders were dispatched or if they were caught before delivery.

### Follow-up

5. **Document the fraud pattern:** what indicators identified it, what remediation worked.
6. **Consider Stripe Radar rules** as permanent defense if the attack pattern repeats.
7. **Review whether any driver delivered a fraudulent order:** if sand was actually delivered and payment is now reversed, you have an operational loss — coordinate with driver on any recovery.

---

## Scenario 5 — Supabase outage or edge function failure

### Definition
Supabase experiencing downtime, regional outage, edge functions returning 500s, or database unreachable.

### Immediate actions

1. **Check Supabase status page:** https://status.supabase.com
2. **If confirmed platform issue:** wait it out. Supabase's SRE team is working on it. Estimate downtime from their updates.
3. **If local to your project:** check edge function logs for errors, check RLS policy changes, check for recent migrations that might have broken something.
4. **Post a maintenance message** on riversand.net if customer-facing checkout is affected. Use the site_mode=maintenance toggle.

### Customer communication

5. **For customer-facing checkout outage >30 minutes:** post brief status update on homepage. Drivers and operators affected? Message them directly.
6. **Operators can continue manual dispatch** via phone/WhatsApp during outage (this is the fallback for all Supabase-dependent operations).

### Post-outage

7. **Document incident:** cause, duration, who was affected, what manual processes kicked in.
8. **If root cause was your code or config** (not Supabase's platform): determine if it's recurring or one-off. Add monitoring or test coverage to prevent recurrence.

---

## Scenario 6 — Customer-reported security issue

### Definition
A customer, security researcher, or third party contacts you claiming to have found a vulnerability.

### Immediate actions

1. **Take it seriously regardless of how the report sounds.** Even badly-worded reports often contain real bugs.
2. **Request details:** exact steps to reproduce, when discovered, what they observed, whether they've disclosed elsewhere.
3. **Do NOT offer a bounty or compensation off the cuff.** If a bug bounty program doesn't exist, say "thank you, we'll investigate and follow up" without committing to pay.
4. **Reproduce the issue privately.** Do not test in production if possible; use a dev project.

### If issue confirmed

5. **Assess severity:** does it expose customer data? allow account takeover? enable fraud? 
6. **Fix:** deploy fix via a focused slice with normal review discipline.
7. **Communicate:** tell the reporter the issue is fixed, thank them, offer attribution if they want public credit.
8. **Consider whether customer notification is required** (same framework as Scenario 3).

### If issue not reproducible

9. **Document the report and your investigation.** Ask the reporter for more information. Sometimes real bugs manifest only in specific configurations.
10. **Don't dismiss reports without investigation.** Reporters often know things you don't.

---

## Scenario 7 — Account takeover (operator or driver)

### Definition
An operator or driver reports they cannot log in, or that their account shows activity they didn't perform.

### Immediate actions

1. **For operator:** rotate LEADS_PASSWORD (Scenario 1 procedures). Investigate the operator's recent session history.
2. **For driver:** reset their PIN (Scenario 2 procedures).
3. **Investigate whether additional accounts may be affected** (if the attacker used a common technique).

### If evidence of coordinated attack

4. Escalate to full Scenario 3 (data breach) procedures. Account takeover of multiple accounts = systemic compromise.

---

## Common mistakes during incidents

**Don't do these:**

1. **Panic-delete evidence.** Forensic logs matter. Preserve everything.
2. **Apologize prematurely in public.** Legal counsel should review customer communications before sending.
3. **Promise specific remediation timelines you can't guarantee.** "We're investigating and will follow up with updates" is better than "fixed by end of day."
4. **Blame the reporter.** Even if their explanation is badly framed, they did you a service by reporting. Thank them.
5. **Neglect to notify Stripe of payment-related incidents.** They have systems to prevent further damage; surprising them later is worse.
6. **Skip the postmortem.** Incidents are learning opportunities. Document them.

---

## Monthly incident log

Keep a running log of actual incidents (even minor ones) to spot patterns over time:

| Date | Scenario | Severity (1-5) | Duration | Root cause | Fix | Lessons |
|------|----------|----------------|----------|------------|-----|---------|
| — | — | — | — | — | — | — |

---

## Ownership and update log

**Owner:** Silas Caldeira (CEO/CVO), until dedicated security/operations lead hired.
**Last reviewed:** 2026-04-25
**Next review:** 2026-07-25 (quarterly with SECURITY_ROADMAP)

**Update log:**
- 2026-04-25 — v1.0 initial draft. Covers 7 incident scenarios, pre-incident preparation, common mistakes.

---

## Appendix — Quick reference cheat sheet

For printing or pinning in an easily accessible location:

**Something feels off?**
1. Check Supabase dashboard logs
2. Check Stripe dashboard for unusual activity  
3. Document what you observed
4. Escalate to appropriate scenario above

**Credentials leaked?**
→ Scenario 1 (operator) or Scenario 2 (driver)

**Unusual database activity?**
→ Scenario 3 path, start with freeze and rotate

**Payment weirdness?**
→ Scenario 4

**Site down?**
→ Scenario 5, check Supabase status first

**Stranger reports a bug?**
→ Scenario 6, take it seriously

**Legal counsel:** (fill in)
**Cyber insurance carrier:** (fill in if applicable)
**Primary responder:** Silas Caldeira
**Backup responder:** (designate when team grows)

---

End of INCIDENT_RESPONSE.md v1.0
