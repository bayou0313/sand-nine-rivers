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
const WAYS_ICON = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_-_ICON_-_512.png.png";

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden}
  .header{background:${BRAND_COLOR};padding:24px;text-align:center}
  .header h1{color:${BRAND_GOLD};margin:0;font-size:24px;letter-spacing:2px}
  .icon-row{background:#ffffff;text-align:center;padding:20px 0 12px 0}
  .body{padding:32px 24px}
  .body h2{color:${BRAND_COLOR};margin:0 0 16px}
  .body p{color:#555;font-size:15px;line-height:1.6}
  .cta{display:inline-block;background:${BRAND_GOLD};color:${BRAND_COLOR}!important;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;font-size:16px}
  .footer{background:#f9f9f9;padding:20px 24px;text-align:center;font-size:13px;color:#999}
  .footer a{color:${BRAND_COLOR};text-decoration:none}
</style></head><body>
<div class="container">
  <div class="header"><h1>RIVER SAND</h1></div>
  <div class="icon-row"><img src="${WAYS_ICON}" alt="WAYS" style="height:48px;width:48px;border-radius:8px;" /></div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>River Sand &bull; Greater New Orleans, LA</p>
    <p><a href="tel:+18554689297">${PHONE}</a></p>
    <p style="margin-top:8px;font-size:11px;color:#bbb">© 2026 WAYS® Materials LLC</p>
  </div>
</div></body></html>`;
}

/** Call create-checkout-link to get a real Stripe checkout URL with discount baked in */
async function createDiscountedCheckoutLink(
  supabase: any,
  session: any,
  discountDollars: number
): Promise<string | null> {
  try {
    const originalPrice = session.calculated_price || 195;
    const discountedPrice = Math.max(0, originalPrice - discountDollars);
    const amountCents = Math.round(discountedPrice * 100);

    if (amountCents < 50) return null; // Stripe minimum

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        description: `River Sand Delivery — $${discountDollars} discount applied`,
        customer_name: session.customer_name || "",
        customer_email: session.customer_email,
        origin_url: BASE_URL,
      }),
    });

    if (!response.ok) {
      console.error(`[abandonment-emails] checkout-link error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (err: any) {
    console.error("[abandonment-emails] createDiscountedCheckoutLink error:", err.message);
    return null;
  }
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

    const results = { email_1hr: 0, email_24hr: 0, email_48hr: 0, email_108hr: 0, email_hot_path: 0, errors: [] as string[] };

    // ── Email 1: 1 hour after abandonment ──
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
            <p style="margin-top:24px">— ${SENDER_NAME}<br>${SITE} | ${PHONE}</p>
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

    // ── Email 2: 24 hours after abandonment ──
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
            <p style="margin-top:24px">— ${SENDER_NAME}<br>${SITE} | ${PHONE}</p>
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

    // ── HOT PATH: Stripe link clicked — $10 off at 24hr (server-side Stripe link) ──
    const { data: sessionsHotPath } = await supabase
      .from("visitor_sessions")
      .select("*")
      .in("stage", ["started_checkout", "reached_payment"])
      .not("customer_email", "is", null)
      .eq("stripe_link_clicked", true)
      .eq("email_24hr_sent", false)
      .is("order_id", null)
      .lt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    for (const s of sessionsHotPath || []) {
      try {
        const firstName = (s.customer_name || "").split(" ")[0] || "there";
        const originalPrice = s.calculated_price || 195;
        const discountedPrice = Math.max(0, originalPrice - 10);

        // Create real Stripe checkout link with discount baked in
        const checkoutUrl = await createDiscountedCheckoutLink(supabase, s, 10);
        const ctaUrl = checkoutUrl || `${BASE_URL}/order?address=${encodeURIComponent(s.delivery_address || "")}&price=${discountedPrice}&discount=10&utm_source=abandonment&utm_medium=email&utm_campaign=hot_path_10off`;

        await resend.emails.send({
          from: FROM,
          to: [s.customer_email],
          subject: "We saved $10 on your River Sand delivery",
          html: emailWrapper(`
            <h2>We saved $10 on your order</h2>
            <p>Hi ${firstName},</p>
            <p>You were so close. We're holding your quote and knocking <strong>$10 off</strong> if you complete your order in the next 24 hours.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Product</td><td style="padding:8px 0;border-bottom:1px solid #eee">River Sand — 9 Cubic Yards</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Delivered to</td><td style="padding:8px 0;border-bottom:1px solid #eee">${s.delivery_address || ""}</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Original price</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-decoration:line-through;color:#999">$${originalPrice.toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Your price</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:700;color:${BRAND_GOLD}">$${discountedPrice.toFixed(2)}</td></tr>
            </table>
            <p style="text-align:center"><a href="${ctaUrl}" class="cta">COMPLETE YOUR ORDER — $${discountedPrice.toFixed(2)}</a></p>
            <p style="font-size:13px;color:#999">This $10 discount expires in 24 hours.</p>
            <p style="margin-top:24px">— ${SENDER_NAME}<br>${SENDER_TITLE}, ${SITE}<br>${PHONE}</p>
          `),
        });

        // Mark both 24hr and 72hr as sent so they skip the cold path
        await supabase
          .from("visitor_sessions")
          .update({
            email_24hr_sent: true, email_24hr_sent_at: new Date().toISOString(),
            email_48hr_sent: true, email_48hr_sent_at: new Date().toISOString(),
            email_72hr_sent: true, email_72hr_sent_at: new Date().toISOString(),
          })
          .eq("id", s.id);

        results.email_hot_path++;
      } catch (err: any) {
        results.errors.push(`hot-${s.id}: ${err.message}`);
      }
    }

    // ── Email 3: 48 hours — no discount (cold path) ──
    const { data: sessions48hr } = await supabase
      .from("visitor_sessions")
      .select("*")
      .in("stage", ["started_checkout", "reached_payment"])
      .not("customer_email", "is", null)
      .eq("email_24hr_sent", true)
      .eq("email_48hr_sent", false)
      .lt("updated_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    for (const s of sessions48hr || []) {
      try {
        const firstName = (s.customer_name || "").split(" ")[0] || "there";
        const orderUrl = `${BASE_URL}/order?address=${encodeURIComponent(s.delivery_address || "")}&price=${s.calculated_price || ""}&utm_source=abandonment&utm_medium=email&utm_campaign=abandon_48hr`;

        await resend.emails.send({
          from: FROM,
          to: [s.customer_email],
          subject: "Your river sand delivery — still available",
          html: emailWrapper(`
            <h2>Your delivery is still waiting</h2>
            <p>Hi ${firstName},</p>
            <p>Just a friendly reminder — your River Sand delivery to <strong>${s.delivery_address || "your address"}</strong> is ready when you are.</p>
            <p>We deliver 9 cubic yards of premium river sand right to your site. No middlemen, no hidden fees.</p>
            <p style="text-align:center"><a href="${orderUrl}" class="cta">ORDER NOW</a></p>
            <p>Need help? Call us at <a href="tel:+18554689297">${PHONE}</a> — we'll walk you through it.</p>
            <p style="margin-top:24px">— ${SENDER_NAME}<br>${SITE} | ${PHONE}</p>
          `),
        });

        await supabase
          .from("visitor_sessions")
          .update({ email_48hr_sent: true, email_48hr_sent_at: new Date().toISOString() })
          .eq("id", s.id);

        results.email_48hr++;
      } catch (err: any) {
        results.errors.push(`48hr-${s.id}: ${err.message}`);
      }
    }

    // ── Email 4: 108 hours — $10 off final offer (cold path, server-side Stripe link) ──
    const { data: sessions108hr } = await supabase
      .from("visitor_sessions")
      .select("*")
      .in("stage", ["started_checkout", "reached_payment"])
      .not("customer_email", "is", null)
      .eq("email_48hr_sent", true)
      .eq("email_72hr_sent", false)
      .lt("updated_at", new Date(Date.now() - 108 * 60 * 60 * 1000).toISOString());

    for (const s of sessions108hr || []) {
      try {
        const firstName = (s.customer_name || "").split(" ")[0] || "there";
        const originalPrice = s.calculated_price || 195;
        const discountedPrice = Math.max(0, originalPrice - 10);

        // Create real Stripe checkout link with discount baked in
        const checkoutUrl = await createDiscountedCheckoutLink(supabase, s, 10);
        const ctaUrl = checkoutUrl || `${BASE_URL}/order?address=${encodeURIComponent(s.delivery_address || "")}&price=${discountedPrice}&discount=10&utm_source=abandonment&utm_medium=email&utm_campaign=abandon_108hr`;

        await resend.emails.send({
          from: FROM,
          to: [s.customer_email],
          subject: "Last chance — $10 off your river sand delivery",
          html: emailWrapper(`
            <h2>Last chance — $10 off your order</h2>
            <p>Hi ${firstName},</p>
            <p>This is your final reminder. We'd really love to deliver to you — so here's <strong>$10 off</strong> your order, applied automatically.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Product</td><td style="padding:8px 0;border-bottom:1px solid #eee">River Sand — 9 Cubic Yards</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Delivered to</td><td style="padding:8px 0;border-bottom:1px solid #eee">${s.delivery_address || ""}</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Original price</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-decoration:line-through;color:#999">$${originalPrice.toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;color:${BRAND_COLOR}">Your price</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:700;color:${BRAND_GOLD}">$${discountedPrice.toFixed(2)}</td></tr>
            </table>
            <p style="text-align:center"><a href="${ctaUrl}" class="cta">COMPLETE YOUR ORDER — $${discountedPrice.toFixed(2)}</a></p>
            <p style="font-size:13px;color:#999">This is our final offer — expires in 48 hours.</p>
            <p style="margin-top:24px">— ${SENDER_NAME}<br>${SENDER_TITLE}, ${SITE}<br>${PHONE}</p>
          `),
        });

        await supabase
          .from("visitor_sessions")
          .update({ email_72hr_sent: true, email_72hr_sent_at: new Date().toISOString() })
          .eq("id", s.id);

        results.email_108hr++;
      } catch (err: any) {
        results.errors.push(`108hr-${s.id}: ${err.message}`);
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
