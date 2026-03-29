

## Capture Out-of-Area Leads — Implementation Plan

### Overview
When a delivery address is outside the service area, show a modal to collect the customer's contact info, save it to a new `delivery_leads` table, send an email notification to `cmo@haulogix.com`, and provide a password-protected `/leads` page to manage them.

---

### Step 1 — Database Migration

Create `delivery_leads` table with RLS policies:
- Columns: `id`, `created_at`, `address`, `distance_miles`, `customer_name`, `customer_email`, `customer_phone`, `contacted`
- `CHECK` constraint: at least one of email or phone required
- RLS: anon/authenticated can INSERT; only admins can SELECT/UPDATE
- Add a separate policy allowing SELECT/UPDATE for the service role (so the edge function for the leads page can query)

### Step 2 — New Component: `src/components/OutOfAreaModal.tsx`

Dialog modal with:
- Name (required), Email, Phone fields (at least one of email/phone required)
- Uses `(xxx) xxx-xxxx` phone mask per project standards
- On submit: inserts into `delivery_leads` via Supabase client, then calls `send-email` edge function with `type: "out_of_area_lead"`
- Shows success toast, closes modal
- Props: `open`, `onClose`, `address`, `distanceMiles`

### Step 3 — Update `src/components/DeliveryEstimator.tsx`

- Add `showOutOfAreaModal` state
- When `distanceMiles > MAX_MILES`: set `showOutOfAreaModal = true`, store address/distance
- Render `<OutOfAreaModal>` component
- Keep existing error message visible

### Step 4 — Update `supabase/functions/send-email/index.ts`

Add handler for `type === "out_of_area_lead"`:
- Send plain-text style email to `cmo@haulogix.com`
- Subject: `New Out-of-Area Lead — [address]`
- Body includes address, distance, name, email, phone, timestamp
- Footer: `riversand.net | 1-855-GOT-WAYS | Haulogix, LLC`

### Step 5 — New Edge Function: `supabase/functions/leads-auth/index.ts`

Simple edge function that:
- Accepts POST with `{ password, action, ... }`
- Validates password against `LEADS_PASSWORD` secret
- Actions: `list` (returns all leads sorted newest first), `toggle_contacted` (updates contacted boolean by id)
- Uses service role Supabase client to bypass RLS

### Step 6 — New Page: `src/pages/Leads.tsx`

- Password gate: simple input form, validates via `leads-auth` edge function
- Once authenticated (store in sessionStorage), shows leads table
- Navy `#0D2137` header, gold `#C07A00` accents, white table
- Columns: Date, Address, Distance, Name, Email, Phone, Contacted toggle
- Sorted newest first
- Footer: "Powered by Haulogix, LLC"

### Step 7 — Route & Indexing

- Add `/leads` route to `src/App.tsx`
- Add `Disallow: /leads` to `public/robots.txt`

### Step 8 — Add Secret

- Add `LEADS_PASSWORD` to Lovable Secrets before deploying

---

### Files Changed

| File | Action |
|---|---|
| Migration SQL | Create `delivery_leads` table + RLS |
| `src/components/OutOfAreaModal.tsx` | New modal component |
| `src/components/DeliveryEstimator.tsx` | Trigger modal on out-of-area |
| `supabase/functions/send-email/index.ts` | Add `out_of_area_lead` email type |
| `supabase/functions/leads-auth/index.ts` | New edge function for password auth + CRUD |
| `src/pages/Leads.tsx` | New password-protected leads page |
| `src/App.tsx` | Add `/leads` route |
| `public/robots.txt` | Add `Disallow: /leads` |

