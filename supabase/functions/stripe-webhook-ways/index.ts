import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SOURCE_PLATFORM = "WM";

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

  const { data: modeData } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "stripe_mode")
    .maybeSingle();
  const stripeMode = modeData?.value || "live";

  const stripeKey = stripeMode === "test"
    ? Deno.env.get("WM_STRIPE_TEST_SECRET_KEY")
    : Deno.env.get("WM_STRIPE_LIVE_SECRET_KEY");
  const webhookSecret = stripeMode === "test"
    ? Deno.env.get("WM_STRIPE_TEST_WEBHOOK_SECRET")
    : Deno.env.get("WM_STRIPE_LIVE_WEBHOOK_SECRET");

  console.log(`[stripe-webhook-ways] Using WM Stripe ${stripeMode} mode`);

  if (!webhookSecret || !stripeKey) {
    console.error(`[stripe-webhook-ways] Missing WM secret(s) for ${stripeMode} mode`);
    return new Response("Missing webhook configuration", { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("[stripe-webhook-ways] Signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[stripe-webhook-ways] Event: ${event.type} (${event.id})`);

  const { data: existingEvent } = await supabase
    .from("payment_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`[stripe-webhook-ways] Duplicate event ${event.id}, skipping`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const handledTypes = [
    "checkout.session.completed",
    "payment_intent.payment_failed",
    "charge.refunded",
  ];

  if (!handledTypes.includes(event.type)) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let orderId: string | null = null;
    let stripePaymentId: string | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      stripePaymentId = (session.payment_intent as string) || null;

      orderId = session.metadata?.order_id || null;
      if (!orderId && session.id) {
        const { data: byCs } = await supabase
          .from("orders")
          .select("id, source_platform")
          .eq("stripe_checkout_session_id", session.id)
          .maybeSingle();
        if (byCs?.source_platform === SOURCE_PLATFORM) {
          orderId = byCs.id;
        } else if (byCs && byCs.source_platform !== SOURCE_PLATFORM) {
          console.warn(`[stripe-webhook-ways] Session ${session.id} matches non-WM order; ignoring`);
          orderId = null;
        }
      }

      if (!orderId) {
        console.error(`[stripe-webhook-ways] Could not resolve WM order for session ${session.id}`);
      } else {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("id, source_platform, order_number, customer_name, customer_email, customer_phone, payment_status, status")
          .eq("id", orderId)
          .maybeSingle();

        if (!orderRow || orderRow.source_platform !== SOURCE_PLATFORM) {
          console.warn(`[stripe-webhook-ways] Order ${orderId} is not WM (source=${orderRow?.source_platform}); skipping`);
        } else {
          const updateData: Record<string, any> = {
            payment_status: session.payment_status === "paid" ? "paid" : "pending",
            stripe_payment_id: stripePaymentId,
          };
          if (orderRow.status === "pending" && updateData.payment_status === "paid") {
            updateData.status = "confirmed";
          }

          if (stripePaymentId) {
            try {
              const pi = await stripe.paymentIntents.retrieve(stripePaymentId, {
                expand: ["payment_method"],
              });
              const card = (pi.payment_method as any)?.card;
              if (card?.last4) {
                updateData.card_last4 = card.last4;
                updateData.card_brand = card.brand || null;
              }
            } catch (e) {
              console.warn("[stripe-webhook-ways] Could not retrieve card details:", e);
            }
          }

          const { error: updErr } = await supabase
            .from("orders")
            .update(updateData)
            .eq("id", orderId);

          if (updErr) {
            console.error("[stripe-webhook-ways] Order update failed:", updErr);
          } else if (updateData.payment_status === "paid") {
            try {
              await supabase.from("notifications").insert({
                type: "payment_completed",
                title: "WAYS Payment Received",
                message: `Order ${orderRow.order_number} paid — ${orderRow.customer_name}`,
                entity_type: "order",
                entity_id: orderId,
              });
            } catch (e) {
              console.warn("[stripe-webhook-ways] notification insert failed:", e);
            }
            // TODO (later block): trigger WAYS-branded confirmation email.
          }
        }
      }
    }

    else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      stripePaymentId = pi.id;

      const customerEmail = pi.metadata?.customer_email || pi.receipt_email || null;
      const customerPhone = pi.metadata?.customer_phone || null;
      const failureReason =
        pi.last_payment_error?.message ||
        pi.last_payment_error?.code ||
        "unknown";

      if (pi.metadata?.order_id) {
        orderId = pi.metadata.order_id;
      }

      let isWms = pi.metadata?.source_platform === SOURCE_PLATFORM;
      if (orderId) {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("source_platform")
          .eq("id", orderId)
          .maybeSingle();
        isWms = orderRow?.source_platform === SOURCE_PLATFORM;
      }

      if (!isWms) {
        console.log(`[stripe-webhook-ways] payment_failed event not for WM; skipping`);
      } else {
        const { data: pf, error: pfErr } = await supabase
          .from("payment_failures")
          .insert({
            customer_email: customerEmail,
            customer_phone: customerPhone,
            stripe_payment_intent_id: pi.id,
            failure_reason: failureReason,
          })
          .select("id")
          .single();

        if (pfErr) {
          console.error("[stripe-webhook-ways] payment_failures insert failed:", pfErr);
        } else if (orderId) {
          await supabase
            .from("orders")
            .update({
              payment_status: "failed",
              payment_failure_id: pf.id,
            })
            .eq("id", orderId);
        }

        try {
          const failedEmailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payment-failed-email`;
          await fetch(failedEmailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              customer_email: customerEmail,
              customer_phone: customerPhone,
              order_number: pi.metadata?.order_number || null,
              failure_reason: failureReason,
              retry_url: "https://waysmaterials.com/checkout",
            }),
          });
        } catch (e) {
          console.error("[stripe-webhook-ways] send-payment-failed-email error:", e);
        }
      }
    }

    else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      stripePaymentId = (charge.payment_intent as string) || null;

      if (stripePaymentId) {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("id, source_platform")
          .eq("stripe_payment_id", stripePaymentId)
          .maybeSingle();

        if (orderRow?.source_platform === SOURCE_PLATFORM) {
          orderId = orderRow.id;
          await supabase
            .from("orders")
            .update({ payment_status: "refunded" })
            .eq("id", orderId);
        } else {
          console.log(`[stripe-webhook-ways] Refund not for WM order; skipping`);
        }
      }
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
  } catch (err: any) {
    console.error("[stripe-webhook-ways] Handler error:", err);
    return new Response(`Handler error: ${err.message}`, { status: 500 });
  }
});
