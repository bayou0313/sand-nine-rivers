# Riversand.net Create-Order (CRE) Flow — Comprehensive Reference v1.0

_Canonical end-to-end reference for the customer order-creation pipeline at riversand.net. Covers UI state machines, URL-param contract, pricing/distance/PIT engine, the `create_order` Postgres RPC, the Stripe path (checkout link → webhook → capture), post-create lifecycle (email, invoice, abandonment), and form-entry standards. Read-only audit, 2026-04-24._

**Version:** 1.0 (2026-04-24)
**Supersedes:** RIVERSAND_FORM_GUIDELINES_v1.1_2026-04-24.md (form-entry content folded into Section 9)
**Audit sources:** `src/pages/Order.tsx` (2190 lines), `src/pages/OrderMobile.tsx` (1608 lines), `src/lib/format.ts`, `src/lib/pits.ts`, `src/lib/cart.ts`, `src/components/EmailInput.tsx`, `src/components/AddressMismatchDialog.tsx`, `src/lib/textFormat.ts`, `supabase/functions/create-payment-intent/index.ts`, `supabase/functions/create-checkout-link/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/capture-payments/index.ts`, plus the `public.create_order` RPC and `notify_new_order` trigger.

**Changelog:**
- **1.0 (2026-04-24)** — Initial comprehensive CRE flow reference. Folds in the entirety of FORM_GUIDELINES v1.1.

---

## Table of contents

1. Overview & two-track architecture
2. Customer-facing UI state machine (desktop `Order.tsx`)
3. Customer-facing UI state machine (mobile `OrderMobile.tsx`)
4. URL-param contract (entry, return-from-Stripe, reschedule)
5. Pricing, distance & PIT-matching engine
6. Tax computation (3-tier priority chain)
7. Server contract: `create_order` RPC
8. Stripe path: checkout link → webhook → capture
9. Form-entry standards (folded from v1.1)
10. Post-create lifecycle (email, invoice, abandonment, notifications)
11. Cart persistence & cross-tab Stripe-return mechanics
12. Operator-side CRE (LMT manual order entry)
13. Known gaps, debt & v1.1 follow-ups
14. Version gate protocol

---

## 1. Overview & two-track architecture

**Routing split.** `src/App.tsx` defines `OrderRouter` which renders **`Order.tsx`** on desktop and **`OrderMobile.tsx`** on mobile via `useIsMobile()`. `localStorage.force_desktop === "true"` overrides. The two files share the same backend contract (same `create_order` RPC, same `create-checkout-link` edge function, same Stripe webhook), but differ in UX, step machines, and field layout.

**Backend boundary.** A successful CRE call from either UI:
1. Inserts a row into `public.orders` via the `public.create_order(p_data jsonb)` RPC (SECURITY DEFINER). Anonymous client cannot insert into `orders` directly — RLS forbids it.
2. Optionally invokes the `create-checkout-link` edge function to mint a Stripe Checkout Session (Stripe Link / card path).
3. Stripe webhook (`stripe-webhook`) reconciles the order on `checkout.session.completed`, `payment_intent.succeeded`, etc. — flipping `payment_status` and `status`, capturing card metadata, sending the order confirmation email.
4. The `notify_new_order` Postgres trigger inserts an admin notification row on every order INSERT — fires regardless of payment path.

**Two payment paths from the customer UI:**
- **COD** (`payment_method` = `cash` | `check`) — RPC inserts with `payment_status = "pending"`. No Stripe call. UI advances directly to success.
- **Stripe Link / card** (`payment_method = "stripe-link"`) — RPC inserts with `payment_status = "pending"`. Then `create-checkout-link` invoked, customer redirected to Stripe-hosted Checkout, webhook flips status to `paid` (or `authorized` for manual-capture, future-dated orders).

**Pricing modes.** Every order is created against one of two global pricing modes, controlled by `global_settings.pricing_mode`:
- **`baked`** (default) — card and COD pay identical `price`. The 3.5% processing fee is invisibly baked into the per-load base price. COD reverses the fee server-side via `getCODPrice(price, 3.5)`.
- **`transparent`** — COD pays `totalPrice`, card pays `totalWithProcessingFee = totalPrice + 3.5% + $0.30`. UI shows the surcharge as a line item.

---

## 2. Customer-facing UI state machine (desktop `Order.tsx`)

### 2.1 Step model

```ts
const [step, setStep] = useState<"address" | "details" | "success">("address");
```

Three steps. There is **no separate "confirm" step** on desktop — the details step contains the entire form, totals breakdown, payment selection, and submit button.

| Step | Renders | Entry condition |
|---|---|---|
| `address` | Hero + `<PlaceAutocompleteInput>` + `<DeliveryEstimator>`-style price preview | Default on fresh navigation; reset target after Stripe cancel |
| `details` | Form (name/company/phone/email/notes) + `<DeliveryDatePicker>` + payment selector + totals + submit | Set by the URL-param effect when `address` + `distance` + `price` are in the query string, OR when the user clicks "Continue" after a successful estimate |
| `success` | `<OrderConfirmation>` with totals, invoice download, "what's next" copy | Set after successful COD `create_order` insert OR after Stripe payment verification on return |

### 2.2 State catalog (desktop)

The desktop component declares ~50 `useState` hooks. Grouped by purpose:

**Form state (single object, see Section 9):**
```ts
const [form, setForm] = useState({
  name: "", companyName: "", phone: "", email: "", notes: ""
});
const [formAttempted, setFormAttempted] = useState(false);
```

**Pricing context:**
- `globalPricing: GlobalPricing` — fees pulled from `global_settings`, defaults to `FALLBACK_GLOBAL_PRICING`.
- `allPits: PitData[]` — every active, non-pickup PIT loaded once on mount.
- `matchedPit: PitData | null` — the PIT chosen for the customer's address (closest serviceable, may be reassigned by date).
- `weekdayPit: PitData | null` — fallback weekday PIT for date-aware reassignment.
- `result: EstimateResult | null` — `{ distance, billedDistance, price, address, duration, isNorthshore }`.
- `pricingMode: "transparent" | "baked"` — initialized to `"baked"` to match landing-page DOM and avoid layout flash (see `mem://ux/visual-stability/pricing-mode-initialization`).
- `allPitDistances: FindBestPitResult[]` — all active PITs ranked by distance, used by the date picker for per-date pit assignment.

**Order/payment state:**
- `paymentMethod: "stripe-link" | "cod" | null`
- `codSubOption: "cash" | "check"`
- `stripePaymentId`, `orderNumber`, `pendingOrderId`, `lookupToken`, `confirmedOrderId` — all populated at different points in the flow (see Section 8).
- `selectedDeliveryDate: DeliveryDate | null` — `{ date, iso, dayOfWeek, isSaturday, isSunday, isSameDay, ... }` from `<DeliveryDatePicker>`.
- `quantity: number` — initialized from `?quantity=` or `?qty=` URL param, clamped to `[1, 10]`.
- `discountAmount: number` — initialized from `?discount=`, clamped to `>= 0`. Set-once (no setter exposed).
- `leadReference: string | null` — RS-XX lead number from `?lead=` (proposal recovery / abandonment).

**Compliance gates** (all required to enable submit):
- `disclaimerAccepted`, `deliveryTermsAccepted`, `codPaymentConfirmed` (only for COD), `cardAuthAccepted` (only for stripe-link).

**Confirmation snapshot:**
```ts
const [confirmedTotals, setConfirmedTotals] = useState<{
  totalPrice, totalWithProcessingFee, processingFee, taxAmount, subtotal,
  saturdaySurchargeTotal, sundaySurchargeTotal, distanceFee, taxInfo
} | null>(null);
```
Captured at the moment of submit (or when returning from Stripe and re-hydrating from the DB) — frozen so the success page never re-derives totals from possibly-stale state.

### 2.3 Effect orchestration (desktop, ordered)

The component runs many `useEffect` blocks. The critical ones for the CRE flow, in roughly the order they fire on mount:

1. **`initSession()`** — POST to `leads-auth` action `init_session` to create/fetch `visitor_sessions` row. Captures IP, geo, referrer.
2. **Reschedule-token check** — If `?token=` is present and matches `orders.reschedule_token`, hydrate the order in reschedule mode and jump to `step="success"` with reschedule UI.
3. **Stripe-return handler** (lines ~318–591) — Detects `?payment=success`, `?payment=cancelled`, `?return_mode=popup`, etc. Flow:
   - On `payment=success`: read `order_number`, `session_id`, `order_id` from URL. Call `verifyStripePayment(orderId, lookupToken)` → calls `get-order-status` edge function → returns the canonical order record. Hydrate state, set `step="success"`, fire purchase tracking.
   - On `payment=cancelled`: try to restore from `sessionStorage.pending_order_snapshot` (set just before the Stripe redirect — see Section 11). If found, return to `step="details"` with all fields pre-filled. Otherwise reset to `step="address"`.
   - **Cross-tab signal**: writes `localStorage.stripe_payment_signal = JSON.stringify({...})` on success so the originating tab (if Stripe was opened in a popup) can detect completion.
4. **Cross-tab signal listener** (lines ~594–770) — Two parallel mechanisms:
   - `window.addEventListener("storage", ...)` — fires when another tab writes `stripe_payment_signal`. Brittle in iframes.
   - **1-second poll on `localStorage.stripe_payment_signal`** — fallback for iframes/preview environments where storage events are unreliable.
   - Both paths converge on `verifyStripePayment` and then `setStep("success")`.
5. **URL-param hydration for entry from estimator** (lines ~786–885) — If `address`, `distance`, `price`, etc. are all present in the URL, build a synthetic `EstimateResult`, locate the matching pit by `pit_id`, advance `step` from `address` to `details`. This is how `<DeliveryEstimator>` on the landing page hands off to the Order page.
6. **Address-mismatch handler** — Triggered by `<PlaceAutocompleteInput>` when the user's typed address resolves to a different ZIP via Google Geocoding. Opens `<AddressMismatchDialog>` with two options: continue with confirmed address, or change. (The "keep typed" branch from the dialog props is unused.)
7. **Purchase tracking** (`firePurchaseTracking`) — guarded by `sessionStorage` keyed on `order_number`. Fires `purchase` event to GTM dataLayer with `transaction_id`, `value`, `tax`, `items[]`. Idempotent — never fires twice for the same order.

### 2.4 Submit handlers (desktop)

Two parallel handlers, both share a `buildOrderData()` helper.

```ts
// src/pages/Order.tsx:1188–1226
const buildOrderData = () => {
  const distFee = result && effectivePricing
    ? Math.max(0, Math.round((result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * 100) / 100)
    : 0;
  return {
    customer_name: form.name.trim(),
    customer_email: form.email.trim() || null,
    customer_phone: form.phone.trim(),
    delivery_address: address,
    distance_miles: result!.distance,
    billed_distance_miles: result!.billedDistance ?? result!.distance,
    is_northshore: result!.isNorthshore ?? false,
    price: totalPrice,
    quantity,
    notes: form.notes.trim() || null,
    delivery_date: selectedDeliveryDate!.iso,
    delivery_day_of_week: selectedDeliveryDate!.dayOfWeek,
    saturday_surcharge: selectedDeliveryDate!.isSaturday,
    saturday_surcharge_amount: selectedDeliveryDate!.isSaturday ? effectiveSatSurcharge * quantity : 0,
    sunday_surcharge: selectedDeliveryDate!.isSunday,
    sunday_surcharge_amount: selectedDeliveryDate!.isSunday ? effectiveSunSurcharge * quantity : 0,
    pit_id: matchedPit?.id || null,
    delivery_window: deliveryWindow,
    same_day_requested: selectedDeliveryDate!.isSameDay,
    tax_rate: taxInfo.rate,
    tax_amount: taxAmount,
    tax_parish: taxInfo.parish,
    zip_code: detectedZip,
    delivery_terms_accepted: deliveryTermsAccepted,
    delivery_terms_timestamp: new Date().toISOString(),
    card_authorization_accepted: cardAuthAccepted,
    card_authorization_timestamp: cardAuthAccepted ? new Date().toISOString() : null,
    company_name: form.companyName.trim() || null,
    base_unit_price: effectivePricing.base_price,
    distance_fee: distFee * quantity,
    processing_fee: 0, // overridden in stripe path
    ...(leadReference ? { lead_reference: leadReference } : {}),
  };
};
```

**`handleCodSubmit`** (Order.tsx:1228–1300):
1. Guard: name + phone trimmed must be non-empty; email must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. On failure: set `formAttempted = true` + toast.
2. `supabase.rpc("create_order", { p_data: { ...buildOrderData(), payment_method: codSubOption, payment_status: "pending" } })`.
3. On success: set `orderNumber`, `confirmedOrderId`, `lookupToken`. Snapshot totals → `confirmedTotals`. `setStep("success")`. `clearCart()`. Fire purchase tracking. Update visitor session. Send order email (`type: "order"`, COD variant).
4. If `leadReference`: invoke `leads-auth` action `mark_converted` to flip the `delivery_leads` row.

**`handleStripeLink`** (Order.tsx:1302–1430+):
1. Same guards as COD.
2. Compute `stripeTotal = isBaked ? totalPrice : totalWithProcessingFee`.
3. RPC `create_order` with `payment_method: "stripe-link"`, `payment_status: "pending"`, `price: stripeTotal`, `processing_fee: isBaked ? 0 : processingFee`.
4. Invoke `create-checkout-link` edge function with `amount` (cents), description, customer name/email, `order_id`, `order_number`, `origin_url`, `return_mode: isEmbedded ? "popup" : "redirect"`, `same_day_requested`, `delivery_date`.
5. Store `pendingOrderId`, `lookupToken`. Update visitor session (`stripe_link_clicked: true`).
6. **Snapshot to `sessionStorage.pending_order_snapshot`** — survives the cross-origin redirect to checkout.stripe.com so on return the UI can re-hydrate.
7. Redirect: if iframe → `window.open(data.url, "_blank")` (popup). Otherwise → `window.location.assign(data.url)` (full redirect).

### 2.5 Step gating (compliance)

The submit button is disabled until ALL of:
- `form.name.trim()`, `form.phone.trim()`, `form.email.trim()` — required fields.
- `selectedDeliveryDate !== null`.
- `paymentMethod !== null`.
- `disclaimerAccepted && deliveryTermsAccepted`.
- For COD: `codPaymentConfirmed`.
- For stripe-link: `cardAuthAccepted`.
- Not already `submitting` (transport in-flight).

Critical exception: the button is **NOT disabled** for "form invalid because field empty". A click in that state flips `formAttempted` and reveals the red borders. This is intentional — see Section 9.4.

---

## 3. Customer-facing UI state machine (mobile `OrderMobile.tsx`)

### 3.1 Step model

```ts
const [step, setStep] = useState<"address" | "price" | "info" | "success">("address");
```

**Four steps**, not three. The desktop `details` step is split into a `price` (preview) step and an `info` (form) step on mobile to reduce cognitive load and let the user back out cleanly.

| Step | Renders | Entry condition |
|---|---|---|
| `address` | Mobile hero with white logo + autocomplete address input | Default; also reset target on browser back from `price` |
| `price` | Price card, quantity selector, "Continue" button | Set after successful estimate; also from URL params |
| `info` | Form (name, phone, email, optional company/notes) + `<DeliveryDatePicker>` + payment + totals + submit | Set when user taps "Continue" on price step |
| `success` | `<OrderConfirmation>` mobile variant | After successful submit OR after Stripe verification |

### 3.2 Mobile-specific behaviors

- **Browser back-button interception** (`popstate` listener, lines ~234–256) — `info → price`, `price → address`, `address → /` (home). Required because the in-app step machine doesn't push history entries.
- **Optional fields collapsed**: Company and Notes hidden behind `+ Add Company Name` / `+ Add Delivery Notes` chips. State: `showCompany`, `showNotes`.
- **Visual-viewport scroll**: every input has `onFocus` that calls `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` on a 300ms timeout. Works around iOS keyboard pushing fields off-screen.
- **Auto-advance phone → email**: when the formatted phone reaches 14 chars (full mask `(xxx) xxx-xxxx`), synthetic focus jumps to email input. Customer-flow only; not used in operator forms.
- **Form-wide autoComplete scope**: the entire info-step block is wrapped in `<form autoComplete="on" onSubmit={e => e.preventDefault()}>` so iOS treats it as a single coherent autofill scope.
- **`enterKeyHint="next"`** + manual `onKeyUp` Enter handler that focuses the next field's `ref`.
- **Mobile prefill**: address can also come from `sessionStorage.mobile_prefill_address` (set by the landing-page mobile address bar before navigating to `/order`).

### 3.3 Submit handlers (mobile)

`OrderMobile.tsx` mirrors the desktop submit pattern almost verbatim. Same `buildOrderData()` (lines 840–876), same `handleCodSubmit` (879–919), same `handleStripeLink` (922–994). Differences:
- Email validation reads from the live DOM input (`document.querySelector('input[type="email"][autocomplete="email"]')`) before falling back to React state — works around an iOS Safari autofill bug where state lags behind the visible value.
- `populateConfirmedTotals` re-fetches the freshly-inserted order from the DB to get authoritative totals, then calls `setConfirmedTotals(...)` BEFORE transitioning to `step="success"` (avoids a flash of stale numbers).

Everything else — RPC call shape, Stripe edge-function invocation, snapshot to sessionStorage, redirect strategy — is identical to desktop.

---

## 4. URL-param contract

The Order page is heavily URL-driven. Three classes of params: **entry params** (handoff from estimator/landing), **return params** (handoff from Stripe), and **special-mode params** (reschedule, lead recovery).

### 4.1 Entry params (set by landing-page estimator or external links)

| Param | Type | Use | Read in |
|---|---|---|---|
| `address` | string | Customer delivery address | Both |
| `distance` | number | Driving miles | Both |
| `price` | number | Per-load base price | Both |
| `duration` | string | Driving duration display ("~30 min") | Desktop only |
| `quantity` or `qty` | int 1–10 | Number of loads | Both — clamped |
| `pit_id` | uuid | Pre-matched PIT | Both |
| `pit_name` | string | Display name | Both |
| `operating_days` | csv int | "1,2,3,4,5" → restricts date picker | Both |
| `sat_surcharge` | number | Saturday surcharge override | Both |
| `sun_surcharge` | number | Sunday surcharge override | Desktop only |
| `same_day_cutoff` | "HH:MM" | Cutoff for same-day eligibility | Both |
| `discount` | number | Abandonment recovery discount | Both — set-once |
| `lead` | string | RS-XX lead number for proposal flow | Both |
| `utm_source` | string | Marketing attribution | Desktop only |

When all of `address`, `distance`, `price` are present, the URL-param effect synthesizes an `EstimateResult` and advances `step` from `address` to `details` (desktop) / `price` (mobile).

### 4.2 Return params (written by Stripe success/cancel URLs in `create-checkout-link`)

| Param | Value | Meaning |
|---|---|---|
| `payment` | `success` \| `cancelled` | Stripe outcome |
| `order_number` | string | RS-YY-NNNN |
| `order_id` | uuid | DB primary key (canonical) |
| `session_id` | `{CHECKOUT_SESSION_ID}` substituted by Stripe | Stripe session ID |
| `return_mode` | `popup` \| (absent) | If popup, originating tab also receives `localStorage.stripe_payment_signal` |

On `payment=success`, the UI calls `verifyStripePayment(order_id, lookup_token)` → `get-order-status` edge function → returns sanitized order record. UI hydrates and shows success.

On `payment=cancelled`, UI restores from `sessionStorage.pending_order_snapshot` and returns to the form step. The order row stays in the DB with `payment_status = "pending"`.

### 4.3 Special-mode params

- **`?token=<uuid>`** with `?reschedule=true` — Reschedule mode. Token must match `orders.reschedule_token` AND `reschedule_token_used = false`. Allows the customer to pick a new date for an authorized order whose capture failed (see Section 8.5).
- **`?token=<uuid>`** alone — Generic order lookup; jumps to a read-only success view if the token matches `orders.lookup_token`.

---

## 5. Pricing, distance & PIT-matching engine

All pricing is **PIT-driven**, never global. Each PIT row in `public.pits` carries `base_price`, `free_miles`, `price_per_extra_mile`, `max_distance`. Globals are only used for fallback safety constants.

### 5.1 Distance calculation

**Mandate (from `src/lib/pits.ts` header):** Driving distance via Google Distance Matrix API, `mode=driving`, `avoid=ferries`, tolls allowed (I-10 etc are used, not avoided). **No haversine, ever, anywhere — not even as a pre-filter or fallback.**

The `findBestPitDriving` and `findAllPitDistances` functions in `src/lib/pits.ts` proxy through the `leads-auth` edge function (`action: "calculate_distances"`) which calls Google server-side using `GOOGLE_MAPS_SERVER_KEY`. This keeps the API key server-only.

### 5.2 PIT selection algorithm

```ts
// src/lib/pits.ts:172–248 (findBestPitDriving)
1. Filter active, non-pickup-only pits.
2. If a deliveryDayOfWeek is supplied, also filter to pits whose
   operating_days array includes that day (or has no restriction).
3. Get driving distances from leads-auth (parallel batch call).
4. For each pit: compute price = calcPitPrice(effectivePricing, billedDistance, 1).
   serviceable = (driving_distance <= effective.max_distance)
5. If no pit serviceable: return the single closest as { serviceable: false } — UI shows out-of-area.
6. Else: sort serviceable pits — primary key = distance asc.
   Tie-breaker: if two pits within 0.5 mi of each other, prefer the cheaper.
   Return the winner.
```

`findAllPitDistances` returns the full ranked array (no winner selection), used by `<DeliveryDatePicker>` for **per-date pit assignment** — different dates can route to different PITs based on each pit's `operating_days`. See `mem://features/pit-management-logic` and `mem://business/pit-selection-logic`.

### 5.3 Phantom-mile / Northshore policy

The `leads-auth` `calculate_distances` action returns two parallel arrays:
- `distances[]` — actual driving miles (used for display and serviceability check).
- `billed_distances[]` — augmented miles used for pricing.

If the destination falls in St. Tammany Parish (Northshore: Slidell, Mandeville, Covington, Madisonville, Abita Springs), the server adds a **3-mile phantom surcharge** to compensate for bridge / toll / regulatory costs. `is_northshore: true` is also returned. See `mem://business/toll-recovery-policy`.

`calcPitPrice` (src/lib/pits.ts:142–148) is always called against `billedDistance`, never `distance`:
```ts
const extraMiles = Math.max(0, billedDistance - free_miles);
const extraCharge = extraMiles * extra_per_mile;
const rawPrice = base_price + extraCharge;
const unitPrice = Math.max(base_price, Math.round(rawPrice));
return unitPrice * qty;
```

### 5.4 Surcharges & fees

- **Saturday surcharge**: per-PIT override (`pits.saturday_surcharge_override`) falls back to global `saturday_surcharge` (default $35). Applied in `buildOrderData` as `effectiveSatSurcharge * quantity` when `selectedDeliveryDate.isSaturday`.
- **Sunday surcharge**: per-PIT only (`pits.sunday_surcharge`). Applied symmetrically.
- **Holiday surcharge**: per-PIT (`holiday_surcharge_override`) falls back to per-holiday (`holidays.surcharge_override`). Not handled in the customer Order flow today — holidays present a closure banner instead.
- **Card processing fee** (transparent mode only): `(base + tax) × 0.035 + $0.30`. See `mem://business/fee-management-policy`.
- **Discount**: from `?discount=` URL param. Subtracted at totals build time.

### 5.5 Pricing-mode policy (single price vs split price)

`global_settings.pricing_mode` decides how `price` is shown and stored:

- **`baked`** — stored `price` includes the 3.5% fee invisibly. UI shows ONE total to both card and COD customers. RPC's `getCODPrice` reverses the fee at COD checkout time so the COD record reflects the same net base. See `mem://business/pricing-mode-system`.
- **`transparent`** — stored `price` is the base. Card path adds `processing_fee` line item; UI shows two distinct totals.

Initial mount uses `pricingMode = "baked"` to match landing-page DOM and avoid layout flash. See `mem://ux/visual-stability/pricing-mode-initialization`.

---

## 6. Tax computation (3-tier priority chain)

Tax is computed **server-side** in the `create_order` RPC. The client sends `tax_rate`, `tax_amount`, `tax_parish`, and `zip_code` — but the server overrides them via a strict priority chain:

### Server priority chain (RPC, lines re: tax block)

```
Priority 1: ZIP code lookup
  SELECT combined_rate, state_rate, local_rate FROM zip_tax_rates
  WHERE zip_code = v_zip_code LIMIT 1;

Priority 2: Parish lookup (fallback if no ZIP match)
  SELECT combined_rate, state_rate, local_rate FROM tax_rates
  WHERE state_code = 'LA' AND LOWER(county_parish) = LOWER(v_tax_parish) LIMIT 1;

Priority 3: Client-sent rate (last resort)
  v_combined_rate := (p_data->>'tax_rate')::numeric;
  v_state_rate := 0.05;  -- LA state default
  v_local_rate := combined - state;
```

Then the taxable base is computed and the rate applied:
```sql
v_taxable_base := base_unit_price * quantity + distance_fee
                + saturday_surcharge_amount + sunday_surcharge_amount;
v_state_tax_amount := ROUND(v_taxable_base * v_state_rate, 2);
v_parish_tax_amount := ROUND(v_taxable_base * v_local_rate, 2);
v_total_tax := v_state_tax_amount + v_parish_tax_amount;
```

The order row is written with the **server-computed** `tax_rate`, `tax_amount`, `state_tax_rate`, `state_tax_amount`, `parish_tax_rate`, `parish_tax_amount`. Client values are discarded if a higher-priority match exists.

### Client-side tax computation (display only)

`src/lib/format.ts` (`getTaxRateFromAddress`, `getTaxRateByParish`) provides client-side parish-rate lookup using a hardcoded `PARISH_TAX_RATES` map (Jefferson 0.0975, Orleans 0.10, etc.) plus a city → parish fallback map. **This is for UI display only** — the server is authoritative.

**Known operational quirk** (from `mem://business/tax-management-system` and CLAUDE.md):
> `zip_tax_rates` queries require `.limit(10000)` — Supabase's default row limit silently truncates results. Tax-lookup bugs for specific ZIPs are usually this.

---

## 7. Server contract: `create_order` RPC

Single Postgres SECURITY DEFINER function. The only path by which an `orders` row gets written from the public surface — RLS on `orders` blocks all anon/auth INSERTs, so this RPC is the choke point.

### 7.1 Test-mode guard (FIRST thing it does)

```sql
SELECT value INTO v_stripe_mode FROM global_settings WHERE key = 'stripe_mode';
IF v_stripe_mode = 'test' THEN
  RETURN jsonb_build_object(
    'id', gen_random_uuid(),
    'order_number', 'RS-TEST-0000',
    'lookup_token', 'test-token-' || extract(epoch from now())::text,
    'confirmation_token', 'test-confirm',
    'test_mode', true
  );
END IF;
```

In test mode **no DB write happens at all**. Returns synthetic IDs so the UI thinks the order succeeded. This is how the orange "Test Mode" banner mode works (see `mem://features/site-control/site-mode`).

### 7.2 Input schema (`p_data` JSONB)

Every key currently consumed by the RPC, with type and default behavior:

| Key | Type | Required | Notes |
|---|---|---|---|
| `customer_name` | text | yes | Stored as-is (proper-case applied client-side) |
| `customer_email` | text | no | `NULLIF('', '')` — empty string becomes NULL |
| `customer_phone` | text | yes | Digits-only at payload-build time via `stripPhone()` |
| `delivery_address` | text | yes | Google Places `formatted_address` |
| `distance_miles` | numeric | yes | Driving miles (display) |
| `billed_distance_miles` | numeric | no | Northshore-augmented; not consumed by RPC currently but written as a column on subsequent updates |
| `is_northshore` | boolean | no | Same — column is set elsewhere |
| `price` | numeric | yes | Top-level total |
| `quantity` | int | no | Defaults 1 |
| `notes` | text | no | NULLIF |
| `delivery_date` | date | no | NULLIF |
| `delivery_day_of_week` | text | no | "Monday".."Sunday" |
| `saturday_surcharge` | bool | no | default false |
| `saturday_surcharge_amount` | int (cents-like, but stored as int) | no | default 0 |
| `sunday_surcharge` | bool | no | default false |
| `sunday_surcharge_amount` | int | no | default 0 |
| `delivery_window` | text | no | default `'8:00 AM – 5:00 PM'` |
| `same_day_requested` | bool | no | default false |
| `tax_rate` | numeric | no | client hint — overridden server-side (see Section 6) |
| `tax_amount` | numeric | no | re-computed server-side |
| `tax_parish` | text | no | input to priority chain |
| `zip_code` | text | no | input to priority chain |
| `payment_method` | text | no | default `'COD'` — values used: `cash`, `check`, `stripe-link` |
| `payment_status` | text | no | default `'pending'` |
| `lead_reference` | text | no | NULLIF |
| `delivery_terms_accepted` | bool | no | default false |
| `delivery_terms_timestamp` | timestamptz | no | parsed |
| `card_authorization_accepted` | bool | no | default false |
| `card_authorization_timestamp` | timestamptz | no | parsed |
| `pit_id` | uuid | no | parsed |
| `company_name` | text | no | NULLIF |
| `base_unit_price` | numeric | no | passed through |
| `distance_fee` | numeric | no | passed through |
| `processing_fee` | numeric | no | passed through |

### 7.3 Side effects

After the INSERT into `orders`, the RPC also:

1. **Customer upsert** — if `customer_email` is non-null:
   ```sql
   INSERT INTO customers (email, name, phone, company, ...) VALUES (...)
   ON CONFLICT (email) DO UPDATE SET
     name = EXCLUDED.name, phone = EXCLUDED.phone,
     company = COALESCE(EXCLUDED.company, customers.company),
     last_order_date = CURRENT_DATE,
     total_orders = customers.total_orders + 1,
     total_spent = customers.total_spent + EXCLUDED.total_spent,
     updated_at = now()
   RETURNING id INTO v_customer_id;
   UPDATE orders SET customer_id = v_customer_id WHERE id = v_id;
   ```
2. **`generate_order_number` trigger** — fires on INSERT, sets `order_number = 'RS-YY-' || nextval('order_number_seq')`.
3. **`notify_new_order` trigger** — fires on INSERT, writes a row into `notifications`:
   ```
   type: 'new_order'
   title: 'New Order'
   message: '<customer_name> placed a <payment_method> order for <delivery_address>'
   entity_type: 'order'
   entity_id: <order.id>
   ```
   This is what powers the bell-icon notifications in the LMT dashboard.

### 7.4 Return shape

```json
{
  "id": "<uuid>",
  "order_number": "RS-26-1234",
  "lookup_token": "<uuid>",
  "confirmation_token": "<uuid>"
}
```

The UI uses:
- `id` → `confirmedOrderId` and (Stripe path) `pendingOrderId`.
- `order_number` → display + dedupe key for purchase tracking.
- `lookup_token` → passed to `get-order-status` for return-from-Stripe verification, and to `generate-invoice` for PDF download.
- `confirmation_token` → not used by the customer UI today; reserved for email-link-based confirmations.

---

## 8. Stripe path: checkout link → webhook → capture

### 8.1 `create-checkout-link` edge function

Called by `handleStripeLink` after `create_order` succeeds. Source: `supabase/functions/create-checkout-link/index.ts` (198 lines).

**Inputs:**
```ts
{ amount: number (cents), description: string, customer_name, customer_email,
  order_id: uuid, order_number: string,
  origin_url: string, return_mode: "popup" | "redirect",
  same_day_requested?: boolean, delivery_date?: string }
```

**Logic:**
1. Read `global_settings.stripe_mode` → pick `STRIPE_SECRET_KEY` or `STRIPE_TEST_SECRET_KEY`.
2. Fetch the order row to get `customer_phone`, `customer_email`, `same_day_requested`, `delivery_date`.
3. Compute `isSameDay = same_day_requested === true || delivery_date === today_central`.
4. **Customer tier lookup** by `customer_phone`:
   - 0 prior paid orders → Tier 1, `request_three_d_secure: "any"` (always challenge new customers).
   - 1+ prior paid orders → Tier 2, `request_three_d_secure: "automatic"` (Stripe decides).
   - 3+ prior paid orders → Tier 3, `request_three_d_secure: "automatic"` (VIP).
   - If a returning customer has a prior `stripe_customer_id`, attach it to the session (pre-fills saved card).
5. **Capture method**:
   - `isSameDay` → `automatic` (capture immediately; cron only handles next-day).
   - Future-dated → `manual` (auth-only; nightly `capture-payments` cron captures the night before delivery).
6. Build success URL:
   ```
   {origin}/order?payment=success&order_number={n}&order_id={id}&session_id={CHECKOUT_SESSION_ID}
   ```
   (plus `&return_mode=popup` when applicable). Cancel URL drops `session_id`.
7. Create checkout session with `mode: "payment"`, `line_items: [{ price_data: { ... unit_amount: amount } }]`, `customer_creation: "always"`, `payment_intent_data.setup_future_usage: "off_session"` (saves card for future), and `metadata: { order_id, order_number }` on both the session AND the payment_intent (for webhook resolution chain).
8. Update `orders.customer_tier` (fire-and-forget).
9. Return `{ url, session_id }`.

**Hardening (from `mem://tech/payment-infrastructure`):** `billing_address_collection: "required"` is set on all sessions; not visible in the snippet above but enforced in the live function.

### 8.2 Stripe-hosted checkout

User completes payment on `checkout.stripe.com`. Stripe redirects to the `success_url`. There is no callback to our app between checkout open and return — the webhook is the only authoritative signal.

### 8.3 `stripe-webhook` edge function

Source: `supabase/functions/stripe-webhook/index.ts` (473 lines). Listens on `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.amount_capturable_updated`, `charge.refunded`.

**Idempotency:** every event is checked against `payment_events.event_id` first. Duplicates return 200 immediately.

**Order resolution priority chain** (this is the key debugging detail):
```
1. session.metadata.order_id (most reliable — set by create-checkout-link)
2. session.client_reference_id
3. session.metadata.order_number → SELECT id FROM orders WHERE order_number = ...
4. (Final fallback) WHERE stripe_payment_id = <pi.id>
```

For `payment_intent.*` events (no session), `pi.metadata.order_id` then `pi.metadata.order_number` then payment-id match.

**Payment-status decision:**
- `checkout.session.completed` with `pi.capture_method === "manual"` AND `pi.status === "requires_capture"` → `payment_status = "authorized"`, `capture_status = "pending"`. (Future-dated orders.)
- `checkout.session.completed` with `session.payment_status === "paid"` → `payment_status = "paid"`. (Same-day orders.)
- `payment_intent.succeeded` → `paid`.
- `payment_intent.payment_failed` → `failed`.
- `payment_intent.canceled` → `canceled`.
- `charge.refunded` → `refunded`.

**Updates applied to `orders`:**
- `payment_status`, `stripe_payment_id`, optionally `capture_status`.
- If `paymentStatus === "paid"` and `currentOrder.status === "pending"`: also set `status = "confirmed"`.
- Card metadata: `card_last4`, `card_brand` (retrieved via `stripe.paymentIntents.retrieve(id, { expand: ["payment_method"] })`).
- Billing address: `billing_address`, `billing_name`, `billing_zip`, `billing_country`, `billing_matches_delivery` (computed from delivery ZIP).
- `stripe_customer_id` (from `session.customer`).
- **Fraud flag**: if `billing_zip !== delivery_zip`, set `review_status = 'pending_review'`, append `'billing_delivery_mismatch'` to `fraud_signals[]`, fire `send-email type: "fraud_alert"`, insert a `fraud_flagged` notification.

**Email send:** AFTER successful DB update, `paid` or `authorized` orders trigger:
```js
fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  body: JSON.stringify({ type: "order", data: { ...currentOrder, ...updateData } })
});
```
Plus a `payment_completed` notification row.

**Logging:** every event also writes to `payment_events` (event_id, event_type, order_id, stripe_payment_id) for audit trail.

**Fraud tracking:** `payment_intent.payment_failed` and `payment_intent.succeeded` events POST to `leads-auth` action `log_payment_attempt` to populate the `payment_attempts` table.

**Error handling:** on processing exception, returns **500** so Stripe retries (deliberately not swallowed). On DB update failure, also 500.

### 8.4 `capture-payments` cron (manual-capture lifecycle)

Source: `supabase/functions/capture-payments/index.ts` (191 lines). Run nightly via cron.

**Logic:**
1. Compute `tomorrowStr` in Central time (`now + (-5h offset for CDT)` → next day, YYYY-MM-DD).
2. Query `orders WHERE payment_status = 'authorized' AND delivery_date = tomorrow AND status != 'cancelled' AND capture_status != 'captured'`.
3. For each order: `stripe.paymentIntents.capture(stripe_payment_id)`.
   - On success: `payment_status = 'paid'`, `capture_status = 'captured'`, `capture_attempted_at = now()`.
   - On failure: `capture_status = 'failed'`, generate `reschedule_token` (uuid), insert into `orders`. Send `capture_failed` email to customer with reschedule URL `/order?reschedule=true&token=<token>`. Insert admin notification.
4. Send admin summary email at the end.

### 8.5 Reschedule loop

When capture fails, the customer gets an email with a reschedule link. The Order page detects `?reschedule=true&token=<uuid>`, validates against `orders.reschedule_token`, lets the customer pick a new date. On successful reschedule, the order's `delivery_date` is updated (via leads-auth, not the customer UI directly) and `reschedule_token_used = true` to prevent reuse. The next nightly `capture-payments` run picks it up again.

### 8.6 `create-payment-intent` (vestigial?)

Source: `supabase/functions/create-payment-intent/index.ts` (49 lines). Creates a raw PaymentIntent with `{ amount, metadata }` and returns `{ clientSecret, paymentIntentId }`. Not currently called from the customer Order flow (confirmed by grep — no client-side `invoke("create-payment-intent")` in `Order.tsx` or `OrderMobile.tsx`). May be a leftover from an earlier embedded-card-element experiment, or used by the LMT dashboard for in-admin payments.

---

## 9. Form-entry standards (folded from FORM_GUIDELINES v1.1)

This section supersedes `RIVERSAND_FORM_GUIDELINES_v1.1_2026-04-24.md`. Future edits go here.

### 9.1 State model

- **Single `useState` object** for the whole form (`form` with `name`, `companyName`, `phone`, `email`, `notes`). Updates use spread.
- **`formAttempted: boolean`** flipped to `true` only when the user clicks submit while the form is invalid.
- An effect resets `formAttempted` back to `false` once `isFormValid` becomes true:
  ```ts
  useEffect(() => { if (isFormValid) setFormAttempted(false); }, [isFormValid]);
  ```
- `isFormValid` is a derived const, not state: `selectedDeliveryDate && form.name.trim() && form.phone.trim() && form.email.trim()`.
- Submit click handler: `if (!isFormValid) { setFormAttempted(true); return; }`.
- **No validation on blur or change.** Only on submit attempt. Inline transformations (mask/title-case/lowercase) DO happen on change/blur, but error states do not.

### 9.2 Field-by-field spec

#### Label styling

```tsx
// Customer-facing checkout (desktop):
className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block"

// Mobile checkout AND all LMT operator forms:
className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block"
```

Use `text-xs mb-1` for any new operator/admin form. Use `text-sm mb-1.5` only inside customer checkout flows.

#### Name

```tsx
<Input
  type="text" name="name" autoComplete="name" maxLength={100} required
  value={form.name}
  onChange={(e) => setForm({ ...form, name: formatProperName(e.target.value) })}
  onBlur={(e)   => setForm({ ...form, name: formatProperNameFinal(e.target.value) })}
  className={`h-[52px] rounded-lg text-base ${
    formAttempted && !form.name.trim() ? "border-destructive border-2" : ""
  }`}
/>
```

#### Company Name (optional)

Same as Name but `name="companyName"`, `autoComplete="organization"`, no `required`, no error styling.

#### Phone

```tsx
<Input
  type="tel" inputMode="tel" name="phone" autoComplete="tel" maxLength={14} required
  value={form.phone}
  onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
  className={`h-[52px] rounded-lg text-base ${
    formAttempted && !form.phone.trim() ? "border-destructive border-2" : ""
  }`}
/>
```

Display = formatted `(555) 555-5555`. Storage = digits-only via `stripPhone()` at payload-build time. US-only, no country code.

#### Email — always via `<EmailInput>`

```tsx
<EmailInput
  name="email"
  value={form.email}
  onChange={(v) => setForm({ ...form, email: formatEmail(v) })}
  required
  className={`h-[52px] rounded-lg text-base ${
    formAttempted && !form.email.trim() ? "border-destructive border-2" : ""
  }`}
/>
```

`EmailInput` is a thin wrapper around shadcn `<Input>`. It hard-sets `type="email"` and `autoComplete="email"`, defaults `maxLength={255}`, `placeholder="john@example.com"`. **It does NOT lowercase** — the `formatEmail` wrapper is mandatory (iOS Safari autocaps the first letter; `formatEmail` is the only line of defense).

#### Notes / Delivery Instructions

```tsx
<Textarea
  name="notes" rows={2} maxLength={275}
  value={form.notes}
  onChange={(e) => setForm({ ...form, notes: formatSentence(e.target.value) })}
  className="rounded-lg text-base"
/>
<p className="text-xs text-muted-foreground mt-1 text-right font-body">{form.notes.length}/275</p>
```

`maxLength`: **275** for customer delivery instructions (truck-driver readability). **1000** for operator/admin notes.

#### Date input

Custom `<DeliveryDatePicker>` for checkout. For generic date fields elsewhere: `<Input type="date" className="h-11 rounded-lg" />`.

#### Number input

```tsx
<Input type="number" step="0.01" min="0" className="h-11 rounded-lg" />
```

Always include `min` and `step`. No `max` unless business rule requires.

#### Select

**Always shadcn `<Select>`. Never native.** Trigger uses `h-11 rounded-lg`.

### 9.3 Mobile-specific overrides

OrderMobile inherits everything in 9.2 with deliberate departures:
1. Larger inputs: `h-16 rounded-xl text-lg placeholder:text-black/35`.
2. `enterKeyHint="next"` on every non-final field + manual `onKeyUp` Enter handler.
3. `onFocus` calls `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` after 300ms.
4. Auto-advance to email when phone reaches 14 chars (full mask).
5. Whole form wrapped in `<form autoComplete="on" onSubmit={e => e.preventDefault()}>` for iOS autofill scope.
6. Optional fields (Company, Notes) collapsed behind `+ Add …` chips.

### 9.4 Validation pattern

| When | What happens |
|---|---|
| User types | `onChange` runs format transforms. **No validation.** |
| User blurs a field | Text-format finalization (e.g. `formatProperNameFinal`). **No validation.** |
| User clicks submit while invalid | `setFormAttempted(true)`. Required empty fields get `border-destructive border-2`. Submit handler returns early. |
| User fixes the field | Effect detects `isFormValid === true` and clears `formAttempted` → red borders disappear. |
| Server rejects valid client state | Inline error (e.g. duplicate phone 409 → `setPhoneError(...)`) OR toast for transport errors. Inline preferred when actionable on a specific field. |

**Helper text styling:**
```tsx
<div className="flex items-center gap-1 mt-1 text-xs" style={{ color: "#DC2626" }}>
  <AlertCircle className="w-3 h-3" />
  {errorMessage}
</div>
```

**Form-level summary:**
```tsx
{!isFormValid && (
  <p className="font-body text-xs text-destructive text-center">
    Please fill in all required fields above.
  </p>
)}
```

**No `aria-invalid`, `aria-describedby`, `aria-live`, or auto-focus on first error.** Known a11y gap, scheduled for v1.1 of this doc / v1.2 form-pass.

### 9.5 Submit button

```tsx
<Button
  onClick={() => {
    if (!isFormValid) { setFormAttempted(true); return; }
    handleSubmit();
  }}
  disabled={submitting || !termsAccepted /* + business gates */}
  className="w-full h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90
             rounded-2xl shadow-lg shadow-accent/20 transition-all duration-300 disabled:opacity-40"
>
  {submitting
    ? <Loader2 className="w-5 h-5 animate-spin" />
    : <><Lock className="w-4 h-4 mr-2" /> SUBMIT</>}
</Button>
```

Rules:
- **Disabled** for transport in-flight + business gates (terms, payment confirmed).
- **NOT disabled** for "field empty" — leave it clickable so the click can flip `formAttempted`.
- **Spinner**: `<Loader2 className="w-5 h-5 animate-spin" />` from `lucide-react`. No text change in checkout — spinner replaces the entire label.
- **Operator/LMT variant**: smaller, spinner inline with text: `{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save`.

### 9.6 Format transform reference

| Function | Use case | Trigger |
|---|---|---|
| `formatPhone(v)` | Mask raw input → `(555) 555-5555`, truncate to 10 digits | onChange |
| `stripPhone(v)` | Strip mask → digits only | At payload-build time |
| `formatProperName(v)` | Real-time title-case | onChange |
| `formatProperNameFinal(v)` | Final normalization (Mc, O', etc) | onBlur |
| `formatSentence(v)` | Capitalize first letter of each sentence | onChange (notes) |
| `formatEmail(v)` | Lowercase + trim | onChange and onBlur (mandatory wrapper for EmailInput) |
| `formatCurrency(n)` | `$1,234.56` | Display-only |

### 9.7 Case handling per field — definitive

| Field | Case rule | Enforcement | Notes |
|---|---|---|---|
| Name / Full Name | Title Case (`John McDonald`) | `formatProperName` onChange + `formatProperNameFinal` onBlur | iOS first-letter auto-cap is desired; no autoCapitalize override |
| Company Name | Title Case | Same as Name | |
| Phone | n/a (digits + punct) | `formatPhone` strips non-digits | US-only |
| Email | **lowercase + trim** | `formatEmail(v)` wrapper on `<EmailInput>` onChange/onBlur | **Mandatory.** EmailInput does NOT lowercase. iOS Safari autocaps first letter — formatEmail is the only line of defense. |
| Notes | Sentence case | `formatSentence` onChange | Capitalizes after `.`, `!`, `?` |
| Address | As-returned by Google Places | No transform | Google `formatted_address` is authoritative |
| Operator-only fields (Truck Number, etc.) | **No transform** — preserve as-typed | n/a | Truck numbers may legitimately be `T-101`, `t101`, or `TRUCK-A` |

### 9.8 Visual / token reference

| Token | Value | Where |
|---|---|---|
| Label color | `text-muted-foreground` | All labels |
| Label font | `font-body` (Inter) | All labels |
| Label size | `text-sm` (desktop checkout) / `text-xs` (mobile + operator) | — |
| Label transform | `uppercase tracking-wider` | Always |
| Label spacing | `mb-1.5 block` (checkout) / `mb-1 block` (operator) | — |
| Error color | `border-destructive` (token) and `#DC2626` (literal) | Token in customer flows; literal in operator dashboards |
| Input height | `h-[52px]` (desktop checkout), `h-16` (mobile checkout), `h-11` (operator main), `h-9` (operator compact) | — |
| Input radius | `rounded-lg` (desktop + operator), `rounded-xl` (mobile) | — |
| Input text size | `text-base` (desktop), `text-lg` (mobile), default (operator) | — |
| Input bg | `bg-background` (shadcn default) | — |
| Focus ring | shadcn default (don't override) | — |
| Section heading | `font-display tracking-wider text-2xl` (checkout) / `font-display uppercase tracking-wide` (operator dialogs) | — |
| Brand navy | `#0D2137` literal | Operator section headings |
| Brand gold | `#C07A00` literal | Operator save buttons |

### 9.9 Layout patterns

- Field pairs: desktop checkout `grid grid-cols-1 sm:grid-cols-2 gap-3`. Operator dialogs `grid grid-cols-2 gap-3` (no responsive collapse).
- Vertical spacing: `space-y-3` inside a section, `space-y-4`/`space-y-6` between sections.
- Section heading: icon-in-rounded-square + uppercase text.
- Wrap whole form in `<form autoComplete="on" onSubmit={e => e.preventDefault()}>` on mobile.

---

## 10. Post-create lifecycle

### 10.1 Order confirmation email

Sent by `stripe-webhook` (paid/authorized orders) or directly by the UI's `sendOrderEmail` (COD orders).

POST to `/functions/v1/send-email`:
```json
{ "type": "order", "data": { ...orderRecord } }
```

`send-email` (1504 lines) handles many types: `order`, `contact`, `out_of_area_lead`, `callback`, `proposal`, `cash_payment_confirmation`, `capture_failed`, `capture_summary`, `fraud_alert`, plus abandonment templates. The `order` type renders a branded HTML email with order summary, delivery date, totals breakdown, and lookup link. Email originates from the `orders@haulogix.com` domain (per `mem://tech/configuration-policy/email-domain-authority`).

### 10.2 Invoice download

The success page exposes a "Download invoice" button that calls `generate-invoice` edge function with `{ order_id, lookup_token }`. The function validates the token, queries the order, and renders a monochrome PDF with absolute-positioned status indicators (per `mem://style/pdf-invoice-design/layout-engine`). Returns the PDF as a binary response; UI downloads via blob URL.

### 10.3 Visitor-session updates

Every step of the CRE flow updates the `visitor_sessions` row via `leads-auth` action `update_session`:
- Address entered → `stage: "address_entered"`, `delivery_address`.
- Estimate computed → `stage: "started_checkout"`, `calculated_price`, `nearest_pit_id`, `nearest_pit_name`, `serviceable`.
- Stripe link clicked → `stripe_link_clicked: true`, `stripe_link_clicked_at`.
- Order placed → `stage: "completed_order"`, `order_id`, `order_number`.

This is what powers the LMT Live Visitors dashboard and the abandonment-recovery email sequences.

### 10.4 Notifications

Two notification paths converge on the bell icon:
1. **`notify_new_order` trigger** — fires on every `orders` INSERT regardless of payment path.
2. **Webhook-driven** — `payment_completed` and `fraud_flagged` notifications inserted by `stripe-webhook` after status transitions.

### 10.5 Lead conversion

If `leadReference` (from `?lead=` URL param) was present at submit time, the UI fires:
```js
supabase.functions.invoke("leads-auth", {
  body: { password: "system", action: "mark_converted", lead_number, order_number }
});
```
This flips the matching `delivery_leads` row to `stage = "converted"` and stamps `pre_order_id`. Used to attribute proposal-recovery and abandonment-flow conversions.

### 10.6 Abandonment recovery (orthogonal but triggered by CRE state)

The `abandonment-emails` cron (hourly, `0 * * * *`) reads `visitor_sessions` looking for users who reached `stripe_link_clicked` or `started_checkout` but never `completed_order`. Sends 1h, 24h, 48h, 72h follow-ups depending on the highest stage achieved. See `mem://features/marketing/abandonment-sequence`.

---

## 11. Cart persistence & cross-tab Stripe-return mechanics

### 11.1 `localStorage.rs_cart` (24h TTL)

`src/lib/cart.ts` (36 lines):
```ts
type CartState = {
  address, distance, price, quantity, pitId, pitName,
  operatingDays, satSurcharge, sameDayCutoff, savedAt
};
saveCart() / loadCart() / clearCart()
```

24-hour expiry on read. Used by the landing page `<DeliveryEstimator>` to remember the last estimate so users returning later see their cart pre-populated. `clearCart()` is called on successful `create_order`.

### 11.2 `sessionStorage.pending_order_snapshot`

Set just before redirecting to `checkout.stripe.com` (both desktop and mobile). Contains everything needed to re-hydrate the form on cancel:
```ts
sessionStorage.setItem("pending_order_snapshot", JSON.stringify({
  address, form, quantity, selectedDeliveryDate, paymentMethod: "stripe-link",
  pendingOrderId, orderNumber, lookupToken,
  result, totalPrice, totalWithProcessingFee, processingFee, taxAmount,
  subtotal, saturdaySurchargeTotal, sundaySurchargeTotal, taxInfo,
}));
```

Cleared after successful re-hydration on cancel. Survives the cross-origin redirect because sessionStorage is per-origin AND per-tab — but the same tab returning to the same origin retains it.

### 11.3 `localStorage.stripe_payment_signal` (cross-tab)

When Stripe is opened in a popup (iframe context, `return_mode=popup`), the popup writes:
```ts
localStorage.setItem("stripe_payment_signal", JSON.stringify({
  payment: "success",
  order_number, order_id, session_id,
  ts: Date.now()
}));
```

The originating tab listens via two parallel mechanisms:
- **`window.addEventListener("storage", handler)`** — fires immediately in most browsers. Brittle in some iframe contexts.
- **1-second polling loop on `localStorage.stripe_payment_signal`** — fallback. Reliable in Lovable preview iframes and embedded contexts.

Both paths converge on `verifyStripePayment(orderId, lookupToken)` → `setStep("success")`. The polling loop also clears the signal immediately on read to break re-entry.

### 11.4 Purchase-tracking idempotency

Fires once per `order_number` via:
```ts
const guardKey = `purchase_tracked_${orderNumber}`;
if (sessionStorage.getItem(guardKey)) return;
// ... fire dataLayer.push({ event: "purchase", ... }) ...
sessionStorage.setItem(guardKey, "1");
```

Guards both desktop and mobile against double-firing if the user navigates away and back, or if both the popup-storage-event AND the polling-fallback fire.

---

## 12. Operator-side CRE (LMT manual order entry)

**Audit finding:** there is no manual create-order form in `/leads` today. Searches across `src/pages/Admin.tsx` and `src/components/leads/**` reveal no `supabase.rpc("create_order", ...)` invocations from the operator path. Operators can:
- View, update, cancel, and reschedule orders (via leads-auth actions).
- Capture pending payments via Stripe.
- Generate proposals (which turn into customer-facing `?lead=` Order links).

But **all order CREATION goes through the customer-facing `/order` route**. If an operator needs to create an order on behalf of a customer, they currently send a proposal email containing a pre-populated `/order?address=...&lead=...` link.

This is intentional — it ensures every order goes through the same `create_order` RPC, with the same RLS gating, the same tax priority chain, and the same notification trigger. Adding a manual operator path would require a new edge function action (e.g. `leads-auth` `create_order_admin`) bypassing the public RPC, with separate validation. Not currently in scope.

---

## 13. Known gaps, debt & v1.1 follow-ups

| Item | Severity | Source |
|---|---|---|
| `(supabase as any)` casts to reach tables missing from generated types | Low (debt) | CLAUDE.md "Gotchas" |
| `zip_tax_rates` queries need `.limit(10000)` (default truncates) | Medium (latent) | CLAUDE.md "Operational rules" |
| Parish tax rates hardcoded in `src/lib/format.ts` | Low (config debt) | CLAUDE.md "Pending tasks" |
| Phone `1-855-468-9297` hardcoded in multiple components | Low (debt) | CLAUDE.md "Gotchas" |
| Google Maps script loaded independently in `DeliveryEstimator.tsx` AND `Order.tsx` | Low (debt) | CLAUDE.md "Gotchas" |
| `EmailInput` missing `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` — `formatEmail` wrapper is the only defense | Low (defense-in-depth) | This audit |
| No `aria-invalid`, `aria-describedby`, `aria-live` on errored fields | Medium (a11y) | This audit |
| No auto-focus on first error field after failed submit | Low (UX polish) | This audit |
| `create-payment-intent` edge function not wired from customer flow — possibly vestigial | Low (housekeeping) | This audit |
| Mobile email validation reads from DOM via `document.querySelector` to dodge an iOS state-lag bug | Documented (intentional workaround) | OrderMobile.tsx:885–890, 928–932 |
| Test-mode `create_order` returns synthetic IDs but UI proceeds through the full success flow including email — confirm `send-email` short-circuits in test mode (out of scope of this audit) | Verify | RPC source |

---

## 14. Version Gate Protocol

Every Lovable session that touches the CRE flow at riversand.net must, before its first edit:

1. Confirm it has read this file at version **1.0 (2026-04-24)** or newer.
2. If a newer `RIVERSAND_CRE_FLOW_vX.Y_YYYY-MM-DD.md` exists in the repo, read it instead and report the version.
3. State which layer is being touched: customer UI (Order.tsx / OrderMobile.tsx), pricing engine (lib/pits.ts), tax (RPC), Stripe (create-checkout-link / stripe-webhook / capture-payments), or post-create (send-email / generate-invoice / abandonment-emails).
4. Apply the form-entry standards (Section 9) to any UI form changes.
5. Flag any change to the `create_order` RPC, the orders table schema, or the stripe-webhook resolution chain as **HIGH RISK** — these affect every order and have no undo.

---

_End of RIVERSAND_CRE_FLOW v1.0._
