import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WAYS_STRIPE_ACCOUNT_ID = "acct_1Rs9KNLVhHPhPfIV";
const SOURCE_PLATFORM = "WM";

interface CartItem {
  product_id: string;
  quantity: number;
}

interface RequestBody {
  cart: CartItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  delivery_address: string;
  delivery_zip: string;
  delivery_date: string;
  delivery_window?: string;
  pit_id?: string;
  coupon_code?: string;
  origin_url?: string;
}

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
    const body = (await req.json()) as RequestBody;

    if (
      !body.cart ||
      !Array.isArray(body.cart) ||
      body.cart.length === 0 ||
      !body.customer?.name ||
      !body.customer?.email ||
      !body.customer?.phone ||
      !body.delivery_address ||
      !body.delivery_zip ||
      !body.delivery_date
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const item of body.cart) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid cart line" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: modeData } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "stripe_mode")
      .maybeSingle();
    const stripeMode = modeData?.value || "live";
    const stripeKey = stripeMode === "test"
      ? Deno.env.get("WM_STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("WM_STRIPE_LIVE_SECRET_KEY");

    if (!stripeKey) {
      console.error(`[create-checkout-session] Missing WM Stripe key for ${stripeMode} mode`);
      return new Response(
        JSON.stringify({ error: "Payment provider not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const productIds = body.cart.map((c) => c.product_id);

    const { data: products, error: productsErr } = await supabase
      .from("products")
      .select("id, name, unit, category")
      .in("id", productIds);

    if (productsErr || !products || products.length !== productIds.length) {
      return new Response(
        JSON.stringify({ error: "Invalid product(s) in cart" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let pitId: string | null = body.pit_id || null;
    if (!pitId) {
      const { data: invRows } = await supabase
        .from("pit_inventory")
        .select("pit_id, product_id")
        .in("product_id", productIds)
        .eq("available", true);

      const byPit: Record<string, Set<string>> = {};
      (invRows || []).forEach((r: any) => {
        if (!byPit[r.pit_id]) byPit[r.pit_id] = new Set();
        byPit[r.pit_id].add(r.product_id);
      });
      pitId = Object.entries(byPit).find(
        ([, set]) => productIds.every((id) => set.has(id))
      )?.[0] || null;
    }

    if (!pitId) {
      return new Response(
        JSON.stringify({ error: "No single pit can fulfill this cart" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: inventory, error: invErr } = await supabase
      .from("pit_inventory")
      .select("product_id, price_per_unit, available, min_quantity, max_quantity_per_load")
      .eq("pit_id", pitId)
      .in("product_id", productIds);

    if (invErr || !inventory || inventory.length !== productIds.length) {
      return new Response(
        JSON.stringify({ error: "Inventory unavailable for selected pit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invByProduct: Record<string, any> = {};
    inventory.forEach((row: any) => { invByProduct[row.product_id] = row; });

    const orderItemsToInsert: any[] = [];
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let materialTotal = 0;

    for (const item of body.cart) {
      const inv = invByProduct[item.product_id];
      const product = products.find((p: any) => p.id === item.product_id);
      if (!inv || !product) {
        return new Response(
          JSON.stringify({ error: `Product ${item.product_id} not available` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!inv.available) {
        return new Response(
          JSON.stringify({ error: `${product.name} not currently available` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (item.quantity < (inv.min_quantity ?? 1)) {
        return new Response(
          JSON.stringify({ error: `${product.name} requires min quantity ${inv.min_quantity}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (inv.max_quantity_per_load && item.quantity > inv.max_quantity_per_load) {
        return new Response(
          JSON.stringify({ error: `${product.name} max per load is ${inv.max_quantity_per_load}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const unitPrice = Number(inv.price_per_unit);
      const subtotal = +(unitPrice * item.quantity).toFixed(2);
      materialTotal += subtotal;

      orderItemsToInsert.push({
        product_id: item.product_id,
        pit_id: pitId,
        quantity: item.quantity,
        unit: product.unit,
        price_per_unit: unitPrice,
        subtotal,
      });

      stripeLineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `${product.name} — ${item.quantity} ${product.unit}`,
          },
          unit_amount: Math.round(subtotal * 100),
        },
        quantity: 1,
      });
    }

    materialTotal = +materialTotal.toFixed(2);

    const totalAmountCents = stripeLineItems.reduce(
      (sum, li) => sum + (li.price_data!.unit_amount! * (li.quantity || 1)),
      0
    );

    const { data: orderInsert, error: orderErr } = await supabase
      .from("orders")
      .insert({
        source_platform: SOURCE_PLATFORM,
        stripe_account_id: WAYS_STRIPE_ACCOUNT_ID,
        status: "pending",
        payment_status: "pending",
        payment_method: "card",
        customer_name: body.customer.name,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone,
        delivery_address: body.delivery_address,
        delivery_zip: body.delivery_zip,
        delivery_date: body.delivery_date,
        delivery_window: body.delivery_window || "8:00 AM – 5:00 PM",
        pit_id: pitId,
        quantity: body.cart.reduce((s, c) => s + c.quantity, 0),
        distance_miles: 0,
        price: +(totalAmountCents / 100).toFixed(2),
        material_total: materialTotal,
        delivery_fee: 0,
        fuel_surcharge: 0,
        trustlevel_fee: 0,
        discounts_total: 0,
        coupon_code: body.coupon_code || null,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !orderInsert) {
      console.error("[create-checkout-session] Order insert failed:", orderErr);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemsPayload = orderItemsToInsert.map((it) => ({
      ...it,
      order_id: orderInsert.id,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
    if (itemsErr) {
      console.error("[create-checkout-session] order_items insert failed:", itemsErr);
    }

    const baseOrigin = body.origin_url || "https://waysmaterials.com";
    const successUrl = `${baseOrigin}/order/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseOrigin}/order/cancelled?order_number=${orderInsert.order_number}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: stripeLineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: body.customer.email,
      customer_creation: "always",
      billing_address_collection: "required",
      payment_intent_data: {
        capture_method: "automatic",
        metadata: {
          order_id: orderInsert.id,
          order_number: orderInsert.order_number || "",
          source_platform: SOURCE_PLATFORM,
          customer_phone: body.customer.phone,
          customer_email: body.customer.email,
        },
      },
      metadata: {
        order_id: orderInsert.id,
        order_number: orderInsert.order_number || "",
        source_platform: SOURCE_PLATFORM,
      },
    });

    await supabase
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", orderInsert.id);

    console.log(
      `[create-checkout-session] WM order=${orderInsert.order_number} session=${session.id} mode=${stripeMode}`
    );

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        order_id: orderInsert.id,
        order_number: orderInsert.order_number,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-checkout-session] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
