

## Prompt 3 — Cash/Check Order Management

### Overview
Add 3 new columns to `orders` table, two new actions to `leads-auth` edge function, a new email template in `send-email`, and a full "Cash Orders" dashboard page in `Leads.tsx`.

---

### Step 1 — Database Migration

Add columns to `orders`:
- `cash_collected` boolean DEFAULT false
- `cash_collected_at` timestamptz
- `cash_collected_by` text

Also add `discount_amount` if not already present (it exists per schema).

---

### Step 2 — Edge Function: `leads-auth/index.ts`

Add two new actions after existing ones:

**`list_cash_orders`**: Query `orders` where `payment_method IN ('cash', 'check', 'cod', 'COD')` AND `payment_status != 'cancelled'`, ordered by `delivery_date ASC, created_at DESC`. Return all fields including new cash columns.

**`mark_cash_paid`**: Accept `{ order_id, collected_by?, send_email? }`. Update the order: `cash_collected = true`, `cash_collected_at = now()`, `cash_collected_by`, `payment_status = 'collected'`. If `send_email` is true and customer has email, invoke `send-email` function with type `cash_payment_confirmed`. Return updated order.

Also destructure `order_id`, `collected_by`, `send_email` from request body.

---

### Step 3 — Edge Function: `send-email/index.ts`

Add new email type handler `cash_payment_confirmed`:
- Subject: "Payment Confirmed — Order #[order_number]"
- Body: greeting, confirmation box with gold border showing order details (order number, payment method, amount, address, delivery date, payment recorded timestamp), closing message, Silas Caldeira signature, branded footer.
- Send to customer email.

---

### Step 4 — Leads Dashboard: `src/pages/Leads.tsx`

**NavPage type**: Add `"cash_orders"` to the union type.

**NAV_ITEMS**: Insert `{ id: "cash_orders", label: "Cash Orders", icon: DollarSign }` in OPERATIONS section between Overview and ZIP Intelligence.

**State**: Add `cashOrders` array state, `cashFilter` tab state (`all | pending | overdue | collected`), `markingPaid` loading state, `cashOrderToMark` for confirmation dialog.

**Data fetching**: Add `fetchCashOrders()` function calling `list_cash_orders` action. Call it when `activePage === "cash_orders"`.

**Cash Orders page content** (rendered when `activePage === "cash_orders"`):

1. **Header**: "CASH ORDERS" title with dynamic count. Right side shows "Expected today: $X across Y orders" in gold.

2. **Overdue alert banner**: Amber banner if any orders have `delivery_date < today AND !cash_collected`. Dismissible per session via sessionStorage.

3. **Summary metrics bar**: 4 cards — Pending Today, Overdue (red badge if > 0), Collected Today, Total Outstanding.

4. **Filter tabs**: All | Pending | Overdue | Collected.

5. **Table**: Order #, Date, Customer (name + phone), Address (truncated), Amount (gold bold), Delivery Date (red if past+unpaid, gold if today), Method (Cash/Check pill), Status (amber/green/red pill), Action (Mark as Paid button or "Paid [date]" text).

6. **Mark as Paid dialog**: Uses existing Dialog component. Shows order details, optional "Collected by" input, checkbox for sending confirmation email (checked by default). On confirm, calls `mark_cash_paid`, refreshes list, shows toast.

7. **Daily Cash Summary**: Below table, "Today's Cash Schedule" listing today's orders. Print button opens `window.print()` with a print-friendly CSS media query for the section.

---

### Files Changed

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | Add `cash_collected`, `cash_collected_at`, `cash_collected_by` columns to orders |
| `supabase/functions/leads-auth/index.ts` | Add `list_cash_orders` and `mark_cash_paid` actions |
| `supabase/functions/send-email/index.ts` | Add `cash_payment_confirmed` email type |
| `src/pages/Leads.tsx` | Add "Cash Orders" nav item, page with metrics/table/dialog/print, ~300 lines of new content |

### Technical Notes
- `mark_cash_paid` calls `send-email` via Supabase function invoke from inside the edge function using service role
- Overdue = `delivery_date < today AND cash_collected = false`
- Print uses `@media print` CSS to hide sidebar/nav and show only the daily schedule
- No new imports needed beyond what Leads.tsx already has (DollarSign icon already imported)
- Cash/Check distinction shown via `payment_method` value display

