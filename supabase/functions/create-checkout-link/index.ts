import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const safeOrigin = origin_url || "https://riversand.net";
    const encodedOrderId = encodeURIComponent(order_id || "");
    const encodedOrderNumber = encodeURIComponent(order_number || "");

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description || "River Sand Delivery",
            },
            unit_amount: amount, // in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: customer_email || undefined,
      customer_creation: "always",
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      metadata: {
        order_id: order_id || "",
        order_number: order_number || "",
        customer_name: customer_name || "",
      },
      success_url: `${safeOrigin}/order?payment=success&order_id=${encodedOrderId}&order_number=${encodedOrderNumber}&session_id={CHECKOUT_SESSION_ID}${return_mode === "popup" ? "&return_mode=popup" : ""}`,
      cancel_url: `${safeOrigin}/order?payment=canceled&order_id=${encodedOrderId}&order_number=${encodedOrderNumber}${return_mode === "popup" ? "&return_mode=popup" : ""}`,
    });

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
