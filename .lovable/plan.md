

## Fix: Payment Success State Getting Overridden

### Problem
When the Stripe popup tab signals success back to the original tab, the cross-tab listener correctly sets `step="success"`. However, the URL-params `useEffect` (line 190–206) also fires and sees the address/distance/price params still in the URL, so it resets `step` back to `"details"` — sending the user back to the checkout form instead of showing the thank-you page.

### Fix

**In `src/pages/Order.tsx`:**

1. **Guard the URL-params effect** (line 190–206) so it only sets `step="details"` when the current step is `"address"` (initial state). If the step has already advanced (e.g. to `"success"` via the payment signal), skip the override.

   Change line 204 from:
   ```tsx
   setStep("details");
   ```
   to:
   ```tsx
   setStep(prev => prev === "address" ? "details" : prev);
   ```

2. **Also guard against the signal arriving *after* the URL-params effect** — in the cross-tab signal listener (`processSignal`, ~line 139), the `setStep("success")` call already works correctly, but ensure `setSubmitting(false)` is called so the button state resets if the user navigates back.

### Technical Details
- Single line change using the functional form of `setStep` to only transition from `"address"` → `"details"`, preserving any other state (`"confirm"`, `"success"`)
- No backend or database changes needed

