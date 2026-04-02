import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAND_COLOR = "#0D2137";
const BRAND_GOLD = "#C07A00";
const FROM = "River Sand <no_reply@riversand.net>";
const PHONE = "1-855-GOT-WAYS";
const BASE_URL = "https://riversand.net";

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden}
  .header{background:${BRAND_COLOR};padding:24px;text-align:center}
  .header h1{color:${BRAND_GOLD};margin:0;font-size:24px;letter-spacing:2px}
  .body{padding:32px 24px}
  .body h2{color:${BRAND_COLOR};margin:0 0 16px}
  .body p{color:#555;font-size:15px;line-height:1.6}
  .cta{display:inline-block;background:${BRAND_GOLD};color:${BRAND_COLOR}!important;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;font-size:16px}
  .footer{background:#f9f9f9;padding:20px 24px;text-align:center;font-size:13px;color:#999}
  .footer a{color:${BRAND_COLOR};text-decoration:none}
</style></head><body>
<div class="container">
  <div class="header"><h1>RIVER SAND</h1></div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>River Sand &bull; Greater New Orleans, LA</p>
    <p><a href="tel:+18554689297">${PHONE}</a></p>
    <p style="margin-top:8px;font-size:11px;color:#bbb">© 2026 WAYS® Materials LLC</p>
  </div>
</div></body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendKey);

    // Fetch sender identity from global_settings
    const { data: settingsRows } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["sender_name", "sender_title", "site_name"]);
    const cfg: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { cfg[r.key] = r.value; });
    const SENDER_NAME = cfg.sender_name || "Silas Caldeira";
    const SENDER_TITLE = cfg.sender_title || "Founder & CEO";
    const SITE = cfg.site_name || "River Sand";

    const results = { email_1hr: 0, email_24hr: 0, email_72hr: 0, errors: [] as string[] };

    // Email 1: 1 hour after abandonment
    const { data: sessions1hr } = await supabase
      .from("visitor_sessions")
      .select("*")
      .in("stage", ["started_checkout", "reached_payment"])
      .not("customer_email", "is", null)
      .eq("email_1hr_sent", false)
      .lt("updated_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    for (const s of sessions1hr || []) {
      try {
        const firstName = (s.customer_name || "").split(" ")[0] || "there";
        const orderUrl = `${BASE_URL}/order?address=${encodeURIComponent(s.delivery_address || "")}&price=${s.calculated_price || ""}&utm_source=abandonment&utm_medium=email&utm_campaign=abandon_1hr`;

        await resend.emails.send({
          from: FROM,
          to: [s.customer_email],
          subject: "Your River Sand delivery is still available",
          html: emailWrapper(`
            <h2>Your order is waiting</h2>
            <p>Hi ${firstName},</p>
            <p>You were so close! Your River Sand delivery to <strong>${s.delivery_address || "your address"}</strong> is still available.</p>
            <p style="text-align:center"><a href="${orderUrl}" class="cta">ORDER NOW</a></p>
            <p>Same-day delivery still available if you order before 10 AM.</p>
            <p style="margin-top:24px">— Silas Caldeira<br>River Sand | ${PHONE}</p>
          `),
        });

        await supabase
          .from("visitor_sessions")
          .update({ email_1hr_sent: true, email_1hr_sent_at: new Date().toISOString() })
          .eq("id", s.id);

        results.email_1hr++;
      } catch (err: any) {
        results.errors.push(`1hr-${s.id}: ${err.message}`);
      }
    }

    // Email 2: 24 hours after abandonment
    const { data: sessions24hr } = await supabase
      .from("visitor_sessions")
      .select("*")
      .in("stage", ["started_checkout", "reached_payment"])
      .not("customer_email", "is", null)
      .eq("email_1hr_sent", true)
      .eq("email_24hr_sent", false)
      .lt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    for (const s of sessions24hr || []) {
      try {
        const firstName = (s.customer_name || "").split(" ")[0] || "there";
        const orderUrl = `${BASE_URL}/order?address=${encodeURIComponent(s.delivery_address || "")}&price=${s.calculated_price || ""}&utm_source=abandonment&utm_medium=email&utm_campaign=abandon_24hr`;

        await resend.emails.send({
          from: FROM,
          to: [s.customer_email],
          subject: "Still thinking about your River Sand delivery?",
          html: emailWrapper(`
            <h2>Still thinking it over?</h2>
            <p>Hi ${firstName},</p>
            <p>We noticed you didn't complete your order. Your delivery details are saved.</p>
            <p style="text-align:center"><a href="${orderUrl}" class="cta">ORDER NOW</a></p>
            <p>Questions? Call us at <a href="tel:+18554689297">${PHONE}</a> — we're real people and happy to help.</p>
            <p style="margin-top:24px">— Silas Caldeira<br>River Sand | ${PHONE}</p>
          `),
        });

        await supabase
          .from("visitor_sessions")
          .update({ email_24hr_sent: true, email_24hr_sent_at: new Date().toISOString() })
          .eq("id", s.id);

        results.email_24hr++;
      } catch (err: any) {
        results.errors.push(`24hr-${s.id}: ${err.message}`);
      }
    }

    // Email 3: 72 hours — $5 off
    const { data: sessions72hr } = await supabase
      .from("visitor_sessions")
      .select("*")
      .in("stage", ["started_checkout", "reached_payment"])
      .not("customer_email", "is", null)
      .eq("email_24hr_sent", true)
      .eq("email_72hr_sent", false)
      .lt("updated_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());

    for (const s of sessions72hr || []) {
      try {
        const firstName = (s.customer_name || "").split(" ")[0] || "there";
        const originalPrice = s.calculated_price || 195;
        const discountedPrice = Math.max(0, originalPrice - 5);
        const orderUrl = `${BASE_URL}/order?address=${encodeURIComponent(s.delivery_address || "")}&price=${discountedPrice}&discount=5&utm_source=abandonment&utm_medium=email&utm_campaign=abandon_72hr`;

        await resend.emails.send({
          from: FROM,
          to: [s.customer_email],
          subject: "Here's $5 off your River Sand delivery",
          html: emailWrapper(`
            <h2>Here's $5 off your order</h2>
            <p>Hi ${firstName},</p>
            <p>We'd love to deliver to you. Here's $5 off your order — applied automatically, no code needed.</p>
            <table class="info-table" style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Product</td><td style="padding:8px 0;border-bottom:1px solid #eee">River Sand — 9 Cubic Yards</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Delivered to</td><td style="padding:8px 0;border-bottom:1px solid #eee">${s.delivery_address || ""}</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Your price</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:700;color:${BRAND_GOLD}">$${discountedPrice.toFixed(2)}</td></tr>
            </table>
            <p style="text-align:center"><a href="${orderUrl}" class="cta">ORDER NOW — $${discountedPrice.toFixed(2)} DELIVERED</a></p>
            <p style="font-size:13px;color:#999">Offer expires 7 days from this email.</p>
            <p style="margin-top:24px">— Silas Caldeira<br>River Sand | ${PHONE}</p>
          `),
        });

        await supabase
          .from("visitor_sessions")
          .update({ email_72hr_sent: true, email_72hr_sent_at: new Date().toISOString() })
          .eq("id", s.id);

        results.email_72hr++;
      } catch (err: any) {
        results.errors.push(`72hr-${s.id}: ${err.message}`);
      }
    }

    console.log("[abandonment-emails] Results:", JSON.stringify(results));

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[abandonment-emails] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
