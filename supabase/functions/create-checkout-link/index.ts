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
    const { amount, description, customer_name, customer_email, order_id, order_number, origin_url, return_mode, same_day_requested, delivery_date } = await req.json();

    // Validate email format before passing to Stripe
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const safeEmail = customer_email && emailRegex.test(customer_email.trim())
      ? customer_email.trim()
      : undefined;

    if (!amount || typeof amount !== "number" || amount < 50) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine stripe mode from global_settings
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: settingsRows } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["stripe_mode", "pricing_mode"]);

    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settingsMap[r.key] = r.value; });

    const stripeMode = settingsMap["stripe_mode"] || "live";
    const pricingMode = settingsMap["pricing_mode"] || "transparent";
    const stripeKey = stripeMode === "test"
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");

    console.log(`[create-checkout-link] stripe_mode: ${stripeMode}, key starts with: ${stripeKey?.slice(0, 8)}`);

    // In test mode, return mock checkout URL without creating real Stripe session
    if (stripeMode === "test") {
      console.log("[create-checkout-link] TEST MODE — returning mock URL");
      const safeOriginTest = origin_url || "https://riversand.net";
      return new Response(
        JSON.stringify({ url: `${safeOriginTest}/order?payment=test&order_id=${encodeURIComponent(order_id || "")}`, test_mode: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey || "", {
      apiVersion: "2025-08-27.basil",
    });

    const safeOrigin = origin_url || "https://riversand.net";
    const encodedOrderId = encodeURIComponent(order_id || "");
    const encodedOrderNumber = encodeURIComponent(order_number || "");

    // Payment attempt tracking
    if (order_id) {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("payment_attempts")
        .eq("id", order_id)
        .maybeSingle();
      const currentAttempts = orderRow?.payment_attempts || 0;
      if (currentAttempts >= 3) {
        return new Response(
          JSON.stringify({ error: "Maximum payment attempts reached. Please contact support." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase
        .from("orders")
        .update({ payment_attempts: currentAttempts + 1 })
        .eq("id", order_id);
    }

    // Determine capture method based on delivery timing
    const isSameDay = !!same_day_requested;
    const daysUntilDelivery = delivery_date
      ? Math.floor((new Date(delivery_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;
    const captureMethod = isSameDay || daysUntilDelivery > 6 ? "automatic" : "manual";

    console.log(`[create-checkout-link] same_day: ${isSameDay}, daysUntilDelivery: ${daysUntilDelivery}, capture_method: ${captureMethod}`);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: pricingMode === "baked"
                ? (description || "River Sand Delivery").replace(/\s*\(incl\..*?fee\)/i, "").replace(/\s*—\s*Processing fees non-refundable\.?/i, "").trim()
                : description || "River Sand Delivery — Processing fees non-refundable. Cancel 2+ hrs before delivery for full refund.",
            },
            unit_amount: amount, // in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: safeEmail,
      customer_creation: "always",
      client_reference_id: order_id || undefined,
      billing_address_collection: "required",
      payment_method_options: {
        card: {
          request_three_d_secure: "automatic",
        },
      },
      payment_intent_data: {
        setup_future_usage: "off_session",
        capture_method: captureMethod,
        metadata: {
          order_id: order_id || "",
          order_number: order_number || "",
          customer_name: customer_name || "",
        },
      },
      metadata: {
        order_id: order_id || "",
        order_number: order_number || "",
        customer_name: customer_name || "",
      },
      success_url: `${safeOrigin}/order?payment=success&order_id=${encodedOrderId}&order_number=${encodedOrderNumber}&session_id={CHECKOUT_SESSION_ID}${return_mode === "popup" ? "&return_mode=popup" : ""}`,
      cancel_url: `${safeOrigin}/order?payment=canceled&order_id=${encodedOrderId}&order_number=${encodedOrderNumber}${return_mode === "popup" ? "&return_mode=popup" : ""}`,
    });

    console.log(`[create-checkout-link] session created: ${session.id}, order_id: ${order_id}, order_number: ${order_number}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create checkout link" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
