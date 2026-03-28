import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NAVY = [13, 33, 55] as const;    // #0D2137
const GOLD = [192, 122, 0] as const;   // #C07A00
const GRAY = [242, 242, 242] as const; // #F2F2F2
const WHITE = [255, 255, 255] as const;
const DARK = [51, 51, 51] as const;
const BORDER = [221, 221, 221] as const;

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

    // Build PDF
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pw = 215.9; // letter width mm
    const mx = 20; // margin
    const cw = pw - 2 * mx; // content width
    let y = 20;

    // --- HEADER BAR ---
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 36, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("WAYS RIVER SAND", mx, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("riversand.net", mx, 24);
    doc.text("1-855-GOT-WAYS", mx, 30);

    // INVOICE title on right
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GOLD);
    doc.text("INVOICE", pw - mx, 18, { align: "right" });
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "normal");
    const invoiceNum = order.order_number || `RS-${order.id.substring(0, 8).toUpperCase()}`;
    doc.text(`#${invoiceNum}`, pw - mx, 26, { align: "right" });
    doc.text(fmtShortDate(order.created_at), pw - mx, 32, { align: "right" });

    y = 46;

    // --- COMPANY & BILL TO side by side ---
    // Left: Issued By
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("ISSUED BY", mx, y);
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Ways Materials, LLC", mx, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Bridge City, Louisiana", mx, y + 12);
    doc.text("Phone: 1-855-GOT-WAYS", mx, y + 17);
    doc.text("Web: riversand.net", mx, y + 22);

    // Right: Bill To
    const rx = pw / 2 + 10;
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", rx, y);
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(order.customer_name, rx, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    // Wrap address
    const addrLines = doc.splitTextToSize(order.delivery_address, cw / 2 - 10);
    addrLines.forEach((line: string, i: number) => {
      doc.text(line, rx, y + 12 + i * 5);
    });
    const addrBottom = y + 12 + addrLines.length * 5;
    if (order.customer_phone) doc.text(order.customer_phone, rx, addrBottom);
    if (order.customer_email) doc.text(order.customer_email, rx, addrBottom + 5);

    y = Math.max(y + 30, addrBottom + 12);

    // --- INVOICE DETAILS ROW ---
    doc.setFillColor(...GRAY);
    doc.rect(mx, y, cw, 10, "F");
    doc.setDrawColor(...BORDER);
    doc.rect(mx, y, cw, 10, "S");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    const colW = cw / 4;
    doc.text("INVOICE NUMBER", mx + 3, y + 7);
    doc.text("INVOICE DATE", mx + colW + 3, y + 7);
    doc.text("DUE DATE", mx + colW * 2 + 3, y + 7);
    doc.text("TOTAL DUE", mx + colW * 3 + 3, y + 7);
    y += 10;
    doc.setFillColor(...WHITE);
    doc.rect(mx, y, cw, 10, "F");
    doc.rect(mx, y, cw, 10, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(invoiceNum, mx + 3, y + 7);
    doc.text(fmtShortDate(order.created_at), mx + colW + 3, y + 7);

    const isPaid = order.payment_status === "paid";
    const dueText = isPaid ? `Paid — ${fmtShortDate(order.created_at)}` : `Due at delivery`;
    doc.text(dueText, mx + colW * 2 + 3, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GOLD);
    doc.text(fmt(order.price), mx + colW * 3 + 3, y + 7);
    y += 16;

    // --- LINE ITEMS TABLE ---
    // Header
    doc.setFillColor(...NAVY);
    const tableX = mx;
    const descW = cw * 0.45;
    const qtyW = cw * 0.12;
    const unitW = cw * 0.2;
    const amtW = cw * 0.23;
    doc.rect(tableX, y, cw, 9, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", tableX + 3, y + 6);
    doc.text("QTY", tableX + descW + 3, y + 6);
    doc.text("UNIT PRICE", tableX + descW + qtyW + 3, y + 6);
    doc.text("AMOUNT", tableX + descW + qtyW + unitW + 3, y + 6);
    y += 9;

    // Line items
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const basePrice = 195;
    const baseMiles = 15;
    const perMileExtra = 5.5;
    const lines: Array<{ desc: string; qty: string; unit: string; amt: string }> = [];

    lines.push({
      desc: "River Sand — 9 cu/yd load, delivered",
      qty: String(order.quantity),
      unit: fmt(basePrice),
      amt: fmt(basePrice * order.quantity),
    });

    const distanceFee = order.distance_miles > baseMiles
      ? (order.distance_miles - baseMiles) * perMileExtra
      : 0;
    if (distanceFee > 0) {
      lines.push({
        desc: `Distance delivery fee (${order.distance_miles.toFixed(1)} mi)`,
        qty: String(order.quantity),
        unit: fmt(distanceFee),
        amt: fmt(distanceFee * order.quantity),
      });
    }

    if (order.saturday_surcharge && order.saturday_surcharge_amount > 0) {
      lines.push({
        desc: "Saturday delivery surcharge",
        qty: String(order.quantity),
        unit: fmt(35),
        amt: fmt(order.saturday_surcharge_amount),
      });
    }

    if (order.tax_amount > 0) {
      lines.push({
        desc: `Sales Tax — ${order.tax_parish || ''} (${(order.tax_rate * 100).toFixed(2)}%)`,
        qty: "—",
        unit: "—",
        amt: fmt(order.tax_amount),
      });
    }

    // Check if stripe-link → processing fee
    if (order.payment_method === "stripe-link") {
      const subtotalBeforeFee = basePrice * order.quantity + distanceFee * order.quantity + order.saturday_surcharge_amount + order.tax_amount;
      const processingFee = order.price - subtotalBeforeFee;
      if (processingFee > 0.01) {
        lines.push({
          desc: "Processing Fee (3.5%)",
          qty: "—",
          unit: "—",
          amt: fmt(processingFee),
        });
      }
    }

    lines.forEach((line, i) => {
      const rowY = y + i * 9;
      if (i % 2 === 0) {
        doc.setFillColor(...WHITE);
      } else {
        doc.setFillColor(248, 248, 248);
      }
      doc.rect(tableX, rowY, cw, 9, "F");
      doc.setDrawColor(...BORDER);
      doc.line(tableX, rowY + 9, tableX + cw, rowY + 9);

      doc.setTextColor(...DARK);
      doc.text(line.desc, tableX + 3, rowY + 6);
      doc.text(line.qty, tableX + descW + 3, rowY + 6);
      doc.text(line.unit, tableX + descW + qtyW + 3, rowY + 6);
      doc.setFont("helvetica", "bold");
      doc.text(line.amt, tableX + descW + qtyW + unitW + 3, rowY + 6);
      doc.setFont("helvetica", "normal");
    });

    y += lines.length * 9 + 2;

    // TOTAL row
    doc.setFillColor(...GOLD);
    doc.rect(tableX, y, cw, 12, "F");
    doc.setTextColor(...NAVY);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", tableX + 3, y + 8);
    doc.text(fmt(order.price), tableX + descW + qtyW + unitW + 3, y + 8);
    y += 18;

    // --- PAYMENT STATUS ---
    doc.setFillColor(...GRAY);
    doc.rect(mx, y, cw, 22, "F");
    doc.setDrawColor(...BORDER);
    doc.rect(mx, y, cw, 22, "S");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT", mx + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);

    const methodLabel = order.payment_method === "stripe-link" ? "Credit Card" :
                        order.payment_method === "cash" ? "Cash" :
                        order.payment_method === "check" ? "Check" : order.payment_method;
    doc.text(`Method: ${methodLabel}`, mx + 3, y + 13);

    if (isPaid) {
      doc.setTextColor(34, 197, 94); // green
      doc.setFont("helvetica", "bold");
      doc.text("PAID — Thank you", mx + 3, y + 19);
    } else {
      doc.setTextColor(...GOLD);
      doc.setFont("helvetica", "bold");
      doc.text(`PAYMENT DUE AT DELIVERY: ${fmt(order.price)}`, mx + 3, y + 19);
    }

    // Right side of payment box
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(`Amount: ${fmt(order.price)}`, pw - mx - 3, y + 13, { align: "right" });
    if (isPaid) {
      doc.text(`Balance Due: $0.00`, pw - mx - 3, y + 19, { align: "right" });
    } else {
      doc.text(`Due at Delivery: ${fmt(order.price)}`, pw - mx - 3, y + 19, { align: "right" });
    }

    y += 28;

    // --- DELIVERY INFO ---
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY INFORMATION", mx, y);
    y += 5;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Address: ${order.delivery_address}`, mx, y);
    y += 5;
    doc.text(`Date: ${fmtDate(order.delivery_date)}`, mx, y);
    y += 5;
    doc.text(`Window: ${order.delivery_window}`, mx, y);
    y += 5;
    if (order.same_day_requested) {
      doc.setTextColor(245, 158, 11);
      doc.text("⚡ Same-day delivery requested", mx, y);
      y += 5;
    }
    if (order.saturday_surcharge) {
      doc.text("Saturday delivery", mx, y);
      y += 5;
    }

    y += 8;

    // --- FOOTER ---
    doc.setDrawColor(...BORDER);
    doc.line(mx, y, pw - mx, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "italic");
    doc.text("This invoice is issued by Ways Materials, LLC operating as River Sand (riversand.net).", mx, y);
    y += 4;
    doc.text("For questions contact us at 1-855-GOT-WAYS or no_reply@riversand.net.", mx, y);
    y += 6;
    doc.setFontSize(7);
    doc.text("Powered by Haulogix, LLC", mx, y);

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
