import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM_EMAIL = "WAYS Materials <orders@waysmaterials.com>";
const REPLY_TO = "support@waysmaterials.com";

interface RequestBody {
  customer_email: string;
  customer_phone?: string;
  order_number?: string | null;
  failure_reason?: string;
  retry_url?: string;
}

function htmlBody(opts: {
  orderNumber: string | null;
  failureReason: string;
  retryUrl: string;
}): string {
  const { orderNumber, failureReason, retryUrl } = opts;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#0D2137;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;">
      <tr>
        <td style="background:#0D2137;padding:24px;text-align:center;">
          <div style="color:#C07A00;font-weight:700;letter-spacing:2px;font-size:22px;">WAYS MATERIALS</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 24px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0D2137;">Payment Could Not Be Processed</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
            We weren't able to complete your payment${orderNumber ? ` for order <strong>${orderNumber}</strong>` : ""}.
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#444;">
            Reason from our payment processor: <em>${failureReason}</em>
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">
            No charge was made. You can try again with the same or a different card below.
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${retryUrl}" style="background:#C07A00;color:#ffffff;text-decoration:none;padding:14px 28px;font-weight:700;letter-spacing:1px;display:inline-block;">
              RETRY PAYMENT
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.55;">
            Need help? Reply to this email or call us — we'll sort it out fast.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#0D2137;color:#ffffff;padding:16px;text-align:center;font-size:12px;">
          WAYS Materials &middot; waysmaterials.com
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

    if (!body.customer_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.customer_email)) {
      return new Response(
        JSON.stringify({ error: "Valid customer_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("WM_RESEND_API_KEY");
    if (!apiKey) {
      console.error("[send-payment-failed-email] Missing WM_RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email provider not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = htmlBody({
      orderNumber: body.order_number || null,
      failureReason: body.failure_reason || "Card declined",
      retryUrl: body.retry_url || "https://waysmaterials.com/checkout",
    });

    const subject = body.order_number
      ? `Payment Issue — Order ${body.order_number}`
      : "We Couldn't Process Your Payment";

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [body.customer_email],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });

    const respBody = await resp.text();
    if (!resp.ok) {
      console.error(`[send-payment-failed-email] Resend error ${resp.status}: ${respBody}`);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: respBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-payment-failed-email] Sent to ${body.customer_email} — ${respBody}`);
    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-payment-failed-email] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
