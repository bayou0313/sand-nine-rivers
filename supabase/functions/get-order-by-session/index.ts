import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_PLATFORM = "WM";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
      return new Response(
        JSON.stringify({ error: "Invalid session_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, source_platform, " +
        "customer_name, customer_email, customer_phone, " +
        "delivery_address, delivery_zip, delivery_date, delivery_window, " +
        "quantity, price, material_total, delivery_fee, fuel_surcharge, " +
        "trustlevel_fee, discounts_total, tax_amount, " +
        "card_brand, card_last4, coupon_code, created_at"
      )
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[get-order-by-session] DB error:", error);
      return new Response(
        JSON.stringify({ error: "Internal error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.source_platform !== SOURCE_PLATFORM) {
      console.warn(`[get-order-by-session] Non-WM order requested: ${order.id}`);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, quantity, unit, price_per_unit, subtotal")
      .eq("order_id", order.id);

    return new Response(
      JSON.stringify({
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        delivery_address: order.delivery_address,
        delivery_zip: order.delivery_zip,
        delivery_date: order.delivery_date,
        delivery_window: order.delivery_window,
        quantity: order.quantity,
        price: order.price,
        material_total: order.material_total,
        delivery_fee: order.delivery_fee,
        fuel_surcharge: order.fuel_surcharge,
        trustlevel_fee: order.trustlevel_fee,
        discounts_total: order.discounts_total,
        tax_amount: order.tax_amount,
        card_brand: order.card_brand,
        card_last4: order.card_last4,
        coupon_code: order.coupon_code,
        created_at: order.created_at,
        items: items || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[get-order-by-session] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
