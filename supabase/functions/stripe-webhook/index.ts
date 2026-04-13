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
    "payment_intent.amount_capturable_updated",
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
      
      // Check if this is a manual capture (auth-only) session
      let isManualCapture = false;
      if (stripePaymentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(stripePaymentId);
          if (pi.capture_method === "manual" && pi.status === "requires_capture") {
            isManualCapture = true;
            paymentStatus = "authorized";
            console.log("[stripe-webhook] Manual capture detected — setting status to authorized");
          }
        } catch (piErr) {
          console.error("[stripe-webhook] Failed to retrieve payment intent:", piErr);
        }
      }
      
      if (!isManualCapture) {
        paymentStatus = session.payment_status === "paid" ? "paid" : "pending";
      }

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

      // Extract and store billing address from Stripe session
      const customerDetails = (session as any).customer_details;
      const billingAddress = customerDetails?.address;
      const billingName = customerDetails?.name;

      if (orderId && billingAddress) {
        const billingAddressStr = [
          billingAddress.line1,
          billingAddress.line2,
          billingAddress.city,
          billingAddress.state,
          billingAddress.postal_code,
        ].filter(Boolean).join(", ");

        // Get order's delivery address for comparison
        const { data: orderForBilling } = await supabase
          .from("orders")
          .select("delivery_address, fraud_signals")
          .eq("id", orderId)
          .single();

        // Extract ZIP from delivery address
        const deliveryZipMatch = orderForBilling?.delivery_address?.match(/\b(\d{5})\b/);
        const deliveryZip = deliveryZipMatch?.[1] || null;
        const billingMatchesDelivery = billingAddress.postal_code && deliveryZip
          ? billingAddress.postal_code === deliveryZip
          : null;

        const billingUpdate: Record<string, any> = {
          billing_address: billingAddressStr,
          billing_name: billingName || null,
          billing_zip: billingAddress.postal_code || null,
          billing_country: billingAddress.country || null,
          billing_matches_delivery: billingMatchesDelivery,
        };

        // Flag for review if mismatch
        if (billingMatchesDelivery === false) {
          billingUpdate.review_status = "pending_review";
          const existingSignals = orderForBilling?.fraud_signals || [];
          const signals = Array.isArray(existingSignals) ? existingSignals : [];
          billingUpdate.fraud_signals = [...signals, "billing_delivery_mismatch"];
          console.log("[stripe-webhook] Billing/delivery ZIP mismatch — flagging for review. billing:", billingAddress.postal_code, "delivery:", deliveryZip);

          // Send admin alert (fire-and-forget)
          const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
          fetch(emailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              type: "fraud_alert",
              data: {
                order_id: orderId,
                order_number: session.metadata?.order_number || "Unknown",
                customer_name: billingName || session.metadata?.customer_name || "Unknown",
                billing_zip: billingAddress.postal_code,
                delivery_zip: deliveryZip,
                billing_address: billingAddressStr,
                delivery_address: orderForBilling?.delivery_address || "Unknown",
                alert_type: "billing_delivery_mismatch",
              },
            }),
          }).catch((err) => console.error("[stripe-webhook] Fraud alert email error:", err));

          // Billing mismatch notification
          try {
            await supabase.from("notifications").insert({
              type: "fraud_flagged",
              title: "⚠️ Billing Mismatch",
              message: `Order ${session.metadata?.order_number || "Unknown"} — billing ZIP does not match delivery address`,
              entity_type: "order",
              entity_id: orderId,
            });
          } catch (notifErr) { console.error("[stripe-webhook] Notification insert error:", notifErr); }
        }

        await supabase.from("orders").update(billingUpdate).eq("id", orderId);
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
      const updateData: Record<string, any> = {
        payment_status: paymentStatus,
      };
      if (stripePaymentId) {
        updateData.stripe_payment_id = stripePaymentId;
      }

      // Retrieve card details from Stripe for paid orders
      if (paymentStatus === "paid" && stripePaymentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(stripePaymentId, {
            expand: ["payment_method"],
          });
          const card = (pi.payment_method as any)?.card;
          if (card?.last4) {
            updateData.card_last4 = card.last4;
            updateData.card_brand = card.brand || null;
            console.log(`[stripe-webhook] Card details: ${card.brand} ****${card.last4}`);
          }
        } catch (e) {
          console.warn("[stripe-webhook] Could not retrieve card details:", e);
        }
      }

      if (paymentStatus === "paid" || paymentStatus === "authorized") {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (currentOrder?.status === "pending") {
          updateData.status = "confirmed";
        }
        if (paymentStatus === "authorized") {
          updateData.capture_status = "pending";
        }

        // Update order FIRST, then send email
        console.log("[stripe-webhook] Updating order:", orderId, "with:", JSON.stringify(updateData));
        const { error: updateError, data: updateResult } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", orderId)
          .select("id, order_number, payment_status, status");

        console.log("[stripe-webhook] Order update result:", JSON.stringify(updateResult), "error:", JSON.stringify(updateError));

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
                data: { ...currentOrder, ...updateData },
              }),
            });
            console.log("[stripe-webhook] Email response status:", emailResponse.status);
            const emailBody = await emailResponse.text();
            console.log("[stripe-webhook] Email response body:", emailBody);
          } catch (emailErr) {
            console.error("[stripe-webhook] Failed to send order email:", emailErr);
          }

          // Payment completed notification
          try {
            await supabase.from("notifications").insert({
              type: "payment_completed",
              title: "Payment Received",
              message: `Order ${currentOrder.order_number} paid — ${currentOrder.customer_name}`,
              entity_type: "order",
              entity_id: orderId,
            });
          } catch (notifErr) { console.error("[stripe-webhook] Notification insert error:", notifErr); }
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

    // Log payment attempt for fraud tracking
    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.succeeded") {
      try {
        const pi = event.data.object as Stripe.PaymentIntent;
        const attemptStatus = event.type === "payment_intent.succeeded" ? "success" : "failed";
        const leadsAuthUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/leads-auth`;
        await fetch(leadsAuthUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            action: "log_payment_attempt",
            ip_address: pi.metadata?.ip_address || null,
            session_id: pi.metadata?.session_id || null,
            email: pi.metadata?.customer_email || pi.receipt_email || null,
            phone: pi.metadata?.customer_phone || null,
            amount: (pi.amount || 0) / 100,
            status: attemptStatus,
          }),
        });
        console.log(`[stripe-webhook] Logged payment attempt: ${attemptStatus}`);
      } catch (logErr) {
        console.error("[stripe-webhook] Failed to log payment attempt:", logErr);
      }
    }

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
