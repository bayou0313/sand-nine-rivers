import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { password, action, id, stage, notes, lead_number, order_number } = await req.json();

    const leadsPassword = Deno.env.get("LEADS_PASSWORD");
    if (!leadsPassword || password !== leadsPassword) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "list") {
      const { data, error } = await supabase
        .from("delivery_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ leads: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "toggle_contacted") {
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: current, error: fetchErr } = await supabase
        .from("delivery_leads")
        .select("contacted")
        .eq("id", id)
        .single();

      if (fetchErr) throw fetchErr;

      const { error: updateErr } = await supabase
        .from("delivery_leads")
        .update({ contacted: !current.contacted })
        .eq("id", id);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, contacted: !current.contacted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_stage") {
      if (!id || !stage) {
        return new Response(
          JSON.stringify({ error: "Missing id or stage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validStages = ["new", "called", "quoted", "won", "lost"];
      if (!validStages.includes(stage)) {
        return new Response(
          JSON.stringify({ error: "Invalid stage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateErr } = await supabase
        .from("delivery_leads")
        .update({ stage })
        .eq("id", id);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_notes") {
      if (!id || notes === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing id or notes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get current notes and append
      const { data: current, error: fetchErr } = await supabase
        .from("delivery_leads")
        .select("notes")
        .eq("id", id)
        .single();

      if (fetchErr) throw fetchErr;

      const timestamp = new Date().toLocaleString("en-US");
      const existingNotes = current.notes || "";
      const newNotes = existingNotes
        ? `${existingNotes}\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`;

      const { error: updateErr } = await supabase
        .from("delivery_leads")
        .update({ notes: newNotes })
        .eq("id", id);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, notes: newNotes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "mark_converted") {
      if (!lead_number) {
        return new Response(
          JSON.stringify({ error: "Missing lead_number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find lead by lead_number
      const { data: lead, error: fetchErr } = await supabase
        .from("delivery_leads")
        .select("id, notes")
        .eq("lead_number", lead_number)
        .single();

      if (fetchErr) {
        console.error("[leads-auth] Lead not found:", lead_number, fetchErr);
        return new Response(
          JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const timestamp = new Date().toLocaleString("en-US");
      const existingNotes = lead.notes || "";
      const conversionNote = `[${timestamp}] CONVERTED — Order ${order_number || "N/A"} placed`;
      const newNotes = existingNotes
        ? `${existingNotes}\n${conversionNote}`
        : conversionNote;

      const { error: updateErr } = await supabase
        .from("delivery_leads")
        .update({ stage: "won", contacted: true, notes: newNotes })
        .eq("id", lead.id);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[leads-auth] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
