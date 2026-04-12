import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { order_id, lookup_token } = await req.json();

    if (!lookup_token) {
      return new Response(
        JSON.stringify({ error: "lookup_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(lookup_token) || (order_id && !uuidRegex.test(order_id))) {
      return new Response(
        JSON.stringify({ error: "Invalid format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Look up order by lookup_token (and optionally order_id)
    let query = supabase
      .from("orders")
      .select("id, status, payment_status, order_number, delivery_date, delivery_day_of_week, delivery_window, quantity, price, delivery_address, customer_name, customer_phone, customer_email, company_name, payment_method, distance_miles, tax_amount, tax_rate, state_tax_rate, state_tax_amount, parish_tax_rate, parish_tax_amount, saturday_surcharge, saturday_surcharge_amount, sunday_surcharge, sunday_surcharge_amount, same_day_requested, stripe_payment_id, discount_amount, card_last4, card_brand, lookup_token, base_unit_price, distance_fee, processing_fee")
      .eq("lookup_token", lookup_token);

    if (order_id) {
      query = query.eq("id", order_id);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return new Response(
        JSON.stringify({ error: "Internal error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Order not found or token expired" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If payment is complete, mark the token as used (one-time use)
    if (order.payment_status === "paid") {
      await supabase
        .from("orders")
        .update({ lookup_token_used: true })
        .eq("id", order_id);
    }

    return new Response(
      JSON.stringify({
        id: order.id,
        order_id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        order_number: order.order_number,
        delivery_date: order.delivery_date,
        delivery_day_of_week: order.delivery_day_of_week,
        delivery_window: order.delivery_window,
        quantity: order.quantity,
        price: order.price,
        delivery_address: order.delivery_address,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        company_name: order.company_name,
        payment_method: order.payment_method,
        distance_miles: order.distance_miles,
        tax_amount: order.tax_amount,
        tax_rate: order.tax_rate,
        saturday_surcharge: order.saturday_surcharge,
        saturday_surcharge_amount: order.saturday_surcharge_amount,
        sunday_surcharge: order.sunday_surcharge,
        sunday_surcharge_amount: order.sunday_surcharge_amount,
        same_day_requested: order.same_day_requested,
        stripe_payment_id: order.stripe_payment_id,
        discount_amount: order.discount_amount,
        lookup_token: order.lookup_token,
        base_unit_price: order.base_unit_price,
        distance_fee: order.distance_fee,
        processing_fee: order.processing_fee,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
