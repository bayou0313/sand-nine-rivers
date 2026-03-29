

## Fix — Cash/Check Orders Showing $0.00 on Confirmation Page

### Root Cause
The confirmation page displays `totalPrice`, which is derived from `result` (the distance estimate state). If `result` becomes null or the component re-renders and loses state, `subtotal` falls to 0 (line 100), making `totalPrice` = $0.00.

### Fix
Store the final computed totals in state when the order is submitted, so the confirmation page uses a snapshot rather than depending on `result` still being available.

### Changes — `src/pages/Order.tsx`

**A. Add new state to capture confirmed totals (near line 74):**
```typescript
const [confirmedTotals, setConfirmedTotals] = useState<{
  totalPrice: number;
  totalWithProcessingFee: number;
  processingFee: number;
  taxAmount: number;
  subtotal: number;
  saturdaySurchargeTotal: number;
  distanceFee: number;
} | null>(null);
```

**B. Capture totals in `handleCodSubmit` (before `setStep("success")`, ~line 417):**
```typescript
setConfirmedTotals({
  totalPrice,
  totalWithProcessingFee,
  processingFee,
  taxAmount,
  subtotal,
  saturdaySurchargeTotal,
  distanceFee: result ? Math.max(0, (result.distance - BASE_MILES) * PER_MILE_EXTRA * quantity) : 0,
});
setStep("success");
```

**C. Capture totals in Stripe success handler (~line 172):**
Same `setConfirmedTotals(...)` call before `setStep("success")`.

**D. Use `confirmedTotals` on the success page:**
Create display variables at the top of the success block:
```typescript
const displayTotal = confirmedTotals?.totalPrice ?? totalPrice;
const displayTotalWithFee = confirmedTotals?.totalWithProcessingFee ?? totalWithProcessingFee;
const displayProcessingFee = confirmedTotals?.processingFee ?? processingFee;
```

Replace all `totalPrice`, `totalWithProcessingFee`, and `processingFee` references in the success section (lines 1060–1246) with these display variables.

Key lines affected:
- **Line 1094** (Amount Charged): use `displayTotalWithFee`
- **Line 1114** (Processing Fee): use `displayProcessingFee`
- **Line 1133** (Amount Due for cash/check): use `displayTotal`
- **Line 1206–1231** (Pricing Summary line items): use confirmed values
- **Line 1235** (Total): use display variables
- **Line 1242** (Due at delivery): use display variables

### No other files changed
This is a frontend-only fix in `src/pages/Order.tsx`.

