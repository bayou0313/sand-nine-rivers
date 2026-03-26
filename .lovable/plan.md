

## Fix: Stripe Payments Not Updating Order Status

### Problem
Stripe payments succeed (10+ `succeeded` payment intents in Stripe), but the `stripe-webhook` edge function has never been invoked. This means:
- No entries in `payment_events` table
- All orders remain `payment_status: "pending"` and `stripe_payment_id: null`
- The frontend polls the DB waiting for webhook to update status, but it never does

**Root cause**: The Stripe webhook endpoint URL is not configured in Stripe's dashboard to point to your edge function.

### Two-Part Fix

#### Part 1: Configure Stripe Webhook (Manual Step)
You need to add a webhook endpoint in Stripe pointing to:
```
https://lclbexhytmpfxzcztzva.supabase.co/functions/v1/stripe-webhook
```

Events to listen for:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

The `STRIPE_WEBHOOK_SECRET` secret is already configured — it just needs to match the signing secret from the webhook you create in Stripe.

#### Part 2: Fix Existing Orders (Data Patch)
After confirming the webhook works, I will update the existing Stripe-paid orders to `payment_status: "paid"` and `status: "confirmed"` by matching payment intent amounts and metadata from Stripe's checkout sessions.

### Files Changed
No code changes needed — the webhook function and frontend polling logic are already correctly implemented. The issue is purely configuration (Stripe webhook URL not set).

### Steps
1. You configure the webhook URL in Stripe (I'll provide exact instructions)
2. I update the `STRIPE_WEBHOOK_SECRET` if the signing secret changed
3. I patch existing paid orders in the database
4. Test with a new order to verify the full flow works

