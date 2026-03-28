import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAND_COLOR = "#0D2137";
const BRAND_GOLD = "#C07A00";
const BRAND_RED = "#C21F32";
const FROM = "River Sand <no_reply@riversand.net>";
const REPLY_TO = "no_reply@riversand.net";
const INTERNAL_EMAIL = "cmo@haulogix.us";
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
    <p><a href="tel:+18554689297">${PHONE}</a> &bull; <a href="mailto:no_reply@riversand.net">no_reply@riversand.net</a></p>
    <p><a href="https://riversand.net">riversand.net</a></p>
  </div>
</div></body></html>`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00"));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function paymentMethodLabel(method: string): string {
  if (method === "stripe-link" || method === "card") return "Credit Card";
  if (method === "check") return "Check";
  return "Cash";
}

function invoiceBlock(order: any): string {
  const orderNumber = order.order_number || "N/A";
  const invoiceDate = formatDate(order.created_at);
  const isCard = order.payment_method === "stripe-link" || order.payment_method === "card";
  const dueDate = isCard
    ? `Paid — ${invoiceDate}`
    : `Due at delivery — ${formatDate(order.delivery_date)}`;

  const basePrice = 195;
  const qty = order.quantity || 1;
  const baseLine = basePrice * qty;

  const distanceMiles = Number(order.distance_miles || 0);
  const distanceFee = distanceMiles > 15 ? parseFloat(((distanceMiles - 15) * 3.49 * qty).toFixed(2)) : 0;

  const satSurcharge = order.saturday_surcharge ? (order.saturday_surcharge_amount || 35) : 0;

  const total = Number(order.price || 0).toFixed(2);

  const paymentStatus = isCard ? "PAID — Thank you" : "PAYMENT DUE AT DELIVERY";
  const amountDue = isCard ? "$0.00" : `$${total}`;

  let lineItems = `
    <tr>
      <td style="padding:10px;border:1px solid #DDDDDD;color:${BRAND_COLOR}">River Sand — 9 cu/yd load, delivered</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:center">${qty}</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:right">$195.00</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:right">$${baseLine.toFixed(2)}</td>
    </tr>`;

  if (distanceFee > 0) {
    lineItems += `
    <tr>
      <td style="padding:10px;border:1px solid #DDDDDD;color:${BRAND_COLOR}">Distance delivery fee</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:center">1</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:right">$${distanceFee.toFixed(2)}</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:right">$${distanceFee.toFixed(2)}</td>
    </tr>`;
  }

  if (satSurcharge > 0) {
    lineItems += `
    <tr>
      <td style="padding:10px;border:1px solid #DDDDDD;color:${BRAND_COLOR}">Saturday delivery surcharge</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:center">1</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:right">$${Number(satSurcharge).toFixed(2)}</td>
      <td style="padding:10px;border:1px solid #DDDDDD;text-align:right">$${Number(satSurcharge).toFixed(2)}</td>
    </tr>`;
  }

  return `
  <div style="margin-top:32px;border:1px solid #DDDDDD;border-radius:8px;overflow:hidden">
    <div style="background:#F2F2F2;padding:24px;border-bottom:1px solid #DDDDDD">
      <h2 style="margin:0 0 16px;color:${BRAND_COLOR};font-size:22px;letter-spacing:2px">INVOICE</h2>
      <p style="margin:4px 0;color:${BRAND_COLOR};font-size:14px"><strong>Ways Materials, LLC</strong></p>
      <p style="margin:2px 0;color:#555;font-size:13px">Bridge City, Louisiana</p>
      <p style="margin:2px 0;color:#555;font-size:13px">Phone: ${PHONE}</p>
      <p style="margin:2px 0;color:#555;font-size:13px">Website: riversand.net</p>
      <table style="margin-top:12px;font-size:13px;color:#555">
        <tr><td style="padding:2px 12px 2px 0;font-weight:600;color:${BRAND_COLOR}">Invoice Number:</td><td>${orderNumber}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;font-weight:600;color:${BRAND_COLOR}">Invoice Date:</td><td>${invoiceDate}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;font-weight:600;color:${BRAND_COLOR}">Due Date:</td><td>${dueDate}</td></tr>
      </table>
    </div>

    <div style="padding:20px 24px;border-bottom:1px solid #DDDDDD">
      <p style="margin:0 0 8px;font-weight:600;color:${BRAND_COLOR};font-size:13px;text-transform:uppercase;letter-spacing:1px">Bill To:</p>
      <p style="margin:2px 0;color:#555;font-size:14px">${order.customer_name || ""}</p>
      <p style="margin:2px 0;color:#555;font-size:14px">${order.delivery_address || ""}</p>
      ${order.customer_email ? `<p style="margin:2px 0;color:#555;font-size:14px">${order.customer_email}</p>` : ""}
      ${order.customer_phone ? `<p style="margin:2px 0;color:#555;font-size:14px">${order.customer_phone}</p>` : ""}
    </div>

    <div style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#F2F2F2">
            <th style="padding:10px;border:1px solid #DDDDDD;text-align:left;color:${BRAND_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:1px">Description</th>
            <th style="padding:10px;border:1px solid #DDDDDD;text-align:center;color:${BRAND_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:1px">Qty</th>
            <th style="padding:10px;border:1px solid #DDDDDD;text-align:right;color:${BRAND_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:1px">Unit Price</th>
            <th style="padding:10px;border:1px solid #DDDDDD;text-align:right;color:${BRAND_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:1px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems}
          <tr style="background:${BRAND_GOLD}15">
            <td colspan="3" style="padding:12px 10px;border:1px solid #DDDDDD;font-weight:700;color:${BRAND_COLOR};text-align:right;font-size:15px">TOTAL</td>
            <td style="padding:12px 10px;border:1px solid #DDDDDD;font-weight:700;color:${BRAND_GOLD};text-align:right;font-size:15px">$${total}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="padding:20px 24px;border-top:1px solid #DDDDDD">
      <table style="font-size:14px;color:#555">
        <tr><td style="padding:3px 12px 3px 0;font-weight:600;color:${BRAND_COLOR}">Payment Method:</td><td>${paymentMethodLabel(order.payment_method)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;font-weight:600;color:${BRAND_COLOR}">Payment Status:</td><td style="font-weight:600;color:${isCard ? "#22C55E" : BRAND_GOLD}">${paymentStatus}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;font-weight:600;color:${BRAND_COLOR}">Amount Due at Delivery:</td><td style="font-weight:600">${amountDue}</td></tr>
      </table>
    </div>

    <div style="background:#F2F2F2;padding:16px 24px;border-top:1px solid #DDDDDD">
      <p style="margin:0;color:#777;font-size:12px;line-height:1.5">This invoice is issued by Ways Materials, LLC operating as River Sand (riversand.net). For questions contact us at ${PHONE} or no_reply@riversand.net.</p>
      <p style="margin:8px 0 0;color:#999;font-size:11px">Powered by Haulogix, LLC</p>
    </div>
  </div>`;
}

function orderCustomerEmail(order: any) {
  const rows = [
    ["Product", "River Sand — 9 cu yd load"],
    ["Quantity", `${order.quantity} load${order.quantity > 1 ? "s" : ""}`],
    ["Delivery Address", order.delivery_address],
    ["Delivery Date", formatDate(order.delivery_date)],
    ["Delivery Window", order.delivery_window || "8:00 AM – 5:00 PM"],
    ["Total Price", `$${Number(order.price).toFixed(2)}`],
    ["Payment Method", paymentMethodLabel(order.payment_method)],
  ];
  if (order.order_number) rows.unshift(["Order #", order.order_number]);

  const tableRows = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  return emailWrapper(`
    <h2>Order Confirmed! 🎉</h2>
    <p>Thank you for your order${order.customer_name ? ", " + order.customer_name : ""}! Here's your order summary:</p>
    <table class="info-table">${tableRows}</table>
    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""}
    ${invoiceBlock(order)}
    <p style="margin-top:24px">If you have any questions, call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a>.</p>
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

async function sendMail(resend: InstanceType<typeof Resend>, to: string, subject: string, html: string) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
  });
  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error(error.message || "Resend send failed");
  }
  console.log("[email] Sent to:", to, "| Resend ID:", data?.id);
}

serve(async (req) => {
  console.log("[send-email] Function invoked, method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    console.log("[send-email] RESEND_API_KEY set:", !!resendKey);
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(resendKey);
    const { type, data } = await req.json();
    console.log("[send-email] Email type:", type);

    const ownerEmail = Deno.env.get("GMAIL_USER") || INTERNAL_EMAIL;

    if (type === "order" || type === "order_confirmation") {
      const customerEmail = data.customer_email;
      const subject = data.order_number
        ? `Order ${data.order_number} Confirmed — WAYS River Sand`
        : "Order Confirmed — WAYS River Sand";

      const promises: Promise<void>[] = [
        sendMail(resend, ownerEmail, `🔔 New Order ${data.order_number || ""}`.trim(), orderInternalEmail(data)),
      ];
      if (customerEmail) {
        promises.push(sendMail(resend, customerEmail, subject, orderCustomerEmail(data)));
      }
      await Promise.all(promises);
      console.log("[email] Customer email sent to:", customerEmail);
      console.log("[email] Owner email sent to:", ownerEmail);

    } else if (type === "contact") {
      const customerEmail = data.email;
      const promises: Promise<void>[] = [
        sendMail(resend, ownerEmail, `📬 Contact Form: ${data.name || "Website Visitor"}`, contactInternalEmail(data)),
      ];
      if (customerEmail) {
        promises.push(sendMail(resend, customerEmail, "We received your message — WAYS River Sand", contactCustomerEmail(data)));
      }
      await Promise.all(promises);
      console.log("[email] Customer email sent to:", customerEmail);
      console.log("[email] Owner email sent to:", ownerEmail);

    } else if (type === "callback") {
      const rows = [
        ["Name", data.name || "Not provided"],
        ["Phone", data.phone || "Not provided"],
        ["Requested Date", data.date || "Not specified"],
        ["Time Window", data.time_window || "ASAP"],
      ];
      if (data.notes) rows.push(["Notes", data.notes]);
      const tableRows = rows.map(([k, v]: string[]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

      const callbackHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden}
  .header{background:${BRAND_RED};padding:24px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:2px}
  .body{padding:32px 24px}
  .body h2{color:${BRAND_RED};margin:0 0 16px}
  .body p,.body td{color:#555;font-size:15px;line-height:1.6}
  .info-table{width:100%;border-collapse:collapse;margin:16px 0}
  .info-table td{padding:8px 0;border-bottom:1px solid #eee}
  .info-table td:first-child{font-weight:600;color:${BRAND_COLOR};width:40%}
  .footer{background:#f9f9f9;padding:20px 24px;text-align:center;font-size:13px;color:#999}
  .footer a{color:${BRAND_COLOR};text-decoration:none}
</style></head><body>
<div class="container">
  <div class="header"><h1>🔴 CALLBACK REQUEST</h1></div>
  <div class="body">
    <h2>Customer wants a callback!</h2>
    <table class="info-table">${tableRows}</table>
    <p style="background:#fff3f3;padding:12px;border-radius:6px;border-left:4px solid ${BRAND_RED};color:${BRAND_RED};font-weight:600">Please call this customer back as soon as possible.</p>
  </div>
  <div class="footer">
    <p>WAYS River Sand &bull; Greater New Orleans, LA</p>
  </div>
</div></body></html>`;

      await sendMail(resend, ownerEmail, `🔴 URGENT: Callback Request — ${data.name || "Customer"}`, callbackHtml);
      console.log("[email] Callback email sent to:", ownerEmail);

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
