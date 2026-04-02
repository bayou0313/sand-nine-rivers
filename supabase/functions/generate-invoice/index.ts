import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BLACK = [0, 0, 0] as const;
const DARK = [51, 51, 51] as const;
const GRAY = [120, 120, 120] as const;
const GOLD = [200, 164, 74] as const;
const GREEN = [22, 163, 74] as const;
const LIGHT_GRAY = [200, 200, 200] as const;

function fmt(n: number): string {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00"));
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

function fmtShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch { return null; }
}

function drawFooter(doc: jsPDF, pw: number, ph: number, mx: number, cw: number, footerLogoB64: string | null) {
  const footerY = ph - 24;

  // Gold divider line above footer
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(mx, footerY, pw - mx, footerY);
  doc.setLineWidth(0.2);

  const textY = footerY + 10;

  // WAYS logo on the left
  if (footerLogoB64) {
    try {
      doc.addImage(`data:image/png;base64,${footerLogoB64}`, "PNG", mx, footerY + 3, 24, 0);
    } catch { /* skip */ }
  }

  // Text right-aligned
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("WAYS® Materials LLC  |  riversand.net  |  1-855-GOT-WAYS", pw - mx, textY, { align: "right" });
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text("This document serves as your official order confirmation and receipt.", pw - mx, textY + 4, { align: "right" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, lookup_token } = await req.json();

    if (!order_id || !lookup_token) {
      return new Response(JSON.stringify({ error: "Missing order_id or lookup_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("lookup_token", lookup_token)
      .maybeSingle();

    if (error || !order) {
      return new Response(JSON.stringify({ error: "Order not found or invalid token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HEADER_LOGO_URL = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png";
    const FOOTER_LOGO_URL = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO.png.png";
    const [headerLogoB64, footerLogoB64] = await Promise.all([
      fetchImageAsBase64(HEADER_LOGO_URL),
      fetchImageAsBase64(FOOTER_LOGO_URL),
    ]);

    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pw = 215.9;
    const ph = 279.4;
    const mx = 16;
    const cw = pw - 2 * mx;
    const maxContentY = ph - 32;
    let y = 0;

    const invoiceNum = order.order_number || `RS-${order.id.substring(0, 8).toUpperCase()}`;
    const isPaid = order.payment_status === "paid";
    const isCard = order.payment_method === "stripe-link" || order.payment_method === "card";
    const basePrice = 195;
    const baseMiles = 15;
    const perMileExtra = 5.5;

    // ─── HEADER ───
    y = 18;

    if (headerLogoB64) {
      try { doc.addImage(`data:image/png;base64,${headerLogoB64}`, "PNG", mx, 8, 55, 0); } catch {
        doc.setTextColor(...BLACK); doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text("RIVER SAND", mx, 18);
      }
    } else {
      doc.setTextColor(...BLACK); doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text("RIVER SAND", mx, 18);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("ORDER CONFIRMATION", pw - mx, 12, { align: "right" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text(invoiceNum, pw - mx, 18, { align: "right" });

    // Gold divider under header
    y = 28;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(mx, y, pw - mx, y);
    doc.setLineWidth(0.2);
    y += 8;

    // ─── TWO COLUMN: ORDER INFO + CUSTOMER ───
    const colLeft = mx;
    const colRight = pw / 2 + 8;

    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER INFORMATION", colLeft, y);
    y += 5;
    const yOrderStart = y;
    doc.setFontSize(9);
    const orderRows = [
      ["Order #:", invoiceNum],
      ["Date:", fmtShortDate(order.created_at)],
      ["Delivery:", fmtDate(order.delivery_date)],
      ["Window:", "8:00 AM – 5:00 PM"],
    ];
    orderRows.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(label, colLeft, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BLACK);
      doc.text(val, colLeft + 24, y);
      y += 5;
    });

    let yR = yOrderStart - 5;
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER", colRight, yR);
    yR += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text(order.customer_name, colRight, yR); yR += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    if (order.customer_phone) { doc.text(order.customer_phone, colRight, yR); yR += 5; }
    if (order.customer_email) { doc.text(order.customer_email, colRight, yR); yR += 5; }

    y = Math.max(y, yR) + 4;

    // ─── Single grey divider between order info and delivery address ───
    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(mx, y, pw - mx, y);
    y += 8;

    // ─── DELIVERY ADDRESS (left-aligned header and content) ───
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY ADDRESS", mx, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "normal");
    const addrLines = doc.splitTextToSize(order.delivery_address, cw);
    addrLines.forEach((line: string) => { doc.text(line, mx, y); y += 5; });
    y += 6;

    // ─── ORDER DETAILS ───
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER DETAILS", mx, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "normal");
    doc.text(`River Sand — 9 cu/yd  ×  ${order.quantity} load${order.quantity > 1 ? "s" : ""}`, mx, y);
    y += 5;
    if (order.notes) {
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, cw);
      noteLines.slice(0, 3).forEach((line: string) => { doc.text(line, mx, y); y += 4; });
    }
    y += 4;

    // ─── PRICING TABLE ───
    const tableX = mx;
    const amtX = pw - mx; // right edge for right-aligned amounts
    const rowH = 7;

    // Grey header line
    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(tableX, y, pw - mx, y);
    y += 0.5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("DESCRIPTION", tableX, y + 4);
    doc.text("AMOUNT", amtX, y + 4, { align: "right" });
    y += rowH;
    // Grey line under header
    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(tableX, y, pw - mx, y);

    // Calculate pricing
    const qty = order.quantity || 1;
    const baseLine = basePrice * qty;
    const dist = Number(order.distance_miles || 0);
    const distanceFee = dist > baseMiles ? (dist - baseMiles) * perMileExtra * qty : 0;
    const satSurcharge = order.saturday_surcharge ? (order.saturday_surcharge_amount || 0) : 0;
    const taxAmount = Number(order.tax_amount || 0);
    const taxRate = (Number(order.tax_rate || 0) * 100).toFixed(2);
    const parishMatch = order.delivery_address?.match(/,\s*([^,]+?)\s+Parish/i);
    const parish = parishMatch ? parishMatch[1] : "";
    const subtotalBeforeFee = baseLine + distanceFee + satSurcharge + taxAmount;
    const processingFee = isCard ? Math.max(0, Number(order.price) - subtotalBeforeFee) : 0;

    interface PriceLine { desc: string; amt: string }
    const priceLines: PriceLine[] = [];
    priceLines.push({ desc: `River Sand — 9 cu/yd (×${qty})`, amt: fmt(baseLine) });
    if (distanceFee > 0) priceLines.push({ desc: "Extended area surcharge", amt: fmt(distanceFee) });
    if (satSurcharge > 0) priceLines.push({ desc: "Saturday surcharge", amt: fmt(satSurcharge) });
    if (taxAmount > 0) {
      const taxLabel = parish ? `Tax — ${parish} Parish (${taxRate}%)` : `Tax (${taxRate}%)`;
      priceLines.push({ desc: taxLabel, amt: fmt(taxAmount) });
    }
    if (isCard && processingFee > 0.01) priceLines.push({ desc: "Processing Fee", amt: fmt(processingFee) });

    doc.setFontSize(9);
    priceLines.forEach((line) => {
      y += 1;
      doc.setTextColor(...BLACK);
      doc.setFont("helvetica", "normal");
      doc.text(line.desc, tableX, y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(line.amt, amtX, y + 4, { align: "right" });
      y += rowH;
    });

    // Grey separator before total
    y += 1;
    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(tableX, y, pw - mx, y);
    y += 2;

    // TOTAL row — left label, right-aligned amount
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text(isPaid ? "TOTAL CHARGED" : "TOTAL DUE AT DELIVERY", tableX, y + 5);
    doc.text(fmt(order.price), amtX, y + 5, { align: "right" });
    y += 12;

    // ─── PAYMENT STATUS (card only — green paid box) ───
    if (isPaid) {
      doc.setDrawColor(187, 247, 208);
      doc.setLineWidth(0.3);
      doc.roundedRect(mx, y, cw, 14, 2, 2, "S");
      doc.setLineWidth(0.2);
      doc.setFontSize(11);
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.text("PAID IN FULL", mx + cw / 2, y + 5, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text("Credit Card  |  Nothing due at delivery", mx + cw / 2, y + 10, { align: "center" });
      if (order.stripe_payment_id) {
        doc.setFontSize(7);
        doc.text(`Ref: ${order.stripe_payment_id}`, mx + cw / 2, y + 13, { align: "center" });
      }
      y += 18;
    }
    // No amber "DUE AT DELIVERY" box — info is covered by total line and terms below

    // ─── TERMS BLOCK (pushed to just above footer) ───
    // Calculate how much space the terms block needs
    const bullets = [
      "Curbside delivery only — curb to sidewalk/driveway edge. No private property entry.",
      "Customer must ensure clear, accessible delivery area before arrival.",
      "WAYS® Materials LLC not liable for damage to driveways, landscaping, or property.",
      "Customer or representative must be present at delivery.",
      "Same-day orders subject to dispatch confirmation within 30 minutes.",
      "Cancellation Policy: Orders canceled a day before scheduled delivery are fully refunded. Processing fees are non-refundable.",
    ];

    // For COD orders, add payment due text before terms
    const hasCODBlock = !isPaid;
    const codLines = hasCODBlock ? [
      "Cash or check payment is due at the time of delivery.",
      "If payment cannot be collected, a card payment link will be sent.",
    ] : [];

    // Measure terms height to position just above footer
    let termsHeight = 0;
    if (hasCODBlock) {
      termsHeight += 5 + codLines.length * 4 + 4; // header + lines + gap
    }
    termsHeight += 5; // DELIVERY TERMS header
    bullets.forEach((b) => {
      const bLines = doc.splitTextToSize(`• ${b}`, cw);
      termsHeight += bLines.length * 3.5 + 0.5;
    });

    // Position terms: either after content or pushed to fill space above footer
    const termsStartY = Math.max(y + 4, maxContentY - termsHeight - 4);

    // Check if terms fit on current page, otherwise add page
    if (termsStartY + termsHeight > maxContentY) {
      doc.addPage();
      y = 20;
    } else {
      y = termsStartY;
    }

    // COD payment info
    if (hasCODBlock) {
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.setFont("helvetica", "bold");
      doc.text("PAYMENT DUE AT DELIVERY", mx, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      codLines.forEach((line) => {
        doc.text(line, mx, y);
        y += 4;
      });
      y += 4;
    }

    // Delivery terms
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY TERMS", mx, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    bullets.forEach((b) => {
      if (y > maxContentY) {
        doc.addPage();
        y = 20;
      }
      const bLines = doc.splitTextToSize(`• ${b}`, cw);
      bLines.forEach((line: string) => { doc.text(line, mx, y); y += 3.5; });
      y += 0.5;
    });

    // ─── FOOTER on last page, pinned to bottom ───
    drawFooter(doc, pw, ph, mx, cw, footerLogoB64);

    const pdfOutput = doc.output("arraybuffer");

    return new Response(pdfOutput, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Invoice-${invoiceNum}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to generate invoice" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});