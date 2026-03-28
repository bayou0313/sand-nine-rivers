

## Update Internal Email Address

### What's changing
One line change in `supabase/functions/send-email/index.ts`:

**Line 15** — Change `INTERNAL_EMAIL` from `cmo@haulogix.us` to `cmo@haulogix.com`

```
// Before
const INTERNAL_EMAIL = "cmo@haulogix.us";

// After
const INTERNAL_EMAIL = "cmo@haulogix.com";
```

### What's already correct (no changes needed)
- Resend import and initialization ✓
- `from: "River Sand <no_reply@riversand.net>"` ✓
- Customer email sent to `data.customer_email` ✓
- Owner email sent to `ownerEmail` (falls back to `INTERNAL_EMAIL`) ✓
- Console logs after each send ✓

### Additional step
- Update the `GMAIL_USER` secret from `cmo@haulogix.us` to `cmo@haulogix.com` so the runtime override also points to the correct address
- Redeploy the `send-email` edge function

