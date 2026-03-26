
## Stripe Return-to-Original-Page Flow (Auto-close Checkout Tab)

### Goal
Make Stripe checkout opened from `/order` return users back to the original checkout page automatically after success/cancel, and close the temporary payment tab/window.

### Files to update
- `src/pages/Order.tsx`
- `supabase/functions/create-checkout-link/index.ts`

### Implementation plan

1. **Add an explicit return mode for Stripe checkout creation**
   - In `handleStripeLink` (`Order.tsx`), send a new field in the function payload (e.g. `return_mode: "popup"` when checkout is opened in a new tab from embedded preview, otherwise `"redirect"`).
   - Keep current non-embedded behavior as same-tab redirect.

2. **Include return mode in Stripe success/cancel URLs**
   - In `create-checkout-link/index.ts`, accept `return_mode` from request body.
   - Append `return_mode` to `success_url` and `cancel_url` query params so `/order` knows whether it is the temporary Stripe-return tab or the primary app tab.

3. **Handle popup return tab: notify original page, then close**
   - In `Order.tsx` payment-return `useEffect`, when `payment` query param exists **and** `return_mode=popup`:
     - Publish a cross-tab signal to the original page (recommended: `localStorage` event payload with `status`, `order_number`, `session_id`).
     - Attempt `window.close()` immediately after signaling.
     - If browser blocks close, show a minimal fallback message/button (“Return to checkout”).

4. **Handle signal in original page and restore flow**
   - In `Order.tsx`, add a listener for the cross-tab signal.
   - On success signal: set `orderNumber`, `stripePaymentId`, move to `step="success"`, show success toast.
   - On cancel signal: set `step="confirm"`, show cancel toast.
   - Clear consumed signal to avoid duplicate toasts on refresh.

5. **Keep existing direct URL return behavior intact**
   - Preserve current search-param handling for normal same-tab Stripe flow (`return_mode=redirect` or absent) so production behavior remains reliable outside embedded preview.

6. **Tighten UX around pending payment state**
   - While popup is open, keep submit button disabled/loading to avoid duplicate clicks.
   - Re-enable cleanly if popup closes/cancels without completion signal.

### Technical details
- **Why this is needed:** browser security won’t let the original embedded tab automatically “take over” a separate checkout tab unless we pass a deliberate return signal.
- **Security:** only process signals that include expected shape/timestamp; ignore malformed payloads.
- **No database/schema changes required.**

### Verification checklist
1. From `/order`, click **Pay** (embedded preview path opens a new tab).
2. Complete payment in Stripe.
3. Confirm payment tab closes automatically.
4. Confirm original `/order` tab transitions to success state with order number/payment confirmed.
5. Repeat with cancel flow; confirm it returns to confirm step with cancel toast.
6. Verify non-embedded same-tab checkout still works normally.
