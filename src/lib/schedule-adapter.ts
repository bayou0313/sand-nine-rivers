// Schedule adapter — pure status translation layer for the LMT Schedule tab.
// Single source of truth for the 5 display states + Missed derivation.
// No React, no side effects, no I/O.

export type ScheduleDisplayStatus =
  | "scheduled"   // confirmed, future or today
  | "en_route"    // driver dispatched
  | "delivered"   // completed
  | "cancelled"   // cancelled by ops or customer
  | "pending"     // unconfirmed / awaiting payment or review
  | "missed";     // past delivery_date with no terminal state

export interface ScheduleOrderLike {
  status?: string | null;
  payment_status?: string | null;
  delivery_date?: string | null; // YYYY-MM-DD
  cancelled_at?: string | null;
}

/** YYYY-MM-DD for the current local day. */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD for an arbitrary Date in local time. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Derive a display-level status from raw order fields.
 * "Missed" is derived: any order whose delivery_date is in the past and is not
 * delivered/cancelled gets surfaced as missed regardless of stored status.
 */
export function deriveDisplayStatus(
  order: ScheduleOrderLike,
  today: string = todayIsoDate(),
): ScheduleDisplayStatus {
  const status = (order.status || "").toLowerCase();
  const payment = (order.payment_status || "").toLowerCase();

  if (status === "cancelled" || order.cancelled_at) return "cancelled";
  if (status === "delivered") return "delivered";
  if (status === "en_route") return "en_route";

  const date = order.delivery_date || "";
  const isPast = !!date && date < today;
  const isTerminal = status === "delivered" || status === "cancelled";

  if (isPast && !isTerminal) return "missed";

  if (status === "confirmed") return "scheduled";
  if (status === "pending") return "pending";
  if (payment === "paid" || payment === "captured" || payment === "authorized") return "scheduled";
  return "pending";
}

/** Visual tokens for each display status. Matches Leads STATUS_COLORS palette. */
export const SCHEDULE_STATUS_TOKENS: Record<
  ScheduleDisplayStatus,
  { label: string; bg: string; text: string }
> = {
  scheduled: { label: "Scheduled", bg: "#EFF6FF", text: "#3B82F6" },
  en_route:  { label: "En route",  bg: "#FDF8F0", text: "#C07A00" },
  delivered: { label: "Delivered", bg: "#ECFDF5", text: "#059669" },
  cancelled: { label: "Cancelled", bg: "#FEF2F2", text: "#EF4444" },
  pending:   { label: "Pending",   bg: "#F3F4F6", text: "#6B7280" },
  missed:    { label: "Missed",    bg: "#FEF2F2", text: "#DC2626" },
};

export interface ScheduleSummary {
  orders: number;
  loads: number;
  revenue: number;
  paid: number;
  pending: number;
  missed: number;
}

/** Aggregate summary for a list of orders on a given day. */
export function summarizeOrders(
  orders: ScheduleOrderLike[],
  today: string = todayIsoDate(),
): ScheduleSummary {
  let loads = 0;
  let revenue = 0;
  let paid = 0;
  let pending = 0;
  let missed = 0;
  for (const o of orders as any[]) {
    loads += Number(o.quantity) || 0;
    revenue += Number(o.price) || 0;
    const ps = (o.payment_status || "").toLowerCase();
    if (ps === "paid" || ps === "captured") paid += 1;
    else pending += 1;
    if (deriveDisplayStatus(o, today) === "missed") missed += 1;
  }
  return { orders: orders.length, loads, revenue, paid, pending, missed };
}
