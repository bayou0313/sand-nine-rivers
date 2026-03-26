

## Fix: Add Database Polling Alongside Cross-Tab Signal for Reliable Payment Confirmation

### Problem
The cross-tab `localStorage` signal is unreliable in certain environments (iframes, different origins, browser restrictions). When it fails, the user stays on the checkout/confirm step even though the webhook has already updated the order to `paid` in the database.

### Solution
After the user clicks "Pay" and the Stripe tab opens, **poll the order's `payment_status` in the database** every 2–3 seconds. The existing `stripe-webhook` edge function already sets `payment_status = 'paid'` when Stripe confirms payment. When the poll detects `paid`, transition to the success step — no localStorage signal needed.

### Changes

**`src/pages/Order.tsx`:**

1. **Store the order ID after insert** — add state `pendingOrderId` to track the order waiting for payment.

2. **Start polling after Stripe tab opens** — in `handleStripeLink`, after opening the Stripe URL, start an interval that queries:
   ```sql
   SELECT payment_status, order_number FROM orders WHERE id = pendingOrderId
   ```
   When `payment_status === 'paid'`, set `step = "success"`, set `orderNumber`, show toast, and clear the interval.

3. **Keep existing cross-tab signal as fast path** — the localStorage listener fires instantly when it works; the DB poll is the reliable fallback (fires within 2–3s of webhook completing).

4. **Clean up** — clear the polling interval on unmount, on success, or on cancel signal.

### Technical Details
- Poll interval: every 3 seconds via `setInterval`
- Uses the existing anon RLS policy "Anon can read back recent orders" (order was created < 5 min ago)
- The `stripe-webhook` function already handles `payment_intent.succeeded` → sets `payment_status = 'paid'` and `status = 'confirmed'`
- No new edge functions, no database changes, no new secrets needed
- Both signals (localStorage + DB poll) race; whichever fires first wins, the other is cleaned up

