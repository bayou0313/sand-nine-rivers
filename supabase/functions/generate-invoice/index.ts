import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NAVY = [13, 33, 55] as const;
const GOLD = [192, 122, 0] as const;
const WHITE = [255, 255, 255] as const;
const DARK = [51, 51, 51] as const;
const BORDER = [221, 221, 221] as const;
const GREEN = [22, 163, 74] as const;
const AMBER = [217, 119, 6] as const;

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

    // Fetch logos in parallel
    const RIVERSAND_LOGO_URL = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";
    const WAYS_LOGO_URL = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO___-__WHITE.png.png";
    const [rsLogoB64, waysLogoB64] = await Promise.all([
      fetchImageAsBase64(RIVERSAND_LOGO_URL),
      fetchImageAsBase64(WAYS_LOGO_URL),
    ]);

    // Build compact single-page PDF (letter: 215.9 × 279.4 mm)
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pw = 215.9;
    const ph = 279.4;
    const mx = 14;
    const cw = pw - 2 * mx;
    let y = 0;

    const invoiceNum = order.order_number || `RS-${order.id.substring(0, 8).toUpperCase()}`;
    const isPaid = order.payment_status === "paid";
    const isCard = order.payment_method === "stripe-link" || order.payment_method === "card";
    const basePrice = 195;
    const baseMiles = 15;
    const perMileExtra = 5.5;

    // ─── HEADER (24mm) ───
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 22, "F");

    // Add logos
    if (rsLogoB64) {
      try { doc.addImage(`data:image/png;base64,${rsLogoB64}`, "PNG", mx, 3, 55, 16); } catch { /* fallback text */ doc.setTextColor(...WHITE); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("RIVER SAND", mx, 13); }
    } else {
      doc.setTextColor(...WHITE); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("RIVER SAND", mx, 13);
    }
    if (waysLogoB64) {
      try { doc.addImage(`data:image/png;base64,${waysLogoB64}`, "PNG", pw - mx - 30, 4, 30, 14); } catch { doc.setTextColor(...WHITE); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("WAYS", pw - mx, 13, { align: "right" }); }
    } else {
      doc.setTextColor(...WHITE); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("WAYS", pw - mx, 13, { align: "right" });
    }

    // Gold divider
    doc.setFillColor(...GOLD);
    doc.rect(0, 22, pw, 1.5, "F");
    y = 27;

    // ─── TITLE ───
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("DELIVERY CONFIRMATION", mx, y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("riversand.net  |  1-855-GOT-WAYS", pw - mx, y, { align: "right" });
    y += 6;

    // ─── TWO COLUMN: ORDER INFO + CUSTOMER ───
    const colLeft = mx;
    const colRight = pw / 2 + 5;

    // Left: ORDER INFO
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER INFORMATION", colLeft, y);
    y += 4;
    const yOrderStart = y;
    doc.setFontSize(8);
    const orderRows = [
      ["Order #:", invoiceNum],
      ["Date:", fmtShortDate(order.created_at)],
      ["Delivery:", fmtDate(order.delivery_date)],
      ["Window:", "8:00 AM – 5:00 PM"],
    ];
    orderRows.forEach(([label, val]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(label, colLeft, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.text(val, colLeft + 22, y);
      y += 4;
    });

    // Right: CUSTOMER
    let yR = yOrderStart - 4;
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER", colRight, yR);
    yR += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(order.customer_name, colRight, yR); yR += 4;
    doc.setFont("helvetica", "normal");
    if (order.customer_phone) { doc.text(order.customer_phone, colRight, yR); yR += 4; }
    if (order.customer_email) { doc.text(order.customer_email, colRight, yR); yR += 4; }

    y = Math.max(y, yR) + 2;

    // Separator
    doc.setDrawColor(...BORDER);
    doc.line(mx, y, pw - mx, y);
    y += 4;

    // ─── DELIVERY ADDRESS (single line) ───
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY ADDRESS", mx, y);
    y += 4;
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    const addrLines = doc.splitTextToSize(order.delivery_address, cw);
    addrLines.forEach((line: string) => { doc.text(line, mx, y); y += 4.5; });
    y += 2;

    // Separator
    doc.setDrawColor(...BORDER);
    doc.line(mx, y, pw - mx, y);
    y += 4;

    // ─── ORDER + PRODUCT (inline) ───
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER DETAILS", mx, y);
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(`River Sand — 9 cu/yd  ×  ${order.quantity} load${order.quantity > 1 ? "s" : ""}`, mx, y);
    y += 4;
    if (order.notes) {
      doc.setFontSize(7);
      const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, cw);
      noteLines.slice(0, 2).forEach((line: string) => { doc.text(line, mx, y); y += 3.5; });
    }
    y += 2;

    // ─── PRICING TABLE (compact 7mm rows) ───
    const tableX = mx;
    const labelW = cw * 0.7;
    const rowH = 6;

    // Header
    doc.setFillColor(...NAVY);
    doc.rect(tableX, y, cw, rowH, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", tableX + 2, y + 4);
    doc.text("AMOUNT", tableX + labelW + 2, y + 4);
    y += rowH;

    // Calculate pricing line items
    const qty = order.quantity || 1;
    const baseLine = basePrice * qty;
    const dist = Number(order.distance_miles || 0);
    const distanceFee = dist > baseMiles ? (dist - baseMiles) * perMileExtra * qty : 0;
    const satSurcharge = order.saturday_surcharge ? (order.saturday_surcharge_amount || 0) : 0;
    const taxAmount = Number(order.tax_amount || 0);
    const taxRate = (Number(order.tax_rate || 0) * 100).toFixed(2);
    // Try to extract parish from delivery address
    const parishMatch = order.delivery_address?.match(/,\s*([^,]+?)\s+Parish/i);
    const parish = parishMatch ? parishMatch[1] : "";
    const subtotalBeforeFee = baseLine + distanceFee + satSurcharge + taxAmount;
    const processingFee = isCard ? Math.max(0, Number(order.price) - subtotalBeforeFee) : 0;

    interface PriceLine { desc: string; amt: string }
    const priceLines: PriceLine[] = [];
    priceLines.push({ desc: `River Sand — 9 cu/yd (×${qty})`, amt: fmt(baseLine) });
    if (distanceFee > 0) {
      priceLines.push({ desc: "Extended area surcharge", amt: fmt(distanceFee) });
    }
    if (satSurcharge > 0) {
      priceLines.push({ desc: "Saturday surcharge", amt: fmt(satSurcharge) });
    }
    if (taxAmount > 0) {
      const taxLabel = parish ? `Tax — ${parish} Parish (${taxRate}%)` : `Tax (${taxRate}%)`;
      priceLines.push({ desc: taxLabel, amt: fmt(taxAmount) });
    }
    if (isCard && processingFee > 0.01) {
      priceLines.push({ desc: "Processing Fee (3.5%)", amt: fmt(processingFee) });
    }

    // Rows
    doc.setFontSize(8);
    priceLines.forEach((line, i) => {
      doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 248);
      doc.rect(tableX, y, cw, rowH, "F");
      doc.setDrawColor(...BORDER);
      doc.line(tableX, y + rowH, tableX + cw, y + rowH);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
      doc.text(line.desc, tableX + 2, y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(line.amt, tableX + labelW + 2, y + 4);
      y += rowH;
    });

    // Gold separator
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(tableX, y, tableX + cw, y);
    doc.setLineWidth(0.2);

    // TOTAL
    doc.setFillColor(...GOLD);
    doc.rect(tableX, y, cw, 8, "F");
    doc.setTextColor(...NAVY);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(isPaid ? "TOTAL CHARGED" : "TOTAL DUE AT DELIVERY", tableX + 2, y + 5.5);
    doc.text(fmt(order.price), tableX + labelW + 2, y + 5.5);
    y += 10;

    // ─── PAYMENT STATUS (compact) ───
    if (isPaid) {
      doc.setFillColor(240, 253, 244);
      doc.rect(mx, y, cw, 14, "F");
      doc.setDrawColor(187, 247, 208);
      doc.rect(mx, y, cw, 14, "S");
      doc.setFontSize(11);
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.text("PAID IN FULL", mx + cw / 2, y + 5, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Credit Card  |  Nothing due at delivery", mx + cw / 2, y + 10, { align: "center" });
      if (order.stripe_payment_id) {
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(`Ref: ${order.stripe_payment_id}`, mx + cw / 2, y + 13, { align: "center" });
      }
      y += 16;
    } else {
      doc.setFillColor(255, 251, 235);
      doc.rect(mx, y, cw, 14, "F");
      doc.setDrawColor(253, 230, 138);
      doc.rect(mx, y, cw, 14, "S");
      doc.setFontSize(10);
      doc.setTextColor(...AMBER);
      doc.setFont("helvetica", "bold");
      doc.text("DUE AT DELIVERY", mx + cw / 2, y + 5, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(194, 31, 50);
      doc.text(fmt(order.price), mx + cw / 2, y + 10.5, { align: "center" });
      doc.setFontSize(6);
      doc.setTextColor(...AMBER);
      doc.setFont("helvetica", "normal");
      doc.text("Exact amount required — driver carries no change", mx + cw / 2, y + 13.5, { align: "center" });
      y += 16;

      // COD payment policy note
      const cashTotal = Number(order.price).toFixed(2);
      const cardTotal = (Number(order.price) * 1.035).toFixed(2);
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14); // #92400E
      doc.setFont("helvetica", "bold");
      doc.text("PAYMENT DUE AT DELIVERY", mx, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.text("Cash or check payment is due at the time of delivery.", mx, y);
      y += 3.5;
      doc.text("If payment cannot be collected, we will contact you to arrange card payment.", mx, y);
      y += 3.5;
      doc.text(`Cash/Check total: $${cashTotal} · Card total if needed: $${cardTotal} (includes 3.5% fee)`, mx, y);
      y += 5;
    }

    // ─── DELIVERY TERMS (bullet points only) ───
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY TERMS", mx, y);
    y += 4;

    const bullets = [
      "Curbside delivery only — curb to sidewalk/driveway edge. No private property entry.",
      "Customer must ensure clear, accessible delivery area before arrival.",
      "WAYS® Materials LLC not liable for damage to driveways, landscaping, or property.",
      "Customer or representative must be present at delivery.",
      "Same-day orders subject to dispatch confirmation within 30 minutes.",
      "Cancellation Policy: Orders canceled more than 2 hours before delivery are fully refunded. Processing fees (3.5%) are non-refundable.",
    ];

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    bullets.forEach((b) => {
      const bLines = doc.splitTextToSize(`• ${b}`, cw);
      bLines.forEach((line: string) => { doc.text(line, mx, y); y += 3; });
      y += 0.5;
    });

    y += 2;

    // ─── GOLD LINE + FOOTER ───
    doc.setFillColor(...GOLD);
    doc.rect(0, y, pw, 1, "F");
    y += 1;

    const footerH = Math.max(ph - y, 16);
    doc.setFillColor(...NAVY);
    doc.rect(0, y, pw, footerH, "F");

    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("WAYS\u00AE Materials LLC  |  Bridge City, LA  |  1-855-GOT-WAYS  |  orders@riversand.net", pw / 2, y + 6, { align: "center" });
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.text("This document serves as your official delivery confirmation and receipt.", pw / 2, y + 10, { align: "center" });

    // Generate PDF buffer
    const pdfOutput = doc.output("arraybuffer");

    return new Response(pdfOutput, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${invoiceNum}.pdf"`,
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