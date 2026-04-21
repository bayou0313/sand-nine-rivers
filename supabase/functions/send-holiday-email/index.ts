// supabase/functions/send-holiday-email/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

interface Payload {
  recipients: string[];
  subject: string;
  holidayName: string;
  holidayDate: string;
  daysOut: number;
  openUrl: string;
  closedUrl: string;
}

function buildHtml(p: Payload): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${p.subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#0D2137;padding:24px;text-align:center;">
          <h1 style="color:#C07A00;margin:0;font-size:24px;letter-spacing:2px;">HAULOGIX DISPATCH</h1>
        </td></tr>
        <tr><td style="padding:32px 32px 16px 32px;">
          <h2 style="color:#0D2137;margin:0 0 16px 0;font-size:20px;">Holiday Decision Required</h2>
          <p style="color:#333;font-size:16px;line-height:1.5;margin:0 0 12px 0;">
            <strong>${p.holidayName}</strong> is in <strong>${p.daysOut} days</strong> (${p.holidayDate}).
          </p>
          <p style="color:#555;font-size:15px;line-height:1.5;margin:0 0 24px 0;">
            Click one of the buttons below to confirm whether deliveries will run that day. You'll see a confirmation page before the decision is recorded. Customers see the holiday banner only after you confirm.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding:0 8px;">
              <a href="${p.openUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">&#10003; YES &mdash; WE'RE OPEN</a>
            </td>
            <td style="padding:0 8px;">
              <a href="${p.closedUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">&#10007; NO &mdash; WE'RE CLOSED</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee;">
          <p style="color:#888;font-size:12px;margin:0;line-height:1.4;">
            This decision is logged with timestamp. You can change it later in the LMT dashboard. If you take no action, the holiday remains unconfirmed and will not appear on the customer banner.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as Payload;

    if (!payload.recipients?.length || !payload.subject || !payload.openUrl || !payload.closedUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildHtml(payload);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Haulogix Dispatch <dispatch@haulogix.com>",
        to: payload.recipients,
        subject: payload.subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[send-holiday-email] Resend error:", errText);
      return new Response(JSON.stringify({ error: "Email send failed", details: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-holiday-email] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
