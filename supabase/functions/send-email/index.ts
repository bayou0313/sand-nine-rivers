import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAND_COLOR = "#0D2137";
const BRAND_GOLD = "#C07A00";
const BRAND_RED = "#C21F32";
// Module-level defaults — used by template functions defined outside serve()
// Runtime values from global_settings override these inside the serve handler
let PHONE = "1-855-GOT-WAYS";
let WEBSITE = "riversand.net";
let LEGAL_NAME = "WAYS® Materials LLC";
let SUPPORT_EMAIL = "orders@riversand.net";
let SITE_NAME = "River Sand";
let COPYRIGHT_YEAR = "2026";
let TAGLINE = "Real Sand. Real People.";

// Defaults — overridden by global_settings at runtime
const DEFAULT_FROM_NAME = "River Sand";
const DEFAULT_FROM_EMAIL = "no_reply@riversand.net";
const DEFAULT_REPLY_TO = "orders@riversand.net";
const DEFAULT_INTERNAL_EMAIL = "cmo@haulogix.com";
const DEFAULT_DISPATCH_EMAIL = "cmo@halogix.com";

const RIVERSAND_WHITE_LOGO = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";
const WAYS_WHITE_LOGO = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO___-__WHITE.png.png";
const RIVERSAND_ICON = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/RIVERSAND_-_ICON_-_512.png.png";

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

function fmt(n: number): string {
  return n.toFixed(2);
}

function orderCustomerEmail(order: any, feePercent = 3.5, feeFixed = 0.30): string {
  const customerName = order.customer_name || "there";
  const orderNumber = order.order_number || "N/A";
  const deliveryAddress = order.delivery_address || "";
  const deliveryDate = formatDate(order.delivery_date);
  const qty = order.quantity || 1;
  const isStripePaid = order.payment_method === "stripe-link" || order.payment_method === "card";
  const customerEmail = order.customer_email || "";

  const basePrice = 195;
  const baseLine = basePrice * qty;
  const satSurcharge = order.saturday_surcharge ? (order.saturday_surcharge_amount || 0) : 0;
  const taxAmount = Number(order.tax_amount || 0);
  const taxParish = order.tax_parish || "";
  const taxRate = (Number(order.tax_rate || 0) * 100).toFixed(2);
  const totalPrice = fmt(Number(order.price || 0));

  // Calculate processing fee for stripe
  const subtotalBeforeFee = baseLine + satSurcharge + taxAmount;
  const distanceMiles = Number(order.distance_miles || 0);
  const distanceFee = distanceMiles > 15 ? (distanceMiles - 15) * 5.5 * qty : 0;
  const subtotalWithDist = subtotalBeforeFee + distanceFee;
  const processingFeeAmt = isStripePaid ? Math.max(0, Number(order.price) - subtotalWithDist) : 0;
  const processingFee = fmt(processingFeeAmt);
  const totalWithFee = fmt(Number(order.price || 0));
  const stripeReference = order.stripe_payment_id || "";
  const paymentMethod = paymentMethodLabel(order.payment_method);

  // Saturday row
  const satRow = satSurcharge > 0 ? `
                    <tr>
                      <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">
                        Saturday Surcharge
                      </td>
                      <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">
                        $${fmt(satSurcharge)}
                      </td>
                    </tr>` : "";

  // Distance fee row
  const distRow = distanceFee > 0 ? `
                    <tr>
                      <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">
                        Extended area surcharge
                      </td>
                      <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">
                        $${fmt(distanceFee)}
                      </td>
                    </tr>` : "";

  // Processing fee row (stripe only) — uses dynamic fee settings
  const feeRow = isStripePaid && processingFeeAmt > 0.01 ? `
                    <tr>
                      <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">
                        Processing Fee
                      </td>
                      <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">
                        $${processingFee}
                      </td>
                    </tr>` : "";

  // Stripe reference row
  const refRow = stripeReference ? `
                    <tr>
                      <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">
                        Reference
                      </td>
                      <td style="padding:10px 16px;font-size:13px;color:#999;text-align:right;font-family:monospace;border-bottom:1px solid #E8E5DD;">
                        ${stripeReference}
                      </td>
                    </tr>` : "";

  // Payment status rows
  const paymentStatusRow = isStripePaid
    ? `<tr>
                      <td colspan="2" style="padding:10px 16px;font-size:14px;color:#22C55E;font-weight:600;">
                        Nothing due at delivery
                      </td>
                    </tr>`
    : `<tr>
                      <td colspan="2" style="padding:10px 16px;font-size:14px;color:#D97706;font-weight:600;">
                        Please have exact $${totalPrice} ready
                        — driver carries no change
                      </td>
                    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
    <body style="margin:0;padding:0;background-color:#F0EDE5;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0EDE5;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- HEADER -->
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:36px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align:left;width:45%;">
                      <img src="${RIVERSAND_WHITE_LOGO}" alt="River Sand" width="200" style="display:block;max-width:200px;height:auto;">
                    </td>
                    <td style="text-align:right;width:45%;">
                      <img src="${WAYS_WHITE_LOGO}" alt="WAYS" width="80" style="display:block;max-width:80px;height:auto;margin-left:auto;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- GOLD DIVIDER -->
            <tr><td style="height:3px;background-color:${BRAND_GOLD};"></td></tr>

            <!-- PAYMENT STATUS BANNER -->
            <tr>
              <td style="background-color:${isStripePaid ? '#F0FDF4' : '#FFFBEB'};padding:20px 32px;text-align:center;border-bottom:1px solid ${isStripePaid ? '#BBF7D0' : '#FDE68A'};">
                <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${isStripePaid ? '#166534' : '#92400E'};">
                  ${isStripePaid ? 'PAYMENT CONFIRMED' : 'PAYMENT DUE AT DELIVERY'}
                </p>
                <p style="margin:0;font-size:14px;color:${isStripePaid ? '#15803D' : '#B45309'};">
                  ${isStripePaid
                    ? 'Your card has been charged. Nothing due at delivery.'
                    : `Please have $${totalPrice} ready. Driver carries no change.`}
                </p>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="background-color:#FFFFFF;padding:32px;">

                <!-- Greeting -->
                <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${BRAND_COLOR};">
                  Hi ${customerName}!
                </p>
                <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                  Your river sand delivery is confirmed. Here's everything you need to know.
                </p>

                <!-- ORDER DETAILS -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E8E5DD;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="background-color:#F8F7F2;padding:12px 16px;border-bottom:1px solid #E8E5DD;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1px;text-transform:uppercase;">
                        ORDER DETAILS
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">Order Number</td>
                          <td style="padding:10px 16px;font-size:14px;color:${BRAND_GOLD};text-align:right;font-weight:700;font-family:monospace;border-bottom:1px solid #E8E5DD;">${orderNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">Product</td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">River Sand — 9 Cubic Yard Load</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;">Quantity</td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;">${qty} load${qty > 1 ? 's' : ''}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- DELIVERY INFO -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E8E5DD;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="background-color:#F8F7F2;padding:12px 16px;border-bottom:1px solid #E8E5DD;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1px;text-transform:uppercase;">
                        DELIVERY
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">Address</td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">${deliveryAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">Delivery Date</td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">${deliveryDate}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;">Window</td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;">8:00 AM – 5:00 PM</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- PRICING SUMMARY -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E8E5DD;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="background-color:#F8F7F2;padding:12px 16px;border-bottom:1px solid #E8E5DD;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1px;text-transform:uppercase;">
                        PRICING SUMMARY
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">
                            River Sand (×${qty})
                          </td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">
                            $${fmt(baseLine)}
                          </td>
                        </tr>
                        ${satRow}
                        ${distRow}
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;${satSurcharge > 0 ? '' : 'background-color:#F8F7F2;'}">
                            Tax (${taxParish} ${taxRate}%)
                          </td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;${satSurcharge > 0 ? '' : 'background-color:#F8F7F2;'}">
                            $${fmt(taxAmount)}
                          </td>
                        </tr>
                        ${feeRow}
                        <tr>
                          <td colspan="2" style="padding:0;"><hr style="border:none;border-top:2px solid ${BRAND_GOLD};margin:0;"></td>
                        </tr>
                        <tr style="background-color:${BRAND_COLOR};">
                          <td style="padding:14px 16px;font-size:16px;font-weight:700;color:#FFFFFF;">
                            ${isStripePaid ? 'TOTAL CHARGED' : 'TOTAL DUE AT DELIVERY'}
                          </td>
                          <td style="padding:14px 16px;font-size:20px;font-weight:700;color:${BRAND_GOLD};text-align:right;">
                            $${totalPrice}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${!isStripePaid ? `
                <!-- COD PAYMENT POLICY -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="background-color:#FEF9C3;border:1px solid #FDE68A;padding:12px 16px;border-radius:8px;">
                      <p style="margin:0 0 6px 0;font-size:11px;font-weight:bold;color:#92400E;text-transform:uppercase;letter-spacing:1px;">Payment Due at Delivery</p>
                      <p style="margin:0 0 8px 0;font-size:13px;color:#78350F;line-height:1.6;">Cash or check payment is due at the time of delivery. If payment cannot be collected, a secure card payment link will be sent automatically.</p>
                      <p style="margin:0;font-size:12px;color:#92400E;">Cash/Check total: <strong>$${fmt(Number(order.price))}</strong> · Card total if needed: <strong>$${fmt(Number(order.price) * (1 + feePercent / 100) + feeFixed)}</strong> (includes ${feePercent}% + $${feeFixed.toFixed(2)} fee)</p>
                    </td>
                  </tr>
                </table>
                ` : ''}

                <!-- PAYMENT -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E8E5DD;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="background-color:#F8F7F2;padding:12px 16px;border-bottom:1px solid #E8E5DD;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1px;text-transform:uppercase;">
                        PAYMENT
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">Method</td>
                          <td style="padding:10px 16px;font-size:14px;color:#333;text-align:right;font-weight:600;border-bottom:1px solid #E8E5DD;">${paymentMethod}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #E8E5DD;">Status</td>
                          <td style="padding:10px 16px;font-size:14px;text-align:right;font-weight:700;border-bottom:1px solid #E8E5DD;color:${isStripePaid ? '#22C55E' : '#D97706'};">
                            ${isStripePaid ? 'PAID IN FULL' : 'DUE AT DELIVERY'}
                          </td>
                        </tr>
                        ${refRow}
                        ${paymentStatusRow}
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- DELIVERY INSTRUCTIONS -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E8E5DD;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="background-color:#F8F7F2;padding:12px 16px;border-bottom:1px solid #E8E5DD;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:${BRAND_COLOR};letter-spacing:1px;text-transform:uppercase;">
                        DELIVERY INSTRUCTIONS
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr><td style="padding:4px 0;font-size:13px;color:#555;">Our driver will call 30 minutes before arrival</td></tr>
                        <tr><td style="padding:4px 0;font-size:13px;color:#555;">Please ensure clear access to delivery area</td></tr>
                        <tr><td style="padding:4px 0;font-size:13px;color:#555;">Someone must be present to receive delivery</td></tr>
                        <tr><td style="padding:4px 0;font-size:13px;color:#555;">Delivery is curbside — curb to sidewalk/driveway</td></tr>
                        <tr><td style="padding:4px 0;font-size:13px;color:#C21F32;">Driver will not enter backyard or gated areas</td></tr>
                        <tr><td style="padding:4px 0;font-size:13px;color:#C21F32;">${LEGAL_NAME} not responsible for property damage</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CANCELLATION POLICY -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #E8E5DD;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="padding:16px 24px;border-top:1px solid #E8E5DC;">
                       <p style="font-size:11px;font-weight:bold;color:#0D2137;letter-spacing:1px;margin:0 0 6px 0;text-transform:uppercase;">
                         Cancellation Policy
                       </p>
                       <p style="font-size:12px;color:#666666;margin:0;line-height:1.6;">
                         Orders canceled a day before scheduled delivery will be refunded in full. Processing fees are non-refundable.
                       </p>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="text-align:center;">
                      <a href="https://${WEBSITE}" style="display:inline-block;background-color:${BRAND_GOLD};color:#FFFFFF;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;">
                        VIEW ORDER DETAILS
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- CONTACT -->
                <p style="margin:0 0 8px;font-size:14px;color:#555;text-align:center;">
                  Questions about your order? We're here to help.
                </p>
                <p style="margin:0 0 4px;text-align:center;">
                  <a href="tel:+18554689297" style="color:${BRAND_COLOR};font-size:15px;font-weight:700;text-decoration:none;">
                    ${PHONE}
                  </a>
                </p>
                <p style="margin:0;text-align:center;">
                  <a href="mailto:${SUPPORT_EMAIL}" style="color:#666;font-size:13px;text-decoration:none;">
                    ${SUPPORT_EMAIL}
                  </a>
                </p>

              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:#060F1A;padding:24px 32px;text-align:center;">
                <img src="${WAYS_WHITE_LOGO}" alt="WAYS" width="64" style="display:block;margin:0 auto 10px;width:64px;height:auto;opacity:0.45;">
                <p style="margin:0 0 4px;color:rgba(255,255,255,0.25);font-size:9px;letter-spacing:1px;">
                  © ${COPYRIGHT_YEAR} ${LEGAL_NAME}
                </p>
                <p style="margin:0;color:rgba(255,255,255,0.3);font-size:10px;">
                  This email was sent to ${customerEmail} because you placed an order at ${WEBSITE}
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function orderDispatchEmail(data: any): string {
  const isPaid = data.payment_status === "paid" ||
    data.payment_method === "stripe-link" ||
    data.payment_method === "stripe";
  const amount = data.total_price || data.price || 0;
  const orderNum = data.order_number || "—";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.delivery_address || "")}`;
  const phone = data.customer_phone || "";
  const telUrl = `tel:${phone.replace(/\D/g, "")}`;
  const deliveryDate = data.delivery_date
    ? new Date(data.delivery_date + "T12:00:00")
        .toLocaleDateString("en-US", {
          weekday: "long", month: "long",
          day: "numeric", year: "numeric"
        })
    : "—";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0A1628;
  font-family:'Courier New',Courier,monospace;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:20px 16px;">
<table width="560" cellpadding="0" cellspacing="0"
  style="max-width:560px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0D2137;
    padding:28px 32px 20px;
    border-radius:12px 12px 0 0;
    text-align:center;
    border-bottom:2px solid #C07A00;">
    <img src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png"
      alt="River Sand" width="180"
      style="display:block;margin:0 auto 12px auto;" />
    <p style="color:rgba(192,122,0,0.7);font-size:9px;
      margin:0;letter-spacing:4px;
      text-transform:uppercase;">
      ORDER NOTIFICATION
    </p>
  </td></tr>

  <!-- STATUS + AMOUNT -->
  <tr><td style="background:${isPaid ? '#052E16' : '#431407'};
    padding:20px 32px;text-align:center;">
    <span style="background:${isPaid ? '#10B981' : '#F59E0B'};
      color:#000;padding:5px 16px;border-radius:4px;
      font-size:11px;font-weight:bold;letter-spacing:3px;">
      ${isPaid ? '● PAID IN FULL' : '● COD — COLLECT AT DELIVERY'}
    </span>
    <p style="color:${isPaid ? '#6EE7B7' : '#FCD34D'};
      font-size:28px;font-weight:bold;
      margin:10px 0 0 0;letter-spacing:1px;">
      $${Number(amount).toFixed(2)}
    </p>
  </td></tr>

  <!-- ORDER NUMBER + DATE -->
  <tr><td style="background:#142845;
    padding:12px 32px;
    border-bottom:1px solid #1E3A5F;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="color:#4A7A9B;font-size:8px;
          letter-spacing:3px;">ORDER #</td>
        <td style="color:#4A7A9B;font-size:8px;
          letter-spacing:3px;text-align:right;">
          PLACED</td>
      </tr>
      <tr>
        <td style="color:#C07A00;font-size:18px;
          font-weight:bold;">${orderNum}</td>
        <td style="color:#FFFFFF;font-size:11px;
          text-align:right;">
          ${new Date().toLocaleDateString("en-US", {
            month: "short", day: "numeric",
            year: "numeric"
          })}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CUSTOMER -->
  <tr><td style="background:#0F1F35;
    padding:20px 32px;
    border-bottom:1px solid #1E3A5F;">
    <p style="color:#4A7A9B;font-size:8px;
      margin:0 0 10px 0;letter-spacing:3px;">
      CUSTOMER</p>
    <p style="color:#FFFFFF;font-size:20px;
      font-weight:bold;margin:0 0 12px 0;">
      ${data.customer_name || "—"}</p>
    <a href="${telUrl}"
      style="display:inline-block;
      background:#C07A00;color:#FFFFFF;
      padding:12px 28px;border-radius:6px;
      text-decoration:none;font-size:20px;
      font-weight:bold;letter-spacing:1px;">
      ${phone}
    </a>
    ${data.customer_email ? `
    <p style="color:#6B9DB8;font-size:11px;
      margin:10px 0 0 0;">
      ${data.customer_email}</p>` : ""}
  </td></tr>

  <!-- DELIVERY -->
  <tr><td style="background:#0D2137;
    padding:20px 32px;
    border-bottom:1px solid #1E3A5F;">
    <p style="color:#4A7A9B;font-size:8px;
      margin:0 0 10px 0;letter-spacing:3px;">
      DELIVERY</p>
    <p style="color:#FFFFFF;font-size:15px;
      font-weight:bold;margin:0 0 4px 0;">
      ${deliveryDate}</p>
    <p style="color:#6B9DB8;font-size:11px;
      margin:0 0 14px 0;">
      8:00 AM – 5:00 PM window</p>
    <a href="${mapsUrl}"
      style="display:inline-block;
      background:#142845;color:#C07A00;
      padding:10px 20px;border-radius:6px;
      text-decoration:none;font-size:11px;
      font-weight:bold;
      border:1px solid #C07A00;
      letter-spacing:2px;">
      OPEN IN GOOGLE MAPS
    </a>
    <p style="color:rgba(255,255,255,0.5);
      font-size:11px;margin:10px 0 0 0;">
      ${data.delivery_address || "—"}</p>
  </td></tr>

  <!-- ORDER DETAILS -->
  <tr><td style="background:#0F1F35;
    padding:20px 32px;
    border-bottom:1px solid #1E3A5F;">
    <p style="color:#4A7A9B;font-size:8px;
      margin:0 0 10px 0;letter-spacing:3px;">
      ORDER DETAILS</p>
    <table width="100%" cellpadding="5"
      cellspacing="0">
      <tr>
        <td style="color:#4A7A9B;font-size:10px;
          width:35%;">PRODUCT</td>
        <td style="color:#FFFFFF;font-size:10px;">
          River Sand — 9 cu yd
          × ${data.quantity || 1} load${(data.quantity||1)>1?"s":""}</td>
      </tr>
      <tr>
        <td style="color:#4A7A9B;font-size:10px;">
          DISTANCE</td>
        <td style="color:#FFFFFF;font-size:10px;">
          ${data.distance_miles
            ? Number(data.distance_miles).toFixed(1)+" mi"
            : "—"}</td>
      </tr>
      <tr>
        <td style="color:#4A7A9B;font-size:10px;">
          PAYMENT</td>
        <td style="color:${isPaid?"#10B981":"#F59E0B"};
          font-size:10px;font-weight:bold;">
          ${isPaid
            ? "PAID — CREDIT CARD"
            : "COD — COLLECT $"+Number(amount).toFixed(2)}</td>
      </tr>
      ${data.notes ? `<tr>
        <td style="color:#4A7A9B;font-size:10px;">
          NOTES</td>
        <td style="color:#FCD34D;font-size:10px;">
          ${data.notes}</td>
      </tr>` : ""}
    </table>
  </td></tr>

  <!-- DASHBOARD BUTTON -->
  <tr><td style="background:#0D2137;
    padding:20px 32px;text-align:center;">
    <a href="https://riversand.net/leads"
      style="display:inline-block;
      background:#C07A00;color:#FFFFFF;
      padding:14px 40px;border-radius:6px;
      text-decoration:none;font-size:12px;
      font-weight:bold;letter-spacing:3px;">
      OPEN DASHBOARD
    </a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#060F1A;
    padding:24px 32px;
    border-radius:0 0 12px 12px;
    text-align:center;
    border-top:1px solid #1E3A5F;">
    <img src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO___-__WHITE.png.png"
      alt="WAYS" width="64"
      style="display:block;margin:0 auto 10px auto;
      opacity:0.45;" />
    <p style="color:rgba(255,255,255,0.25);
      font-size:9px;margin:0;letter-spacing:1px;">
      © ${COPYRIGHT_YEAR} ${LEGAL_NAME}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Keep existing helper functions for other email types
function brandedEmailWrapper(options: {
  content: string;
  productLogoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaText?: string;
  ctaUrl?: string;
  bizPhone?: string;
  bizEmail?: string;
  bizWebsite?: string;
  bizLegalName?: string;
}) {
  const logo = options.productLogoUrl || RIVERSAND_WHITE_LOGO;
  const primary = options.primaryColor || BRAND_COLOR;
  const accent = options.accentColor || "#C8A44A";
  const WAYS_LOGO = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO.png.png";
  const phone = options.bizPhone || DEFAULT_PHONE;
  const email = options.bizEmail || DEFAULT_SUPPORT_EMAIL;
  const website = options.bizWebsite || DEFAULT_WEBSITE;
  const legalName = options.bizLegalName || DEFAULT_LEGAL_NAME;

  const ctaBlock = options.ctaText && options.ctaUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${options.ctaUrl}" style="display:inline-block;background:${accent};color:#FFFFFF!important;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;">${options.ctaText}</a>
      </td></tr>
    </table>` : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background-color:#F0EDE5;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0EDE5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="background-color:${primary};padding:28px 32px;text-align:center;">
    <img src="${logo}" alt="${legalName}" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;">
  </td></tr>

  <!-- GOLD DIVIDER -->
  <tr><td style="height:3px;background-color:${accent};"></td></tr>

  <!-- BODY -->
  <tr><td style="background-color:#FFFFFF;padding:32px;">
    ${options.content}
    ${ctaBlock}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:#F5F5F5;padding:24px 32px;text-align:center;border-top:1px solid #E8E5DD;">
    <img src="${WAYS_LOGO}" alt="WAYS" width="80" style="display:block;margin:0 auto 10px;width:80px;height:auto;opacity:0.6;">
    <p style="margin:0 0 4px;color:#999;font-size:11px;font-weight:600;letter-spacing:1px;">${legalName}</p>
    <p style="margin:0 0 4px;color:#999;font-size:11px;">
      <a href="tel:${phone.replace(/\D/g, "")}" style="color:#666;text-decoration:none;">${phone}</a> &bull;
      <a href="mailto:${email}" style="color:#666;text-decoration:none;">${email}</a>
    </p>
    <p style="margin:0;color:#BBB;font-size:10px;">
      <a href="https://${website}" style="color:#999;text-decoration:none;">${website}</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// Keep old emailWrapper as alias for backward compat
function emailWrapper(body: string, bizOverrides?: { bizPhone?: string; bizEmail?: string; bizWebsite?: string; bizLegalName?: string }) {
  return brandedEmailWrapper({ content: body, ...bizOverrides });
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
    ["Tax", `$${Number(order.tax_amount || 0).toFixed(2)} (${(Number(order.tax_rate || 0) * 100).toFixed(2)}% — ${order.tax_parish || "N/A"})`],
    ["Total Price", `$${Number(order.price).toFixed(2)}`],
    ["Payment", order.payment_method],
    ["Payment Status", order.payment_status || "pending"],
  ];

  const tableRows = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  return emailWrapper(`
    <h2>New Order Received</h2>
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
    <h2>New Contact Form Submission</h2>
    <table class="info-table">${tableRows}</table>
    <p><strong>Message:</strong></p>
    <p style="background:#f9f9f9;padding:16px;border-radius:6px;border-left:4px solid ${BRAND_GOLD}">${(contact.message || "").replace(/\n/g, "<br>")}</p>
  `);
}

interface SendMailOptions {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
}

async function sendMail(resend: InstanceType<typeof Resend>, to: string, subject: string, html: string, attachments?: Array<{ filename: string; content: string }>, fromOverride?: string, replyToOverride?: string) {
  const payload: any = {
    from: fromOverride || `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
    to,
    replyTo: replyToOverride || DEFAULT_REPLY_TO,
    subject,
    html,
  };
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error(error.message || "Resend send failed");
  }
  console.log("[email] Sent to:", to, "| Resend ID:", data?.id);
}

async function fetchInvoicePdf(orderNumber: string, lookupToken: string, orderId: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;

    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ order_id: orderId, lookup_token: lookupToken }),
    });

    if (!resp.ok) {
      console.error("[email] Invoice fetch failed:", resp.status);
      return null;
    }

    const arrayBuffer = await resp.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    // Convert to base64
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error("[email] Invoice generation error:", err);
    return null;
  }
}

serve(async (req) => {
  console.log("[send-email] Function invoked, method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch email settings from global_settings
    const sbUrl = Deno.env.get("SUPABASE_URL") || "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sb = createClient(sbUrl, sbKey);
    const { data: settingsData } = await sb
      .from("global_settings")
      .select("key, value")
      .in("key", [
        "email_dispatch", "email_from", "email_from_name", "email_reply_to",
        "card_processing_fee_percent", "card_processing_fee_fixed",
        "legal_name", "site_name", "phone", "website",
        "support_email", "tagline", "copyright_year",
      ]);

    const emailCfg: Record<string, string> = {};
    for (const row of settingsData || []) {
      emailCfg[row.key] = row.value;
    }
    const DISPATCH_EMAIL = emailCfg.email_dispatch || DEFAULT_DISPATCH_EMAIL;
    const FROM_EMAIL = emailCfg.email_from || DEFAULT_FROM_EMAIL;
    const FROM_NAME = emailCfg.email_from_name || DEFAULT_FROM_NAME;
    const REPLY_TO = emailCfg.email_reply_to || DEFAULT_REPLY_TO;
    const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;
    const FEE_PERCENT = parseFloat(emailCfg.card_processing_fee_percent || "3.5");
    const FEE_FIXED = parseFloat(emailCfg.card_processing_fee_fixed || "0.30");
    // Update module-level vars so template functions pick up runtime settings
    PHONE = emailCfg.phone || "1-855-GOT-WAYS";
    WEBSITE = emailCfg.website?.replace(/^https?:\/\//, "") || "riversand.net";
    LEGAL_NAME = emailCfg.legal_name || "WAYS® Materials LLC";
    SUPPORT_EMAIL = emailCfg.support_email || "orders@riversand.net";
    SITE_NAME = emailCfg.site_name || "River Sand";
    COPYRIGHT_YEAR = emailCfg.copyright_year || "2026";
    TAGLINE = emailCfg.tagline || "Real Sand. Real People.";

    // Biz overrides for brandedEmailWrapper calls
    const bizOverrides = { bizPhone: PHONE, bizEmail: SUPPORT_EMAIL, bizWebsite: WEBSITE, bizLegalName: LEGAL_NAME };
    const wrapEmail = (body: string) => emailWrapper(body, bizOverrides);


    const resendKey = Deno.env.get("RESEND_API_KEY");
    console.log("[send-email] RESEND_API_KEY set:", !!resendKey);
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(resendKey);
    const { type, data } = await req.json();
    console.log("[send-email] Email type:", type);

    const ownerEmail = Deno.env.get("GMAIL_USER") || DEFAULT_INTERNAL_EMAIL;

    if (type === "order" || type === "order_confirmation") {
      const customerEmail = data.customer_email;
      const orderNumber = data.order_number || "";
      const subject = orderNumber
        ? `Order ${orderNumber} Confirmed — River Sand Delivery`
        : "Order Confirmed — River Sand Delivery";

      // Try to generate PDF invoice for attachment
      let attachments: Array<{ filename: string; content: string }> | undefined;
      if (data.id && data.lookup_token) {
        const pdfBase64 = await fetchInvoicePdf(orderNumber, data.lookup_token, data.id);
        if (pdfBase64) {
          attachments = [{
            filename: `RiverSand-Order-${orderNumber || "invoice"}.pdf`,
            content: pdfBase64,
          }];
          console.log("[email] PDF invoice attached");
        }
      }

      // Build dispatch subject with payment status
      const isPaidForSubject = data.payment_status === "paid" || data.payment_method === "stripe-link" || data.payment_method === "stripe";
      const dispatchDeliveryDate = data.delivery_date
        ? new Date(data.delivery_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : "—";
      const dispatchSubject = `[${isPaidForSubject ? 'PAID' : 'COD'}] ${orderNumber} — ${data.customer_name || "Customer"} — ${dispatchDeliveryDate}`;

      const promises: Promise<void>[] = [
        sendMail(resend, ownerEmail, `New Order ${orderNumber}`.trim(), orderInternalEmail(data), undefined, FROM, REPLY_TO),
        // Dispatch notification
        sendMail(
          resend,
          DISPATCH_EMAIL,
          dispatchSubject,
          orderDispatchEmail(data),
          undefined, FROM, REPLY_TO
        ),
      ];
      if (customerEmail) {
        promises.push(sendMail(resend, customerEmail, subject, orderCustomerEmail(data, FEE_PERCENT, FEE_FIXED), attachments, FROM, REPLY_TO));
      }
      await Promise.all(promises);
      console.log("[email] Customer email sent to:", customerEmail);
      console.log("[email] Owner email sent to:", ownerEmail);
      console.log("[email] Dispatch email sent to:", DISPATCH_EMAIL);

    } else if (type === "order_notification") {
      // Standalone dispatch notification
      const orderNumber = data.order_number || "";
      const isPaidForSubject = data.payment_status === "paid" || data.payment_method === "stripe-link" || data.payment_method === "stripe";
      const dispatchDeliveryDate = data.delivery_date
        ? new Date(data.delivery_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : "—";
      const dispatchSubject = `[${isPaidForSubject ? 'PAID' : 'COD'}] ${orderNumber} — ${data.customer_name || "Customer"} — ${dispatchDeliveryDate}`;
      await sendMail(
        resend,
        DISPATCH_EMAIL,
        dispatchSubject,
        orderDispatchEmail(data),
        undefined, FROM, REPLY_TO
      );
      console.log("[email] Dispatch notification sent to:", DISPATCH_EMAIL);

    } else if (type === "contact") {
      const customerEmail = data.email;
      const promises: Promise<void>[] = [
        sendMail(resend, ownerEmail, `New Contact Form: ${data.name || "Website Visitor"}`, contactInternalEmail(data), undefined, FROM, REPLY_TO),
      ];
      if (customerEmail) {
        promises.push(sendMail(resend, customerEmail, "We received your message — WAYS River Sand", contactCustomerEmail(data), undefined, FROM, REPLY_TO));
      }
      await Promise.all(promises);
      console.log("[email] Customer email sent to:", customerEmail);
      console.log("[email] Owner email sent to:", ownerEmail);

      // Contact form notification
      try {
        const sbNotif = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await sbNotif.from("notifications").insert({
          type: "contact_form",
          title: "Contact Form",
          message: `${data.name || "Someone"} submitted a contact form`,
          entity_type: "contact",
          entity_id: null,
        });
      } catch (notifErr) { console.error("[email] Notification insert error:", notifErr); }

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
  <div class="header"><h1>CALLBACK REQUEST</h1></div>
  <div class="body">
    <h2>Customer wants a callback!</h2>
    <table class="info-table">${tableRows}</table>
    <p style="background:#fff3f3;padding:12px;border-radius:6px;border-left:4px solid ${BRAND_RED};color:${BRAND_RED};font-weight:600">Please call this customer back as soon as possible.</p>
  </div>
  <div class="footer">
    <p>© ${COPYRIGHT_YEAR} ${LEGAL_NAME}</p>
  </div>
</div></body></html>`;

      await sendMail(resend, ownerEmail, `URGENT: Callback Request — ${data.name || "Customer"}`, callbackHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Callback email sent to:", ownerEmail);

    } else if (type === "out_of_area_lead") {
      const leadHtml = `
NEW OUT-OF-AREA DELIVERY LEAD
─────────────────────────────
Address:  ${data.address || "N/A"}
Distance: ${data.distance_miles || "?"} miles

CONTACT
Name:  ${data.customer_name || "N/A"}
Email: ${data.customer_email || "Not provided"}
Phone: ${data.customer_phone || "Not provided"}

Submitted: ${data.created_at ? new Date(data.created_at).toLocaleString("en-US") : "N/A"}
─────────────────────────────
${WEBSITE} | ${PHONE} | ${LEGAL_NAME}`.trim();

      await sendMail(
        resend,
        ownerEmail,
        `New Out-of-Area Lead — ${data.address || "Unknown"}`,
        `<pre style="font-family:monospace;font-size:14px;line-height:1.6;white-space:pre-wrap">${leadHtml}</pre>`,
        undefined, FROM, REPLY_TO
      );
      console.log("[email] Out-of-area lead notification sent to:", ownerEmail);

    } else if (type === "pit_proposal") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const customNoteHtml = data.custom_note
        ? `<p style="font-size:15px;color:#555;line-height:1.6;background:#FFF8E7;padding:16px;border-radius:8px;border-left:4px solid ${BRAND_GOLD};margin:16px 0">${data.custom_note}</p>`
        : "";
      const proposalHtml = emailWrapper(`
        <p style="font-size:16px;color:#555;line-height:1.6">Hi ${firstName},</p>
        <p style="font-size:16px;color:#555;line-height:1.6">Good news — <strong>River Sand now delivers near ${data.zip_code || "your area"}</strong>!</p>
        
        <div style="border:2px solid ${BRAND_GOLD};border-radius:12px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0 0 8px;font-size:14px;color:#555;text-transform:uppercase;letter-spacing:1px">River Sand — 9 Cubic Yards</p>
          <p style="margin:0 0 4px;font-size:13px;color:#777">Delivered to: ${data.delivery_address || ""}</p>
          <p style="margin:16px 0 0;font-size:32px;font-weight:700;color:${BRAND_GOLD}">$${Number(data.new_price || 195).toFixed(2)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999">Your price, delivered</p>
        </div>

        ${customNoteHtml}

        <div style="text-align:center;margin:24px 0">
          <a href="${data.order_url || "https://riversand.net/order"}" style="display:inline-block;background:${BRAND_GOLD};color:#fff!important;padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:1px">ORDER NOW — $${Number(data.new_price || 195).toFixed(2)} DELIVERED</a>
        </div>

        <p style="font-size:14px;color:#555;line-height:1.8">Click the button above to place your order instantly — your address is already filled in.<br>
        Same-day delivery available Monday–Friday.<br>
        No account needed. Pay by card, cash, or check.</p>

        <p style="font-size:14px;color:#555;line-height:1.8">Questions? Call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a> — we're real people and happy to help.</p>

        <div style="border-top:1px solid #E0DDD5;padding-top:16px;margin-top:24px">
          <p style="margin:0;font-weight:500;color:${BRAND_COLOR}">Silas Caldeira</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Founder & CEO</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">${LEGAL_NAME}</p>
          <p style="margin:4px 0 0;font-size:12px"><a href="https://${WEBSITE}" style="color:#1A6BB8;text-decoration:none">${WEBSITE}</a> | ${PHONE}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">New Orleans, Louisiana</p>
        </div>
      `);

      await sendMail(
        resend,
        data.customer_email,
        `River Sand is now available near ${data.zip_code || "you"} — Your price: $${Number(data.new_price || 195).toFixed(2)}`,
        proposalHtml,
        undefined, FROM, REPLY_TO
      );
      console.log("[email] Pit proposal sent to:", data.customer_email);

    } else if (type === "cash_payment_confirmed") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const method = data.payment_method === "check" ? "Check" : "Cash";
      const total = Number(data.price || 0).toFixed(2);
      const recordedAt = data.cash_collected_at ? new Date(data.cash_collected_at).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : new Date().toLocaleString("en-US");

      const cashHtml = emailWrapper(`
        <p style="font-size:16px;color:#555;line-height:1.6">Hi ${firstName},</p>
        <p style="font-size:15px;color:#555;line-height:1.6">We've received your payment for your River Sand delivery. Thank you!</p>

        <div style="border:2px solid ${BRAND_GOLD};border-radius:12px;padding:24px;margin:24px 0">
          <table style="width:100%;font-size:14px;color:#555">
            <tr><td style="padding:6px 0;font-weight:600;color:${BRAND_COLOR}">Order #</td><td>${data.order_number || "N/A"}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:${BRAND_COLOR}">Payment method</td><td>${method}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:${BRAND_COLOR}">Amount paid</td><td style="font-weight:700;color:${BRAND_GOLD}">$${total}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:${BRAND_COLOR}">Delivery address</td><td>${data.delivery_address || ""}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:${BRAND_COLOR}">Delivery date</td><td>${formatDate(data.delivery_date)}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600;color:${BRAND_COLOR}">Payment recorded</td><td>${recordedAt}</td></tr>
          </table>
        </div>

        <p style="font-size:15px;color:#555;line-height:1.6">Your order is complete. We appreciate your business and look forward to serving you again.</p>

        <div style="border-top:1px solid #E0DDD5;padding-top:16px;margin-top:24px">
          <p style="margin:0;font-weight:500;color:${BRAND_COLOR}">Silas Caldeira</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Founder & CEO</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">${LEGAL_NAME}</p>
          <p style="margin:4px 0 0;font-size:12px"><a href="https://${WEBSITE}" style="color:#1A6BB8;text-decoration:none">${WEBSITE}</a> | ${PHONE}</p>
        </div>
      `);

      if (!data.customer_email) {
        return new Response(JSON.stringify({ error: "No customer email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sendMail(resend, data.customer_email, `Payment Confirmed — Order #${data.order_number || "N/A"}`, cashHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Cash payment confirmation sent to:", data.customer_email);

    } else if (type === "waitlist") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const waitlistHtml = emailWrapper(`
        <h2>You're on the list!</h2>
        <p>Hi ${firstName},</p>
        <p>We've added you to the waitlist for river sand delivery to <strong>${data.city_name || "your area"}</strong>. We'll notify you the moment delivery becomes available in your area.</p>
        <p>In the meantime, check if we already deliver to a nearby area:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://riversand.net" class="cta">Check My Area</a>
        </div>
      `);
      await sendMail(resend, data.customer_email, `You're on the list — River Sand delivery to ${data.city_name}`, waitlistHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Waitlist confirmation sent to:", data.customer_email);

    } else if (type === "waitlist_available") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const orderUrl = `https://riversand.net/?address=${encodeURIComponent(data.city_name || "")}`;
      const availableHtml = emailWrapper(`
        <h2>Great news!</h2>
        <p>Hi ${firstName},</p>
        <p>River sand delivery is now available in <strong>${data.city_name}</strong>!</p>
        <div style="border:2px solid ${BRAND_GOLD};border-radius:12px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0 0 8px;font-size:14px;color:#555;text-transform:uppercase;letter-spacing:1px">Your Estimated Price</p>
          <p style="margin:0;font-size:32px;font-weight:700;color:${BRAND_GOLD}">$${Number(data.price || 195).toFixed(0)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999">Same-day delivery available</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${orderUrl}" class="cta" style="font-size:16px;padding:16px 48px">ORDER NOW</a>
        </div>
        <p style="font-size:14px;color:#555">This is a one-time notification. Order anytime at <a href="https://riversand.net" style="color:${BRAND_GOLD}">riversand.net</a></p>
      `);
      await sendMail(resend, data.customer_email, `Great news — River Sand now delivers to ${data.city_name}!`, availableHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Waitlist available notification sent to:", data.customer_email);

    } else if (type === "lead_confirmation") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const responseTime = data.response_time_hours || "2";
      const bizHours = data.business_hours || "7:00 AM – 5:00 PM";
      const bizDays = data.business_days || "Monday–Saturday";
      const leadConfirmHtml = emailWrapper(`
        <p style="font-size:16px;color:#555;line-height:1.6">Hi ${firstName},</p>
        <p style="font-size:15px;color:#555;line-height:1.6">Thank you for your interest in River Sand delivery. We've received your request for delivery to:</p>
        <div style="background:#F8F7F2;border-left:4px solid ${BRAND_GOLD};padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0">
          <p style="margin:0;font-size:15px;font-weight:600;color:${BRAND_COLOR}">${data.delivery_address || "your address"}</p>
        </div>
        <p style="font-size:15px;color:#555;line-height:1.6">Our delivery manager is reviewing your request and will get back to you within <strong>${responseTime} hours</strong> during business hours (${bizDays}, ${bizHours}).</p>
        <p style="font-size:15px;color:#555;line-height:1.6">If you have any questions in the meantime, call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a>.</p>
        <div style="border-top:1px solid #E0DDD5;padding-top:16px;margin-top:24px">
          <p style="margin:0;font-weight:500;color:${BRAND_COLOR}">Silas Caldeira</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Founder & CEO</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">${LEGAL_NAME}</p>
          <p style="margin:4px 0 0;font-size:12px"><a href="https://${WEBSITE}" style="color:#1A6BB8;text-decoration:none">${WEBSITE}</a> | ${PHONE}</p>
        </div>
      `);
      await sendMail(resend, data.customer_email, "We received your request — riversand.net", leadConfirmHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Lead confirmation sent to:", data.customer_email);

    } else if (type === "lead_offer") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const price = Number(data.price || 0).toFixed(2);
      const leadOfferHtml = emailWrapper(`
        <p style="font-size:16px;color:#555;line-height:1.6">Hi ${firstName},</p>
        <p style="font-size:15px;color:#555;line-height:1.6">Great news — we can deliver river sand to your location. Here's your quote:</p>
        <div style="border:2px solid ${BRAND_GOLD};border-radius:12px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0 0 8px;font-size:14px;color:#555;text-transform:uppercase;letter-spacing:1px">River Sand — 9 Cubic Yards</p>
          <p style="margin:0 0 4px;font-size:13px;color:#777">Delivered to: ${data.delivery_address || ""}</p>
          <p style="margin:16px 0 0;font-size:32px;font-weight:700;color:${BRAND_GOLD}">$${price}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999">Your price, delivered</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${data.payment_url || "https://riversand.net"}" style="display:inline-block;background:${BRAND_GOLD};color:#fff!important;padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:1px">COMPLETE YOUR ORDER</a>
        </div>
        <p style="font-size:13px;color:#999;text-align:center">This payment link will expire. Please complete your order promptly.</p>
        <p style="font-size:14px;color:#555;line-height:1.8">Questions? Call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a> — we're real people and happy to help.</p>
        <div style="border-top:1px solid #E0DDD5;padding-top:16px;margin-top:24px">
          <p style="margin:0;font-weight:500;color:${BRAND_COLOR}">Silas Caldeira</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Founder & CEO</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">WAYS® Materials LLC</p>
          <p style="margin:4px 0 0;font-size:12px"><a href="https://riversand.net" style="color:#1A6BB8;text-decoration:none">riversand.net</a> | ${PHONE}</p>
        </div>
      `);
      await sendMail(resend, data.customer_email, "Your river sand delivery quote — riversand.net", leadOfferHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Lead offer sent to:", data.customer_email);

    } else if (type === "lead_decline") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const cityName = data.city_name || "your area";
      const leadDeclineHtml = emailWrapper(`
        <p style="font-size:16px;color:#555;line-height:1.6">Hi ${firstName},</p>
        <p style="font-size:15px;color:#555;line-height:1.6">Thank you for your interest in River Sand delivery. After reviewing your request, we're not yet able to deliver to <strong>${data.delivery_address || cityName}</strong>.</p>
        <p style="font-size:15px;color:#555;line-height:1.6">The good news is we're actively expanding our delivery area. We've added you to our notification list and will reach out as soon as we begin serving ${cityName}.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="https://riversand.net" style="display:inline-block;background:${BRAND_GOLD};color:#fff!important;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">CHECK DELIVERY AVAILABILITY</a>
        </div>
        <p style="font-size:14px;color:#555;line-height:1.8">In the meantime, feel free to check back — our coverage area is growing. Questions? Call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a>.</p>
        <div style="border-top:1px solid #E0DDD5;padding-top:16px;margin-top:24px">
          <p style="margin:0;font-weight:500;color:${BRAND_COLOR}">Silas Caldeira</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">Founder & CEO</p>
          <p style="margin:4px 0 0;font-size:12px;color:#666">WAYS® Materials LLC</p>
          <p style="margin:4px 0 0;font-size:12px"><a href="https://riversand.net" style="color:#1A6BB8;text-decoration:none">riversand.net</a> | ${PHONE}</p>
        </div>
      `);
      await sendMail(resend, data.customer_email, "About your river sand delivery request — riversand.net", leadDeclineHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Lead decline sent to:", data.customer_email);

    } else if (type === "capture_failed") {
      const firstName = (data.customer_name || "").split(" ")[0] || "there";
      const orderNum = data.order_number || "N/A";
      const rescheduleUrl = data.reschedule_url || "https://riversand.net/order";
      const captureFailedHtml = brandedEmailWrapper({
        content: `
          <p style="font-size:16px;color:#555;line-height:1.6">Hi ${firstName},</p>
          <p style="font-size:15px;color:#555;line-height:1.6">We tried to process the payment for your river sand delivery (Order <strong>${orderNum}</strong>), but the charge didn't go through.</p>
          <p style="font-size:15px;color:#555;line-height:1.6">Don't worry — your delivery slot is held for you. To keep your order active, please update your payment and select a new delivery date using the link below.</p>
          <div style="background:#FEF9C3;border:1px solid #FDE68A;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="margin:0;font-size:13px;color:#78350F;line-height:1.6;">If you don't reschedule within 48 hours, your order will be canceled and any hold on your card will be released.</p>
          </div>
          <p style="font-size:14px;color:#555;line-height:1.8">Questions? Call us at <a href="tel:+18554689297" style="color:${BRAND_GOLD};font-weight:600">${PHONE}</a> — we're happy to help.</p>
        `,
        ctaText: "RESCHEDULE & PAY",
        ctaUrl: rescheduleUrl,
      });
      if (!data.customer_email) {
        return new Response(JSON.stringify({ error: "No customer email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await sendMail(resend, data.customer_email, `Action Required — Payment for Order ${orderNum}`, captureFailedHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Capture failed email sent to:", data.customer_email);

    } else if (type === "capture_summary") {
      const captured = data.captured_count || 0;
      const failed = data.failed_count || 0;
      const capturedOrders = (data.captured_orders || []).map((o: string) => `<li style="font-size:13px;color:#555;padding:2px 0;">${o}</li>`).join("");
      const failedOrders = (data.failed_orders || []).map((o: string) => `<li style="font-size:13px;color:#C21F32;padding:2px 0;">${o}</li>`).join("");
      const summaryHtml = brandedEmailWrapper({
        content: `
          <h2 style="color:${BRAND_COLOR};margin:0 0 16px;font-size:20px;">2am Capture Summary</h2>
          <p style="font-size:15px;color:#555;line-height:1.6;">Nightly payment capture completed at ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} Central.</p>
          <div style="display:flex;gap:16px;margin:20px 0;">
            <div style="flex:1;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#166534;">${captured}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#15803D;text-transform:uppercase;letter-spacing:1px;">Captured</p>
            </div>
            <div style="flex:1;background:${failed > 0 ? '#FEF2F2' : '#F9FAFB'};border:1px solid ${failed > 0 ? '#FECACA' : '#E5E7EB'};border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:${failed > 0 ? '#991B1B' : '#6B7280'};">${failed}</p>
              <p style="margin:4px 0 0;font-size:12px;color:${failed > 0 ? '#B91C1C' : '#9CA3AF'};text-transform:uppercase;letter-spacing:1px;">Failed</p>
            </div>
          </div>
          ${capturedOrders ? `<p style="font-size:12px;font-weight:700;color:${BRAND_COLOR};text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">Captured Orders</p><ul style="margin:0;padding-left:20px;">${capturedOrders}</ul>` : ''}
          ${failedOrders ? `<p style="font-size:12px;font-weight:700;color:#C21F32;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">Failed Orders</p><ul style="margin:0;padding-left:20px;">${failedOrders}</ul>` : ''}
        `,
        ctaText: "OPEN DASHBOARD",
        ctaUrl: "https://riversand.net/leads",
      });
      await sendMail(resend, ownerEmail, `Capture Summary — ${captured} captured, ${failed} failed`, summaryHtml, undefined, FROM, REPLY_TO);
      console.log("[email] Capture summary sent to:", ownerEmail);

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
