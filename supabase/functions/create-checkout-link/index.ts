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
    const { amount, description, customer_name, customer_email, order_id, order_number, origin_url, return_mode } = await req.json();

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

    const { data: modeData } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "stripe_mode")
      .maybeSingle();

    const stripeMode = modeData?.value || "live";
    const stripeKey = stripeMode === "test"
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");

    console.log(`[create-checkout-link] stripe_mode: ${stripeMode}, key starts with: ${stripeKey?.slice(0, 8)}`);

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

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description || "River Sand Delivery — Processing fees non-refundable. Cancel 2+ hrs before delivery for full refund.",
            },
            unit_amount: amount, // in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: customer_email || undefined,
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
