import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  // Determine stripe mode from global_settings
  const { data: modeData } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "stripe_mode")
    .maybeSingle();

  const stripeMode = modeData?.value || "live";

  const stripeKey = stripeMode === "test"
    ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
    : Deno.env.get("STRIPE_SECRET_KEY");

  const webhookSecret = stripeMode === "test"
    ? Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET")
    : Deno.env.get("STRIPE_WEBHOOK_SECRET");

  console.log(`[stripe-webhook] Using Stripe ${stripeMode} mode`);

  if (!webhookSecret) {
    console.error(`[stripe-webhook] No webhook secret found for ${stripeMode} mode`);
    return new Response("Missing webhook secret", { status: 400 });
  }

  const stripe = new Stripe(stripeKey || "", {
    apiVersion: "2025-08-27.basil",
  });

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[stripe-webhook] Event received: ${event.type} (${event.id})`);

  // Idempotency check
  const { data: existingEvent } = await supabase
    .from("payment_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`[stripe-webhook] Duplicate event ${event.id}, skipping`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const handledTypes = [
    "checkout.session.completed",
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
    let orderId: string | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      orderId = session.metadata?.order_id || null;
      stripePaymentId = (session.payment_intent as string) || null;
      paymentStatus = session.payment_status === "paid" ? "paid" : "pending";

      console.log("[stripe-webhook] checkout.session.completed — order_id from metadata:", orderId);
      console.log("[stripe-webhook] client_reference_id:", session.client_reference_id);
      console.log("[stripe-webhook] payment_intent:", stripePaymentId);
      console.log("[stripe-webhook] payment_status:", paymentStatus);

      // Fallback 1: client_reference_id
      if (!orderId && session.client_reference_id) {
        orderId = session.client_reference_id;
        console.log("[stripe-webhook] Using client_reference_id as order_id:", orderId);
      }

      // Fallback 2: order_number from metadata
      if (!orderId && session.metadata?.order_number) {
        console.log("[stripe-webhook] No order_id, trying order_number:", session.metadata.order_number);
        const { data: matchByNumber } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", session.metadata.order_number)
          .maybeSingle();
        if (matchByNumber) {
          orderId = matchByNumber.id;
          console.log("[stripe-webhook] Matched order by order_number:", orderId);
        }
      }

      const stripeCustomerId = (session.customer as string) || null;
      if (orderId && stripeCustomerId) {
        await supabase
          .from("orders")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", orderId);
      }

      // Fallback 3: match by stripe_payment_id
      if (!orderId && stripePaymentId) {
        const { data: matchedOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_payment_id", stripePaymentId)
          .maybeSingle();
        if (matchedOrder) {
          orderId = matchedOrder.id;
          console.log("[stripe-webhook] Matched order by stripe_payment_id:", orderId);
          if (stripeCustomerId) {
            await supabase
              .from("orders")
              .update({ stripe_customer_id: stripeCustomerId })
              .eq("id", matchedOrder.id);
          }
        }
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      stripePaymentId = (charge.payment_intent as string) || null;
      paymentStatus = "refunded";
    } else {
      // payment_intent.succeeded / payment_failed / canceled
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      stripePaymentId = paymentIntent.id;

      // Try to resolve order from payment_intent metadata first
      if (paymentIntent.metadata?.order_id) {
        orderId = paymentIntent.metadata.order_id;
        console.log("[stripe-webhook] Resolved order_id from payment_intent metadata:", orderId);
      } else if (paymentIntent.metadata?.order_number) {
        const { data: matchByNumber } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", paymentIntent.metadata.order_number)
          .maybeSingle();
        if (matchByNumber) {
          orderId = matchByNumber.id;
          console.log("[stripe-webhook] Resolved order by payment_intent metadata order_number:", orderId);
        }
      }

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

    // Final fallback: match by stripe_payment_id in orders table
    if (!orderId && stripePaymentId) {
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_payment_id", stripePaymentId)
        .maybeSingle();
      orderId = order?.id || null;
      if (orderId) {
        console.log("[stripe-webhook] Final fallback matched order by stripe_payment_id:", orderId);
      }
    }

    console.log("[stripe-webhook] Resolved order:", orderId, "paymentStatus:", paymentStatus, "stripePaymentId:", stripePaymentId);

    if (orderId && paymentStatus) {
      const updateData: Record<string, string> = {
        payment_status: paymentStatus,
      };
      if (stripePaymentId) {
        updateData.stripe_payment_id = stripePaymentId;
      }
      if (paymentStatus === "paid") {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (currentOrder?.status === "pending") {
          updateData.status = "confirmed";
        }

        // Update order FIRST, then send email
        console.log("[stripe-webhook] Updating order:", orderId, "with:", updateData);
        const { error: updateError, data: updateResult } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .select("id, order_number, payment_status, status");

        console.log("[stripe-webhook] Order update result:", updateResult, "error:", updateError);

        if (updateError) {
          console.error("[stripe-webhook] Failed to update order:", updateError);
          await supabase.from("payment_events").insert({
            order_id: orderId,
            stripe_payment_id: stripePaymentId,
            event_type: event.type,
            event_id: event.id,
          });
          return new Response("Database update failed", { status: 500 });
        }

        // Now send email after successful DB update
        if (currentOrder) {
          try {
            console.log("[stripe-webhook] Sending order email for order:", orderId, "order_number:", currentOrder.order_number);
            const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
            const emailResponse = await fetch(emailUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                type: "order",
                data: { ...currentOrder, payment_status: "paid" },
              }),
            });
            console.log("[stripe-webhook] Email response status:", emailResponse.status);
            const emailBody = await emailResponse.text();
            console.log("[stripe-webhook] Email response body:", emailBody);
          } catch (emailErr) {
            console.error("[stripe-webhook] Failed to send order email:", emailErr);
          }
        }
      } else {
        // Non-paid status updates (failed, canceled, refunded)
        console.log("[stripe-webhook] Updating order:", orderId, "with:", updateData);
        const { error: updateError, data: updateResult } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .select("id, order_number, payment_status, status");

        console.log("[stripe-webhook] Order update result:", updateResult, "error:", updateError);

        if (updateError) {
          console.error("[stripe-webhook] Failed to update order:", updateError);
          await supabase.from("payment_events").insert({
            order_id: orderId,
            stripe_payment_id: stripePaymentId,
            event_type: event.type,
            event_id: event.id,
          });
          return new Response("Database update failed", { status: 500 });
        }
      }
    } else if (!orderId) {
      console.error("[stripe-webhook] Could not resolve order for event:", event.type, "stripePaymentId:", stripePaymentId);
    }

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
    console.error("[stripe-webhook] Processing error:", error);
    // Return 500 so Stripe retries — do NOT swallow real failures
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
