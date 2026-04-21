// supabase/functions/holiday-confirm/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/holiday-confirm`;

function htmlPage(title: string, body: string, accent: string = "#0D2137"): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<style>
  body{margin:0;font-family:Arial,sans-serif;background:#f4f4f4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .card{background:#fff;border-radius:8px;padding:40px;max-width:520px;width:100%;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.08);}
  .accent{color:${accent};font-weight:bold;font-size:14px;letter-spacing:2px;margin:0 0 16px 0;}
  h1{color:#0D2137;margin:0 0 16px 0;font-size:24px;}
  p{color:#555;line-height:1.5;font-size:15px;margin:0 0 12px 0;}
  .pill{display:inline-block;padding:14px 24px;border-radius:6px;color:#fff;font-weight:bold;letter-spacing:1px;margin:20px 0;}
  button{background:${accent};color:#fff;border:0;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;letter-spacing:1px;cursor:pointer;margin-top:16px;}
  button:hover{opacity:.9;}
  .cancel{display:block;margin-top:14px;color:#888;font-size:13px;text-decoration:none;}
</style></head><body>
<div class="card"><p class="accent">HAULOGIX DISPATCH</p>${body}</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function errorPage(title: string, message: string, status: number): Response {
  return new Response(
    htmlPage(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`, "#dc2626"),
    { status, headers: { "Content-Type": "text/html" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let token: string | null = null;
  let decision: string | null = null;

  if (req.method === "GET") {
    token = url.searchParams.get("token");
    decision = url.searchParams.get("decision");
  } else if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      token = String(form.get("token") || "");
      decision = String(form.get("decision") || "");
    } else {
      const body = await req.json().catch(() => ({}));
      token = body.token || null;
      decision = body.decision || null;
    }
  } else {
    return errorPage("Method Not Allowed", "Only GET and POST are accepted.", 405);
  }

  if (!token || !decision || !["open", "closed"].includes(decision)) {
    return errorPage("Invalid Link", "This confirmation link is malformed or incomplete.", 400);
  }

  // Validate token is a UUID format to prevent SQL injection probing
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return errorPage("Invalid Link", "Token format is invalid.", 400);
  }

  const { data: holiday, error: fetchErr } = await supabase
    .from("holidays")
    .select("id, name, holiday_date, is_closed, customer_visible, operator_decision_at, operator_decision_by")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (fetchErr || !holiday) {
    return errorPage("Token Not Found", "This confirmation token is invalid or no longer exists.", 404);
  }

  const isOpen = decision === "open";
  const humanDate = new Date(holiday.holiday_date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const statusLabel = isOpen ? "OPEN — DELIVERIES WILL RUN" : "CLOSED — NO DELIVERIES";
  const statusColor = isOpen ? "#16a34a" : "#dc2626";
  const safeName = escapeHtml(holiday.name);
  const safeToken = escapeHtml(token);
  const safeDecision = escapeHtml(decision);

  // ─── GET: confirmation page (NO DB WRITE — prefetch-safe) ───
  if (req.method === "GET") {
    const previouslyDecided = holiday.operator_decision_at
      ? `<p style="font-size:13px;color:#888;margin-top:8px;">Previously decided: ${escapeHtml(new Date(holiday.operator_decision_at).toLocaleString("en-US", { timeZone: "America/Chicago" }))} CT (${escapeHtml(holiday.operator_decision_by || "unknown")}). This will overwrite that decision.</p>`
      : "";

    const body = `
      <h1>Confirm Decision</h1>
      <p style="font-size:18px;color:#0D2137;"><strong>${safeName}</strong></p>
      <p>${humanDate}</p>
      <p style="margin-top:20px;">You are about to mark this holiday as:</p>
      <div class="pill" style="background:${statusColor};">${statusLabel}</div>
      <p style="font-size:14px;">Click the button below to record this decision. Customers will see the holiday banner immediately after.</p>
      ${previouslyDecided}
      <form method="POST" action="${FUNCTION_URL}">
        <input type="hidden" name="token" value="${safeToken}">
        <input type="hidden" name="decision" value="${safeDecision}">
        <button type="submit" style="background:${statusColor};">CONFIRM &mdash; MARK ${isOpen ? "OPEN" : "CLOSED"}</button>
      </form>
      <a class="cancel" href="https://riversand.net">Cancel — close this window</a>
    `;
    return new Response(htmlPage("Confirm Decision", body, statusColor), {
      status: 200, headers: { "Content-Type": "text/html" },
    });
  }

  // ─── POST: commit decision ───
  const { error: updateErr } = await supabase
    .from("holidays")
    .update({
      is_closed: !isOpen,
      customer_visible: true,
      operator_decision_at: new Date().toISOString(),
      operator_decision_by: "email_link",
      updated_at: new Date().toISOString(),
    })
    .eq("id", holiday.id);

  if (updateErr) {
    console.error("[holiday-confirm] update error:", updateErr);
    return errorPage("Update Failed", "Could not record your decision. Please try again or use the LMT dashboard.", 500);
  }

  const successBody = `
    <h1>Decision Recorded</h1>
    <p style="font-size:18px;color:#0D2137;"><strong>${safeName}</strong></p>
    <p>${humanDate}</p>
    <div class="pill" style="background:${statusColor};">${statusLabel}</div>
    <p>The customer banner will now reflect this status. You can change this decision anytime in the LMT dashboard.</p>
    <p style="font-size:12px;color:#888;margin-top:24px;">Logged: ${escapeHtml(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }))} CT</p>
  `;
  return new Response(htmlPage("Decision Recorded", successBody, statusColor), {
    status: 200, headers: { "Content-Type": "text/html" },
  });
});
