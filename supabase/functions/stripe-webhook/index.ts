import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Idempotency check
  const { data: existingEvent } = await supabase
    .from("payment_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEvent) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const handledTypes = [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
    "charge.refunded",
  ];

  if (!handledTypes.includes(event.type)) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let stripePaymentId: string | null = null;
    let paymentStatus = "";

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      stripePaymentId = (charge.payment_intent as string) || null;
      paymentStatus = "refunded";
    } else {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      stripePaymentId = paymentIntent.id;
      switch (event.type) {
        case "payment_intent.succeeded":
          paymentStatus = "paid";
          break;
        case "payment_intent.payment_failed":
          paymentStatus = "failed";
          break;
        case "payment_intent.canceled":
          paymentStatus = "canceled";
          break;
      }
    }

    // Find order
    let orderId: string | null = null;
    if (stripePaymentId) {
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_payment_id", stripePaymentId)
        .maybeSingle();
      orderId = order?.id || null;

      if (orderId) {
        const updateData: Record<string, string> = { payment_status: paymentStatus };
        if (event.type === "payment_intent.succeeded") {
          // Also confirm the order
          const { data: currentOrder } = await supabase
            .from("orders")
            .select("status")
            .eq("id", orderId)
            .maybeSingle();
          if (currentOrder?.status === "pending") {
            updateData.status = "confirmed";
          }
        }
        const { error: updateError } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId);

        if (updateError) {
          console.error("Failed to update order:", updateError);
          // Log event anyway, return 500 so Stripe retries
          await supabase.from("payment_events").insert({
            order_id: orderId,
            stripe_payment_id: stripePaymentId,
            event_type: event.type,
            event_id: event.id,
          });
          return new Response("Database update failed", { status: 500 });
        }
      }
    }

    // Log event
    await supabase.from("payment_events").insert({
      order_id: orderId,
      stripe_payment_id: stripePaymentId,
      event_type: event.type,
      event_id: event.id,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
