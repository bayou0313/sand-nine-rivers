

## Problem

When users select "PAY NOW" (Stripe), the flow skips the "Confirm Your Order" review step and goes directly to Stripe checkout. The "PAY AT DELIVERY" path correctly shows a review/confirm screen before placing the order.

## Plan

**Route Stripe through the same confirm step as cash/check:**

1. **In `src/pages/Order.tsx`** — Change the Stripe "PAY NOW" button from calling `handleStripeLink` directly to instead calling `goToStep2()` (same as cash), which transitions to the `confirm` step.

2. **Update the confirm step (Step 3)** to be payment-method-aware:
   - Show the correct payment label ("PAY NOW — STRIPE" vs "CASH/CHECK AT DELIVERY")
   - When `paymentMethod === "stripe-link"`, display the processing fee line item and the total with fee
   - Change the "PLACE ORDER" button to call `handleStripeLink` when Stripe is selected, or `handleCodSubmit` when cash/check

3. **Remove the inline Stripe summary and pay button** currently inside the `paymentMethod === "stripe-link"` block in Step 2 (lines 594–621), replacing it with the same "REVIEW ORDER" button used by cash/check.

### Result
Both payment paths will flow: Address → Details/Payment → **Review Order** → Submit. Stripe users see the full order summary (including processing fee) before being redirected.

