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
const GRAY = [242, 242, 242] as const;
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

// Removed fetchImageAsBase64 — using text-only rendering to keep PDF under 300KB

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

    // Text-only rendering — no image fetching to keep PDF small

    // Build PDF
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pw = 215.9;
    const ph = 279.4;
    const mx = 18;
    const cw = pw - 2 * mx;
    let y = 0;

    // ─── HEADER BAR ───
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 32, "F");

    // Add logos to header
    if (logoWhiteB64) {
      try { doc.addImage(`data:image/png;base64,${logoWhiteB64}`, "PNG", mx, 6, 48, 20); } catch {}
    } else {
      doc.setTextColor(...WHITE);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RIVER SAND", mx, 18);
    }

    if (waysWhiteB64) {
      try { doc.addImage(`data:image/png;base64,${waysWhiteB64}`, "PNG", pw - mx - 32, 8, 32, 16); } catch {}
    } else {
      doc.setTextColor(...WHITE);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("WAYS", pw - mx, 18, { align: "right" });
    }

    // Powered by line
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255, 128);
    doc.text("Powered by WAYS — We Are Your Supply", pw / 2, 29, { align: "center" });

    // Gold divider
    doc.setFillColor(...GOLD);
    doc.rect(0, 32, pw, 2, "F");
    y = 40;

    // ─── DOCUMENT TITLE ───
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("DELIVERY CONFIRMATION", mx, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text("Ways Materials LLC operating as River Sand", mx, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("riversand.net  |  1-855-GOT-WAYS", mx, y);
    y += 10;

    // ─── TWO COLUMN: ORDER INFO + CUSTOMER ───
    const invoiceNum = order.order_number || `RS-${order.id.substring(0, 8).toUpperCase()}`;
    const colLeft = mx;
    const colRight = pw / 2 + 8;

    // Left: ORDER INFORMATION
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER INFORMATION", colLeft, y);
    y += 5;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const orderInfoRows = [
      ["Order Number", invoiceNum],
      ["Order Date", fmtShortDate(order.created_at)],
      ["Delivery Date", fmtDate(order.delivery_date)],
      ["Delivery Window", "8:00 AM – 5:00 PM"],
    ];
    const yOrderStart = y;
    orderInfoRows.forEach(([label, val], i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(label + ":", colLeft, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.text(val, colLeft + 35, y);
      y += 5;
    });

    // Right: CUSTOMER
    let yRight = yOrderStart - 5;
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER", colRight, yRight);
    yRight += 5;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(order.customer_name, colRight, yRight);
    yRight += 5;
    doc.setFont("helvetica", "normal");
    if (order.customer_phone) { doc.text(order.customer_phone, colRight, yRight); yRight += 5; }
    if (order.customer_email) { doc.text(order.customer_email, colRight, yRight); yRight += 5; }

    y = Math.max(y, yRight) + 4;

    // Separator
    doc.setDrawColor(...BORDER);
    doc.line(mx, y, pw - mx, y);
    y += 6;

    // ─── DELIVERY ADDRESS ───
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY ADDRESS", mx, y);
    y += 6;
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    const addrLines = doc.splitTextToSize(order.delivery_address, cw - 35);
    addrLines.forEach((line: string) => {
      doc.text(line, mx, y);
      y += 5.5;
    });

    // QR code on right
    if (qrB64) {
      try {
        const qrY = y - addrLines.length * 5.5;
        doc.addImage(`data:image/png;base64,${qrB64}`, "PNG", pw - mx - 25, qrY - 2, 25, 25);
      } catch {}
    }

    y += 4;
    doc.setDrawColor(...BORDER);
    doc.line(mx, y, pw - mx, y);
    y += 6;

    // ─── ORDER DETAILS ───
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER DETAILS", mx, y);
    y += 5;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Product: River Sand — 9 Cubic Yard Load", mx, y); y += 5;
    doc.text(`Quantity: ${order.quantity} load${order.quantity > 1 ? "s" : ""}`, mx, y); y += 5;
    if (order.notes) {
      const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, cw);
      noteLines.forEach((line: string) => { doc.text(line, mx, y); y += 4.5; });
    }
    y += 4;

    // ─── PRICING TABLE ───
    doc.setFillColor(...NAVY);
    const tableX = mx;
    const labelW = cw * 0.7;
    const amtW = cw * 0.3;
    doc.rect(tableX, y, cw, 8, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", tableX + 3, y + 5.5);
    doc.text("AMOUNT", tableX + labelW + 3, y + 5.5);
    y += 8;

    const basePrice = 195;
    const baseMiles = 15;
    const perMileExtra = 5.5;
    const isPaid = order.payment_status === "paid";
    const isCard = order.payment_method === "stripe-link" || order.payment_method === "card";

    interface PriceLine { desc: string; amt: string }
    const lines: PriceLine[] = [];

    lines.push({ desc: `River Sand — 9 cu/yd load (×${order.quantity})`, amt: fmt(basePrice * order.quantity) });

    if (order.saturday_surcharge && order.saturday_surcharge_amount > 0) {
      lines.push({ desc: "Saturday delivery surcharge", amt: fmt(order.saturday_surcharge_amount) });
    }

    if (order.tax_amount > 0) {
      lines.push({ desc: `Tax — ${order.tax_parish || ''} (${(order.tax_rate * 100).toFixed(2)}%)`, amt: fmt(order.tax_amount) });
    }

    if (isCard) {
      const subtotalBeforeFee = basePrice * order.quantity + (order.saturday_surcharge_amount || 0) + (order.tax_amount || 0);
      const distanceMiles = Number(order.distance_miles || 0);
      const distFee = distanceMiles > baseMiles ? (distanceMiles - baseMiles) * perMileExtra * order.quantity : 0;
      const processingFee = order.price - subtotalBeforeFee - distFee;
      if (processingFee > 0.01) {
        lines.push({ desc: "Processing Fee (3.5%)", amt: fmt(processingFee) });
      }
    }

    // Draw rows
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    lines.forEach((line, i) => {
      const rowY = y + i * 8;
      doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 248);
      doc.rect(tableX, rowY, cw, 8, "F");
      doc.setDrawColor(...BORDER);
      doc.line(tableX, rowY + 8, tableX + cw, rowY + 8);
      doc.setTextColor(...DARK);
      doc.text(line.desc, tableX + 3, rowY + 5.5);
      doc.setFont("helvetica", "bold");
      doc.text(line.amt, tableX + labelW + 3, rowY + 5.5);
      doc.setFont("helvetica", "normal");
    });
    y += lines.length * 8;

    // Separator line
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(tableX, y, tableX + cw, y);
    doc.setLineWidth(0.2);
    y += 1;

    // TOTAL row
    doc.setFillColor(...GOLD);
    doc.rect(tableX, y, cw, 10, "F");
    doc.setTextColor(...NAVY);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(isPaid ? "TOTAL CHARGED" : "TOTAL DUE AT DELIVERY", tableX + 3, y + 7);
    doc.text(fmt(order.price), tableX + labelW + 3, y + 7);
    y += 14;

    // ─── PAYMENT STATUS BOX ───
    if (isPaid) {
      doc.setFillColor(240, 253, 244); // light green
      doc.rect(mx, y, cw, 20, "F");
      doc.setDrawColor(187, 247, 208);
      doc.rect(mx, y, cw, 20, "S");
      doc.setFontSize(14);
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.text("PAID IN FULL ✓", mx + cw / 2, y + 7, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Payment method: Credit Card`, mx + 3, y + 13);
      if (order.stripe_payment_id) {
        doc.text(`Reference: ${order.stripe_payment_id}`, mx + 3, y + 17);
      }
      doc.text("Nothing due at delivery", pw - mx - 3, y + 13, { align: "right" });
    } else {
      doc.setFillColor(255, 251, 235); // light amber
      doc.rect(mx, y, cw, 22, "F");
      doc.setDrawColor(253, 230, 138);
      doc.rect(mx, y, cw, 22, "S");
      doc.setFontSize(12);
      doc.setTextColor(...AMBER);
      doc.setFont("helvetica", "bold");
      doc.text("AMOUNT DUE AT DELIVERY", mx + cw / 2, y + 7, { align: "center" });
      doc.setFontSize(16);
      doc.setTextColor(194, 31, 50); // red
      doc.text(fmt(order.price), mx + cw / 2, y + 14, { align: "center" });
      doc.setFontSize(8);
      doc.setTextColor(...AMBER);
      doc.setFont("helvetica", "normal");
      doc.text("Please have exact amount ready. Driver carries no change.", mx + cw / 2, y + 19, { align: "center" });
    }
    y += (isPaid ? 24 : 26);

    // ─── DELIVERY TERMS ───
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY TERMS", mx, y);
    y += 5;

    const terms = [
      ["1. CURBSIDE DELIVERY ONLY", "All deliveries are curbside — between the curb and nearest sidewalk or driveway edge. Drivers will not enter private property."],
      ["2. ACCESSIBLE DELIVERY AREA", "Customer is responsible for ensuring clear and accessible delivery area prior to driver arrival."],
      ["3. LIABILITY", "Ways Materials LLC is not responsible for damage to driveways, landscaping, vehicles, irrigation systems, or any private property."],
      ["4. CUSTOMER PRESENCE", "Customer or designated representative must be present at time of delivery."],
      ["5. SAME-DAY ORDERS", "Subject to dispatch confirmation. Our team will call to confirm within 30 minutes of order placement."],
    ];

    doc.setFontSize(8);
    terms.forEach(([title, desc]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(title, mx, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const descLines = doc.splitTextToSize(desc, cw);
      descLines.forEach((line: string) => {
        doc.text(line, mx, y);
        y += 3.2;
      });
      y += 1.5;
    });

    y += 2;

    // ─── GOLD LINE ABOVE FOOTER ───
    doc.setFillColor(...GOLD);
    doc.rect(0, y, pw, 1.5, "F");
    y += 1.5;

    // ─── FOOTER ───
    const footerH = ph - y;
    doc.setFillColor(...NAVY);
    doc.rect(0, y, pw, Math.max(footerH, 28), "F");

    // Icon
    if (iconB64) {
      try { doc.addImage(`data:image/png;base64,${iconB64}`, "PNG", pw / 2 - 8, y + 3, 16, 16); } catch {}
    }

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Ways Materials LLC  |  Bridge City, Louisiana", pw / 2, y + 22, { align: "center" });
    doc.text("1-855-GOT-WAYS  |  orders@riversand.net", pw / 2, y + 26, { align: "center" });
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("This document serves as your official delivery confirmation and receipt.", pw / 2, y + 30, { align: "center" });

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
