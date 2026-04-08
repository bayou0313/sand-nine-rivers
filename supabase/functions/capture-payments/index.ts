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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceKey);

    // Determine stripe mode
    const { data: modeData } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "stripe_mode")
      .maybeSingle();

    const stripeMode = modeData?.value || "live";
    const stripeKey = stripeMode === "test"
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");

    const stripe = new Stripe(stripeKey || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Calculate tomorrow's date in Central time
    const now = new Date();
    const centralOffset = -5; // CDT; CST would be -6
    const centralNow = new Date(now.getTime() + centralOffset * 60 * 60 * 1000);
    const tomorrow = new Date(centralNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`[capture-payments] Running for delivery_date: ${tomorrowStr} (stripe mode: ${stripeMode})`);

    // Find all authorized orders scheduled for tomorrow
    const { data: orders, error: queryError } = await supabase
      .from("orders")
      .select("id, order_number, stripe_payment_id, customer_name, customer_email, customer_phone, delivery_address, delivery_date, price, status, payment_status, capture_status")
      .eq("payment_status", "authorized")
      .eq("delivery_date", tomorrowStr)
      .neq("status", "cancelled")
      .neq("capture_status", "captured");

    if (queryError) {
      throw new Error(`DB query failed: ${queryError.message}`);
    }

    console.log(`[capture-payments] Found ${orders?.length || 0} orders to capture`);

    const results = {
      captured: 0,
      failed: 0,
      captured_orders: [] as string[],
      failed_orders: [] as string[],
      errors: [] as string[],
    };

    for (const order of orders || []) {
      if (!order.stripe_payment_id) {
        results.errors.push(`${order.order_number}: no stripe_payment_id`);
        results.failed++;
        results.failed_orders.push(`${order.order_number} — ${order.customer_name} (no payment ID)`);
        continue;
      }

      try {
        // Attempt to capture the payment
        const pi = await stripe.paymentIntents.capture(order.stripe_payment_id);
        console.log(`[capture-payments] Captured ${order.order_number}: ${pi.status}`);

        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            capture_status: "captured",
            capture_attempted_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        results.captured++;
        results.captured_orders.push(`${order.order_number} — ${order.customer_name} ($${order.price})`);
      } catch (err: any) {
        console.error(`[capture-payments] Failed to capture ${order.order_number}:`, err.message);

        // Generate reschedule token
        const rescheduleToken = crypto.randomUUID();

        await supabase
          .from("orders")
          .update({
            capture_status: "failed",
            capture_attempted_at: new Date().toISOString(),
            reschedule_token: rescheduleToken,
            reschedule_token_used: false,
          })
          .eq("id", order.id);

        // Send capture failure email to customer
        if (order.customer_email) {
          const rescheduleUrl = `https://riversand.net/order?reschedule=true&token=${rescheduleToken}`;
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${anonKey}`,
              },
              body: JSON.stringify({
                type: "capture_failed",
                data: {
                  customer_name: order.customer_name,
                  customer_email: order.customer_email,
                  order_number: order.order_number,
                  delivery_address: order.delivery_address,
                  price: order.price,
                  reschedule_url: rescheduleUrl,
                },
              }),
            });
          } catch (emailErr: any) {
            console.error(`[capture-payments] Failed to send failure email for ${order.order_number}:`, emailErr.message);
          }
        }

        // Create notification for admin
        try {
          await supabase.from("notifications").insert({
            type: "capture_failed",
            title: "⚠️ Capture Failed",
            message: `Payment capture failed for ${order.order_number} — ${order.customer_name}. Reschedule email sent.`,
            entity_type: "order",
            entity_id: order.id,
          });
        } catch {}

        results.failed++;
        results.failed_orders.push(`${order.order_number} — ${order.customer_name} (${err.message})`);
        results.errors.push(`${order.order_number}: ${err.message}`);
      }
    }

    // Send admin summary email
    if (results.captured > 0 || results.failed > 0) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            type: "capture_summary",
            data: {
              captured_count: results.captured,
              failed_count: results.failed,
              captured_orders: results.captured_orders,
              failed_orders: results.failed_orders,
            },
          }),
        });
      } catch (emailErr: any) {
        console.error("[capture-payments] Failed to send summary email:", emailErr.message);
      }
    }

    console.log("[capture-payments] Results:", JSON.stringify(results));

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[capture-payments] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
