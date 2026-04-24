// Path B Phase 2 — generates WhatsApp deep link message for driver dispatch. Operator-driven send (wa.me). No API integration.

import type { Driver } from "@/components/leads/drivers/types";

// Minimal local Order type — only the fields the dispatch message needs.
// Intentionally narrow to avoid extracting a global Order type in Phase 2.
export interface Order {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_window: string | null;
  delivery_date: string | null;
  quantity: number | null;
  price: number | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  message_sent_at: string | null;
  driver_id: string | null;
}

function fmtDeliveryDate(iso: string | null): string {
  if (!iso) return "—";
  // Parse YYYY-MM-DD as local date (avoid UTC shift)
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtPaymentLine(order: Order): string {
  const price = Number(order.price) || 0;
  const priceStr = price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (order.payment_status === "paid") return "✅ PAID (prepaid)";
  if ((order.payment_method || "").toUpperCase() === "COD") {
    return `💵 COD — collect $${priceStr} on delivery`;
  }
  return `Payment method: ${order.payment_method || "—"}`;
}

export function formatOrderMessage(order: Order, driver: Driver): string {
  const qty = Number(order.quantity) || 0;
  const price = Number(order.price) || 0;
  const priceStr = price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    order.delivery_address || ""
  )}`;

  const lines: string[] = [];
  lines.push(`🚚 New delivery — ${order.order_number || "—"}`);
  lines.push("");
  lines.push(`Driver: ${driver.name}`);
  lines.push("");
  lines.push(`Customer: ${order.customer_name || "—"}`);
  if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);
  lines.push("");
  lines.push(`Address: ${order.delivery_address || "—"}`);
  lines.push(`Maps: ${mapsUrl}`);
  lines.push("");
  lines.push(`Date: ${fmtDeliveryDate(order.delivery_date)}`);
  lines.push(`Window: ${order.delivery_window || "—"}`);
  lines.push(`Load: ${qty} yard${qty === 1 ? "" : "s"}`);
  lines.push(`Total: $${priceStr}`);
  lines.push("");
  lines.push(fmtPaymentLine(order));
  if (order.notes && order.notes.trim().length > 0) {
    lines.push("");
    lines.push(`Notes: ${order.notes.trim()}`);
  }

  return lines.join("\n");
}

export function buildWhatsAppUrl(driverPhone: string, message: string): string {
  // Assumes US numbers. If a number has no country code, prepend '1'. Non-US drivers
  // would need explicit country code handling — revisit if fleet internationalizes.
  let digits = (driverPhone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "1" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function canSendToDriver(
  order: Order | null,
  driver: Driver | null
): { canSend: boolean; reason: string | null } {
  if (!order) return { canSend: false, reason: "No order selected." };
  if (!order.driver_id || !driver) {
    return { canSend: false, reason: "Assign a driver first." };
  }
  if (!driver.phone || driver.phone.trim().length === 0) {
    return { canSend: false, reason: "Driver has no phone number." };
  }
  if (driver.active === false) {
    return { canSend: false, reason: "Driver is inactive." };
  }
  return { canSend: true, reason: null };
}
