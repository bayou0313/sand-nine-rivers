import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      amount,
      description,
      customer_name,
      customer_email,
      order_id,
      order_number,
      origin_url,
      return_mode,
    } = body;

    if (!amount || !order_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: amount, order_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Supabase client (service role) ──────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Stripe mode ──────────────────────────────────────────────────────────
    const { data: modeData } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "stripe_mode")
      .maybeSingle();
    const stripeMode = modeData?.value || "live";
    const stripeKey = stripeMode === "test"
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")!
      : Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // ── Fetch order record for context ───────────────────────────────────────
    const { data: orderRecord } = await supabase
      .from("orders")
      .select("customer_phone, customer_email, same_day_requested, delivery_date")
      .eq("id", order_id)
      .maybeSingle();

    const phone = orderRecord?.customer_phone ?? null;
    const todayDate = new Date().toISOString().slice(0, 10);
    const deliveryDate = orderRecord?.delivery_date ?? null;

    // Same-day: delivery_date is today OR same_day_requested flag is set
    const isSameDay =
      orderRecord?.same_day_requested === true ||
      (deliveryDate !== null && deliveryDate === todayDate);

    // ── Customer tier lookup ─────────────────────────────────────────────────
    let customerTier = 1;
    let threeDSecure: "any" | "automatic" = "any";
    let existingStripeCustomerId: string | undefined;

    if (phone) {
      const { data: prevOrders } = await supabase
        .from("orders")
        .select("id, stripe_customer_id")
        .eq("customer_phone", phone)
        .in("payment_status", ["paid", "captured"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false });

      const paidCount = prevOrders?.length ?? 0;
      existingStripeCustomerId = prevOrders?.find(
        (o: any) => o.stripe_customer_id
      )?.stripe_customer_id;

      if (paidCount >= 3) {
        customerTier = 3;        // VIP — frictionless where possible
        threeDSecure = "automatic";
      } else if (paidCount >= 1) {
        customerTier = 2;        // Returning — let Stripe decide
        threeDSecure = "automatic";
      }
      // paidCount === 0 → Tier 1, "any" (always challenge new customers)
    }

    // ── Capture method ───────────────────────────────────────────────────────
    // Same-day orders: capture immediately — nightly cron only runs for delivery_date = tomorrow
    // Future orders: manual capture — nightly cron captures the night before delivery
    const captureMethod: "automatic" | "manual" = isSameDay ? "automatic" : "manual";

    console.log(
      `[create-checkout-link] order=${order_number} tier=${customerTier} ` +
      `3ds=${threeDSecure} capture=${captureMethod} same_day=${isSameDay} ` +
      `returning_customer=${!!existingStripeCustomerId}`
    );

    // ── Success / cancel URLs ────────────────────────────────────────────────
    const baseOrigin = origin_url || "https://riversand.net";
    const successUrl =
      return_mode === "popup"
        ? `${baseOrigin}/order?payment=success&order_number=${order_number}&order_id=${order_id}&session_id={CHECKOUT_SESSION_ID}&return_mode=popup`
        : `${baseOrigin}/order?payment=success&order_number=${order_number}&order_id=${order_id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseOrigin}/order?payment=cancelled&order_number=${order_number}`;

    // ── Build Stripe checkout session ────────────────────────────────────────
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description || `River Sand Delivery — ${order_number}`,
            },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_creation: "always",
      payment_intent_data: {
        capture_method: captureMethod,
        setup_future_usage: "off_session",
        metadata: {
          order_id: order_id,
          order_number: order_number ?? "",
          customer_name: customer_name ?? "",
          customer_tier: String(customerTier),
          is_same_day: String(isSameDay),
        },
      },
      payment_method_options: {
        card: {
          request_three_d_secure: threeDSecure,
        },
      },
      metadata: {
        order_id: order_id,
        order_number: order_number ?? "",
      },
    };

    // Attach existing Stripe customer for Tier 2/3 (pre-fills their saved card)
    if (existingStripeCustomerId && customerTier >= 2) {
      sessionParams.customer = existingStripeCustomerId;
    } else {
      const email = customer_email || orderRecord?.customer_email;
      if (email) {
        sessionParams.customer_email = email;
      }
    }

    // ── Create session ───────────────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store resolved tier on the order (fire-and-forget)
    supabase
      .from("orders")
      .update({ customer_tier: customerTier })
      .eq("id", order_id)
      .then(({ error }) => {
        if (error) console.warn("[create-checkout-link] Failed to store tier:", error.message);
      });

    console.log(
      `[create-checkout-link] session created: ${session.id} for order ${order_number}`
    );

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-checkout-link] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create checkout link" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
