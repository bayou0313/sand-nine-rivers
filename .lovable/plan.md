

## Plan: OrderMobile.tsx — Four Combined UX Fixes

**File modified:** `src/pages/OrderMobile.tsx` (only file touched)

---

### FIX 1 — Phone field auto-advance (lines 873-874)

Change the phone `onChange` handler to detect when formatted length reaches 14 chars and auto-focus the email field:

```tsx
onChange={e => {
  const formatted = formatPhone(e.target.value);
  setForm({ ...form, phone: formatted });
  if (formatted.length >= 14) {
    setTimeout(() => {
      document.getElementById("mobile-email-input")?.querySelector("input")?.focus();
    }, 50);
  }
}}
```

### FIX 2 — Move address bar below Continue on price screen (lines 745-751, 814-823)

Currently the address is displayed in the top bar of the price step (line 750). Remove it from the top bar and add it as a small gray confirmation line inside the scrollable content area, below the price breakdown and above the bottom CTA. The top bar keeps only the back arrow + a "YOUR QUOTE" label. The address line moves to the end of the scrollable content (after the price breakdown, around line 811):

```tsx
<p className="font-body text-xs text-muted-foreground text-center mt-4 truncate">{address}</p>
```

### FIX 3 — Company name toggle moves above Name field (lines 849-908)

Reorder the info step form fields so the company toggle/input appears first:

1. Company name toggle (or expanded input)
2. Full Name *
3. Phone *
4. Email *
5. Delivery instructions toggle (stays at bottom)

This is a pure JSX reorder — no logic changes.

### FIX 4 — Review request on success screen (lines 988-1028)

Add a state variable to fetch `gmb_review_url` from `global_settings`. On the success screen, between the invoice button and the "BACK TO HOME" link, insert a review request block. The block is conditionally rendered only if `gmb_review_url` has a value.

New state: `const [gmbReviewUrl, setGmbReviewUrl] = useState<string | null>(null);`

New useEffect fetching the setting:
```tsx
useEffect(() => {
  supabase.from("global_settings").select("value").eq("key", "gmb_review_url").single()
    .then(({ data }) => { if (data?.value) setGmbReviewUrl(data.value); });
}, []);
```

Review block JSX inserted after the invoice button, before "BACK TO HOME":
```tsx
{gmbReviewUrl && (
  <div className="mt-6 p-4 rounded-2xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
    <p className="font-display text-xl text-white tracking-wide mb-1">HAPPY WITH YOUR ORDER?</p>
    <p className="font-body text-sm text-white/60 mb-4">Your review helps other customers find us — it only takes 30 seconds.</p>
    <a href={gmbReviewUrl} target="_blank" rel="noopener noreferrer"
       className="block w-full h-12 rounded-2xl font-display text-lg tracking-wider flex items-center justify-center gap-2"
       style={{ backgroundColor: '#C07A00', color: '#0D2137' }}>
      ⭐ Leave a Google Review
    </a>
    <p className="font-body text-xs text-white/30 mt-3">Takes 30 seconds · Opens Google Maps</p>
  </div>
)}
```

---

### Files NOT changed
- Order.tsx, HomeMobile.tsx, Index.tsx, DeliveryDatePicker, pits.ts, format.ts, stripe-webhook, send-email, any edge function, any RLS/DB schema

### Risk
- Low — all changes are UI-only within OrderMobile.tsx
- No pricing, payment, or database logic affected

