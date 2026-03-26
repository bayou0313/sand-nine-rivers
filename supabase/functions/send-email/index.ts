import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAND_COLOR = "#041F38";
const BRAND_GOLD = "#EAAB22";
const BRAND_RED = "#C21F32";
const FROM_EMAIL = "orders@riversand.net";
const PHONE = "1-855-GOT-WAYS";

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
  .body p,.body td{color:#555;font-size:15px;line-height:1.6}
  .info-table{width:100%;border-collapse:collapse;margin:16px 0}
  .info-table td{padding:8px 0;border-bottom:1px solid #eee}
  .info-table td:first-child{font-weight:600;color:${BRAND_COLOR};width:40%}
  .footer{background:#f9f9f9;padding:20px 24px;text-align:center;font-size:13px;color:#999}
  .footer a{color:${BRAND_COLOR};text-decoration:none}
  .cta{display:inline-block;background:${BRAND_GOLD};color:${BRAND_COLOR}!important;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0}
</style></head><body>
<div class="container">
  <div class="header"><h1>WAYS River Sand</h1></div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>WAYS River Sand &bull; Greater New Orleans, LA</p>
    <p><a href="tel:+18554689297">${PHONE}</a> &bull; <a href="mailto:${FROM_EMAIL}">${FROM_EMAIL}</a></p>
    <p><a href="https://riversand.net">riversand.net</a></p>
  </div>
</div></body></html>`;
}

function orderCustomerEmail(order: any) {
  const rows = [
    ["Product", "River Sand — 9 cu yd load"],
    ["Quantity", `${order.quantity} load${order.quantity > 1 ? "s" : ""}`],
    ["Delivery Address", order.delivery_address],
    ["Delivery Date", order.delivery_date || "TBD"],
    ["Delivery Window", order.delivery_window || "8:00 AM – 5:00 PM"],
    ["Total Price", `$${Number(order.price).toFixed(2)}`],
    ["Payment Method", order.payment_method === "stripe-link" ? "Credit Card" : order.payment_method === "check" ? "Check on Delivery" : "Cash on Delivery"],
  ];
  if (order.order_number) rows.unshift(["Order #", order.order_number]);

  const tableRows = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  return emailWrapper(`
    <h2>Order Confirmed! 🎉</h2>
    <p>Thank you for your order${order.customer_name ? ", " + order.customer_name : ""}! Here's your order summary:</p>
    <table class="info-table">${tableRows}</table>
    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""}
    <p>If you have any questions, call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a>.</p>
  `);
}

function orderInternalEmail(order: any) {
  const rows = [
    ["Order #", order.order_number || "N/A"],
    ["Customer", order.customer_name],
    ["Phone", order.customer_phone],
    ["Email", order.customer_email || "Not provided"],
    ["Delivery Address", order.delivery_address],
    ["Distance", `${order.distance_miles} mi`],
    ["Quantity", `${order.quantity} load${order.quantity > 1 ? "s" : ""}`],
    ["Delivery Date", order.delivery_date || "TBD"],
    ["Day", order.delivery_day_of_week || "N/A"],
    ["Window", order.delivery_window || "8:00 AM – 5:00 PM"],
    ["Saturday Surcharge", order.saturday_surcharge ? `Yes ($${order.saturday_surcharge_amount})` : "No"],
    ["Same-Day", order.same_day_requested ? "Yes" : "No"],
    ["Tax", `$${Number(order.tax_amount || 0).toFixed(2)} (${(Number(order.tax_rate || 0) * 100).toFixed(2)}%)`],
    ["Total Price", `$${Number(order.price).toFixed(2)}`],
    ["Payment", order.payment_method],
    ["Payment Status", order.payment_status || "pending"],
  ];

  const tableRows = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  return emailWrapper(`
    <h2>📦 New Order Received</h2>
    <table class="info-table">${tableRows}</table>
    ${order.notes ? `<p><strong>Customer Notes:</strong> ${order.notes}</p>` : ""}
  `);
}

function contactCustomerEmail(contact: any) {
  return emailWrapper(`
    <h2>We Got Your Message!</h2>
    <p>Hi${contact.name ? " " + contact.name : ""},</p>
    <p>Thanks for reaching out! We've received your message and will get back to you within <strong>one business day</strong>.</p>
    <p>In the meantime, if it's urgent, give us a call at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a>.</p>
  `);
}

function contactInternalEmail(contact: any) {
  const rows = [
    ["Name", contact.name || "Not provided"],
    ["Email", contact.email || "Not provided"],
    ["Phone", contact.phone || "Not provided"],
  ];
  const tableRows = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  return emailWrapper(`
    <h2>📬 New Contact Form Submission</h2>
    <table class="info-table">${tableRows}</table>
    <p><strong>Message:</strong></p>
    <p style="background:#f9f9f9;padding:16px;border-radius:6px;border-left:4px solid ${BRAND_GOLD}">${(contact.message || "").replace(/\n/g, "<br>")}</p>
  `);
}

async function sendMail(to: string, subject: string, html: string) {
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: Deno.env.get("GMAIL_USER") || FROM_EMAIL,
        password: Deno.env.get("GMAIL_APP_PASSWORD") || "",
      },
    },
  });

  await client.send({
    from: FROM_EMAIL,
    to,
    subject,
    content: "Please view this email in an HTML-capable client.",
    html,
  });

  await client.close();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    if (type === "order") {
      const customerEmail = data.customer_email;
      const subject = data.order_number
        ? `Order ${data.order_number} Confirmed — WAYS River Sand`
        : "Order Confirmed — WAYS River Sand";

      const promises: Promise<void>[] = [
        sendMail(FROM_EMAIL, `🔔 New Order ${data.order_number || ""}`.trim(), orderInternalEmail(data)),
      ];
      if (customerEmail) {
        promises.push(sendMail(customerEmail, subject, orderCustomerEmail(data)));
      }
      await Promise.all(promises);

    } else if (type === "contact") {
      const customerEmail = data.email;
      const promises: Promise<void>[] = [
        sendMail(FROM_EMAIL, `📬 Contact Form: ${data.name || "Website Visitor"}`, contactInternalEmail(data)),
      ];
      if (customerEmail) {
        promises.push(sendMail(customerEmail, "We received your message — WAYS River Sand", contactCustomerEmail(data)));
      }
      await Promise.all(promises);

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid email type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
