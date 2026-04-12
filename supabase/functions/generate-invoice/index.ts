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

function fixDesignators(name: string): string {
  const designators: Record<string, string> = {
    'LLC': 'LLC', 'LCC': 'L.L.C.', 'LC': 'LC',
    'INC': 'Inc.', 'CORP': 'Corp.', 'LTD': 'Ltd.',
    'LLP': 'LLP', 'PLLC': 'PLLC', 'PC': 'PC', 'PA': 'PA',
    'LP': 'LP',
  };
  return name.split(' ').map(word => {
    const upper = word.replace(/[.,]/g, '').toUpperCase();
    return designators[upper] || word;
  }).join(' ');
}

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

interface BizSettings {
  legal_name: string;
  site_name: string;
  phone: string;
  website: string;
  footer_address: string;
  ein_number: string;
  support_email: string;
}

const DEFAULT_BIZ: BizSettings = {
  legal_name: "WAYS® Materials LLC",
  site_name: "River Sand",
  phone: "1-855-GOT-WAYS",
  website: "riversand.net",
  footer_address: "",
  ein_number: "",
  support_email: "",
};

function drawFooter(doc: jsPDF, pw: number, ph: number, mx: number, cw: number, footerLogoB64: string | null, biz: BizSettings) {
  const footerY = ph - 24;

  // Gold divider line above footer
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(mx, footerY, pw - mx, footerY);
  doc.setLineWidth(0.2);

  const textY = footerY + 10;

  // WAYS logo on the left — 40% larger
  if (footerLogoB64) {
    try {
      doc.addImage(`data:image/png;base64,${footerLogoB64}`, "PNG", mx, footerY + 2, 33.6, 0);
    } catch { /* skip */ }
  }

  // Build footer line dynamically
  const footerParts = [biz.legal_name, biz.website, biz.phone].filter(Boolean);
  const footerLine1 = footerParts.join("  |  ");

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BLACK);
  doc.text(footerLine1, pw - mx, textY, { align: "right" });

  let footerLineY = textY + 4;
  if (biz.footer_address) {
    doc.text(biz.footer_address, pw - mx, footerLineY, { align: "right" });
    footerLineY += 4;
  }
  if (biz.ein_number) {
    doc.text(`EIN: ${biz.ein_number}`, pw - mx, footerLineY, { align: "right" });
    footerLineY += 4;
  }

  doc.setFontSize(6);
  doc.setTextColor(...BLACK);
  doc.text("This document serves as your official order confirmation and receipt.", pw - mx, footerLineY, { align: "right" });
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

    // ─── Fetch business settings from global_settings ───
    const { data: settingsRows } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", [
        "legal_name", "site_name", "phone", "website",
        "footer_address", "ein_number", "support_email",
        "card_processing_fee_percent", "card_processing_fee_fixed",
        "pricing_mode",
      ]);

    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key: string; value: string }) => { settings[r.key] = r.value; });

    const biz: BizSettings = {
      legal_name: settings.legal_name || DEFAULT_BIZ.legal_name,
      site_name: settings.site_name || DEFAULT_BIZ.site_name,
      phone: settings.phone || DEFAULT_BIZ.phone,
      website: settings.website || DEFAULT_BIZ.website,
      footer_address: settings.footer_address || DEFAULT_BIZ.footer_address,
      ein_number: settings.ein_number || DEFAULT_BIZ.ein_number,
      support_email: settings.support_email || DEFAULT_BIZ.support_email,
    };

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
    // Pinned zone Y positions calculated dynamically in bottom section
    let y = 0;

    const invoiceNum = order.order_number || `RS-${order.id.substring(0, 8).toUpperCase()}`;
    const isPaid = order.payment_status === "paid";
    const isCard = !["cash", "check", "cod", "COD"].includes(order.payment_method || "");
    // For card payments, treat as paid even if payment_status hasn't been updated yet
    const effectivelyPaid = isPaid || isCard;
    console.log("[invoice] payment_method:", order.payment_method, "isPaid:", isPaid, "isCard:", isCard, "effectivelyPaid:", effectivelyPaid);
    // Fetch pit-specific pricing if order has pit_id
    let basePrice = 195;
    let baseMiles = 15;
    let perMileExtra = 5.0;
    // Prefer stored order.base_unit_price (captures price at time of order)
    if (order.base_unit_price) {
      basePrice = Number(order.base_unit_price);
    }
    if (order.pit_id) {
      const { data: pit } = await supabase.from("pits").select("base_price, free_miles, price_per_extra_mile").eq("id", order.pit_id).maybeSingle();
      if (pit) {
        if (!order.base_unit_price) basePrice = Number(pit.base_price) || basePrice;
        baseMiles = Number(pit.free_miles) || baseMiles;
        perMileExtra = Number(pit.price_per_extra_mile) || perMileExtra;
      }
    }
    const feeRate = Number(settings.card_processing_fee_percent || 3.5) / 100;
    const feeFixed = Number(settings.card_processing_fee_fixed || 0.30);
    const isBakedMode = settings.pricing_mode === "baked";

    // ─── HEADER ───
    y = 18;

    if (headerLogoB64) {
      try { doc.addImage(`data:image/png;base64,${headerLogoB64}`, "PNG", mx, 8, 55, 0); } catch {
        doc.setTextColor(...BLACK); doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(biz.site_name.toUpperCase(), mx, 18);
      }
    } else {
      doc.setTextColor(...BLACK); doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(biz.site_name.toUpperCase(), mx, 18);
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
    if (order.company_name) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text(fixDesignators(order.company_name), colRight, yR); yR += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.text(order.customer_name, colRight, yR); yR += 5;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text(order.customer_name, colRight, yR); yR += 5;
    }
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
    doc.text(`${biz.site_name} — 9 cu/yd  ×  ${order.quantity} load${order.quantity > 1 ? "s" : ""}`, mx, y);
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
    const sunSurcharge = order.sunday_surcharge ? (order.sunday_surcharge_amount || 0) : 0;
    const discountAmount = Number(order.discount_amount || 0);
    const taxAmount = Number(order.tax_amount || 0);
    const combinedRate = Number(order.tax_rate || 0);
    const subtotalBeforeFee = baseLine + distanceFee + satSurcharge + sunSurcharge - discountAmount + taxAmount;
    // In baked mode, no processing fee line — fee is included in base price
    const processingFee = !isBakedMode && isCard
      ? parseFloat((subtotalBeforeFee * feeRate + feeFixed).toFixed(2))
      : 0;
    console.log("[invoice] pricing breakdown:", { basePrice, baseLine, distanceFee, satSurcharge, sunSurcharge, discountAmount, taxAmount, subtotalBeforeFee, processingFee, feeRate, feeFixed, orderPrice: order.price, isBakedMode });

    // Parish detection for tax breakdown
    const PARISH_TAX_RATES: Record<string, number> = {
      "jefferson": 0.0530, "orleans": 0.0555, "st. bernard": 0.0555,
      "st. charles": 0.0555, "st. tammany": 0.0480, "plaquemines": 0.0530,
      "st. john the baptist": 0.0580, "st. james": 0.0405, "lafourche": 0.0525,
      "tangipahoa": 0.0500,
    };
    const LA_STATE_RATE = 0.0445;

    // Try to detect parish from address
    const addrLower = (order.delivery_address || "").toLowerCase();
    let parishName = "";
    let parishLocalRate = 0;
    // Check for "Parish" in address first
    const parishMatch = addrLower.match(/,\s*([^,]+?)\s+parish/i);
    if (parishMatch) {
      const key = parishMatch[1].trim().toLowerCase();
      if (PARISH_TAX_RATES[key] !== undefined) {
        parishName = key.replace(/\b\w/g, c => c.toUpperCase());
        parishLocalRate = PARISH_TAX_RATES[key];
      }
    }
    // Fallback: check if parish name appears anywhere in address
    if (!parishName) {
      const orderedKeys = Object.keys(PARISH_TAX_RATES).sort((a, b) => b.length - a.length);
      for (const k of orderedKeys) {
        if (addrLower.includes(k)) {
          parishName = k.replace(/\b\w/g, c => c.toUpperCase());
          parishLocalRate = PARISH_TAX_RATES[k];
          break;
        }
      }
    }
    // Fallback: city-to-parish mapping
    if (!parishName) {
      const cityToParish: Record<string, string> = {
        "new orleans": "orleans", "metairie": "jefferson", "kenner": "jefferson",
        "gretna": "jefferson", "harvey": "jefferson", "marrero": "jefferson",
        "westwego": "jefferson", "terrytown": "jefferson", "bridge city": "jefferson",
        "avondale": "jefferson", "chalmette": "st. bernard", "arabi": "st. bernard",
        "meraux": "st. bernard", "slidell": "st. tammany", "mandeville": "st. tammany",
        "covington": "st. tammany", "madisonville": "st. tammany", "abita springs": "st. tammany",
        "belle chasse": "plaquemines", "luling": "st. charles", "destrehan": "st. charles",
        "laplace": "st. john the baptist", "reserve": "st. john the baptist",
        "thibodaux": "lafourche", "hammond": "tangipahoa", "ponchatoula": "tangipahoa",
      };
      const sortedCities = Object.keys(cityToParish).sort((a, b) => b.length - a.length);
      for (const city of sortedCities) {
        if (addrLower.includes(city)) {
          const pk = cityToParish[city];
          parishName = pk.replace(/\b\w/g, c => c.toUpperCase());
          parishLocalRate = PARISH_TAX_RATES[pk] || 0;
          break;
        }
      }
    }
    // Last fallback: derive parish rate from combined rate
    if (!parishName && combinedRate > 0) {
      parishName = "Local";
      parishLocalRate = Math.max(0, combinedRate - LA_STATE_RATE);
    }

    interface PriceLine { desc: string; amt: string }
    const priceLines: PriceLine[] = [];
    priceLines.push({ desc: `${biz.site_name} — 9 cu/yd (×${qty})`, amt: fmt(baseLine) });
    if (distanceFee > 0) priceLines.push({ desc: "Extended area surcharge", amt: fmt(distanceFee) });
    if (satSurcharge > 0) priceLines.push({ desc: "Saturday surcharge", amt: fmt(satSurcharge) });
    if (sunSurcharge > 0) priceLines.push({ desc: "Sunday surcharge", amt: fmt(sunSurcharge) });
    if (discountAmount > 0) priceLines.push({ desc: "Discount", amt: `-${fmt(discountAmount)}` });
    if (taxAmount > 0) {
      // Split tax into state + parish lines
      const taxableBase = taxAmount / (combinedRate || 1); // reverse-calc taxable amount
      const stateAmt = Math.round(taxableBase * LA_STATE_RATE * 100) / 100;
      const parishAmt = Math.round((taxAmount - stateAmt) * 100) / 100;
      const stateRatePct = (LA_STATE_RATE * 100).toFixed(2);
      const parishRatePct = (parishLocalRate * 100).toFixed(2);

      priceLines.push({ desc: `Louisiana State Tax (${stateRatePct}%)`, amt: fmt(stateAmt) });
      const parishLabel = parishName ? `${parishName} Parish Tax (${parishRatePct}%)` : `Local Parish Tax (${parishRatePct}%)`;
      priceLines.push({ desc: parishLabel, amt: fmt(parishAmt) });
    }
    if (!isBakedMode && isCard && processingFee > 0.01) priceLines.push({ desc: "Card Processing Fee (3.5% + $0.30/transaction)", amt: fmt(processingFee) });

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

    // ─── SUBTOTAL / ACCOUNTING ROWS ───
    y += 2;
    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(tableX, y, pw - mx, y);
    y += 1;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(tableX, y, pw - mx, y);
    doc.setLineWidth(0.2);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text("TOTAL", tableX, y);
    doc.text(fmt(order.price), amtX, y, { align: "right" });
    y += 7;

    if (isCard && effectivelyPaid) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      const refStr = order.stripe_payment_id ? `···${(order.stripe_payment_id || "").slice(-12)}` : "";
      doc.text(`Credit Card  ${refStr}`, tableX, y);
      doc.setFont("helvetica", "bold");
      doc.text(`(${fmt(order.price)})`, amtX, y, { align: "right" });
      y += 7;
      doc.setDrawColor(...LIGHT_GRAY);
      doc.line(tableX, y - 3, pw - mx, y - 3);
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text("Amount Due", tableX, y + 1);
      doc.text("$0.00", amtX, y + 1, { align: "right" });
      y += 8;
    } else if (!isCard) {
      // COD: show simple TOTAL row
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      // Already shown as Subtotal above — no extra row needed for COD
    }

    // ─── PINNED BOTTOM ZONE (absolute Y positions, never move) ───
    const bullets = [
      "Curbside delivery only — curb to sidewalk/driveway edge. No private property entry.",
      "Customer must ensure clear, accessible delivery area before arrival.",
      "WAYS® Materials LLC not liable for damage to driveways, landscaping, or property.",
      "Customer or representative must be present at delivery.",
      "Same-day orders subject to dispatch confirmation within 30 minutes.",
      "Cancellation Policy: Orders canceled a day before scheduled delivery are fully refunded. Processing fees are non-refundable.",
    ];

    const hasCODBox = !effectivelyPaid;
    const hasPaidBox = effectivelyPaid;
    const pinnedBlockH = hasCODBox ? 14 : (hasPaidBox ? 14 : 0);
    const footerGoldY = ph - 24;
    const codGap = 6;

    // Measure delivery terms height
    let termsH = 5;
    bullets.forEach((b) => {
      const bLines = doc.splitTextToSize(`• ${b}`, cw);
      termsH += bLines.length * 3.5 + 0.5;
    });

    // Fixed Y positions (bottom → up)
    const pinnedTopY = footerGoldY - codGap - pinnedBlockH;
    const termsGap = (hasCODBox || hasPaidBox) ? 2 : 0;
    const termsTopY = pinnedTopY - termsGap - termsH;
    const safeContentMaxY = termsTopY - 4;

    // Paginate if content intrudes into pinned zone
    if (y > safeContentMaxY) {
      doc.addPage();
    }

    // Draw Delivery Terms at fixed Y
    let tY = termsTopY;
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text("DELIVERY TERMS", mx, tY);
    tY += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    bullets.forEach((b) => {
      const bLines = doc.splitTextToSize(`• ${b}`, cw);
      bLines.forEach((line: string) => { doc.text(line, mx, tY); tY += 3.5; });
      tY += 0.5;
    });

    // Draw Due at Delivery at fixed Y (COD only)
    if (hasCODBox) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("DUE AT DELIVERY", mx, pinnedTopY + 4);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text("Cash or check payment due at the time of delivery.", mx, pinnedTopY + 9);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(fmt(order.price), pw - mx, pinnedTopY + 4, { align: "right" });
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text("Exact amount required — driver carries no change", pw - mx, pinnedTopY + 9, { align: "right" });
    }

    // Draw PAID IN FULL at fixed Y (card only)
    if (hasPaidBox) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("PAID IN FULL", mx, pinnedTopY + 4);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text("Nothing due at delivery — payment collected by credit card", mx, pinnedTopY + 9);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(fmt(order.price), pw - mx, pinnedTopY + 4, { align: "right" });

      // Show card brand + last4 if available, otherwise Stripe ref
      const cardLast4 = (order as any).card_last4;
      const cardBrand = (order as any).card_brand;
      if (cardLast4) {
        const brandLabel = cardBrand
          ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)
          : "Card";
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRAY);
        doc.text(`${brandLabel} •••• ${cardLast4}`, pw - mx, pinnedTopY + 9, { align: "right" });
      } else if (order.stripe_payment_id) {
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRAY);
        doc.text(`Ref: ···${(order.stripe_payment_id || "").slice(-12)}`, pw - mx, pinnedTopY + 9, { align: "right" });
      }
    }

    // ─── FOOTER on last page, pinned to bottom ───
    drawFooter(doc, pw, ph, mx, cw, footerLogoB64, biz);

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