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
    const { payment_intent_id, reason } = await req.json();

    if (!payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "Missing payment_intent_id" }),
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

    const stripe = new Stripe(stripeKey || "", {
      apiVersion: "2025-08-27.basil",
    });

    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      reason: (reason === "fraudulent" ? "fraudulent" : "requested_by_customer") as Stripe.RefundCreateParams.Reason,
    });

    console.log(`[create-refund] Refund created: ${refund.id} for PI: ${payment_intent_id}, reason: ${reason || "requested_by_customer"}`);

    return new Response(
      JSON.stringify({ success: true, refund_id: refund.id, status: refund.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[create-refund] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create refund" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
