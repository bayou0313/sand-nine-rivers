// Slice C — Drivers Tab types.
// Versioned compensation + goals supplement legacy payment_type/payment_rate
// (kept on Driver for read-through fallback only — UI no longer writes them).

export type PaymentType = "per_load" | "hourly" | "flat_day";
export type DriverStatus = "active" | "on_leave" | "inactive";
export type CompType = "per_load" | "per_mile" | "hourly" | "flat_day" | "salary";
export type GoalType =
  | "loads_per_week"
  | "loads_per_month"
  | "revenue_per_week"
  | "revenue_per_month"
  | "on_time_pct"
  | "review_score";

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  truck_number: string | null;
  // Legacy single-rate fields. Kept for read fallback when no driver_compensation row exists.
  payment_type: PaymentType | string;
  payment_rate: number;
  license_expires_on: string | null; // ISO date
  notes: string | null;
  active: boolean;            // mirror of (status === 'active') — kept for backward compat
  status?: DriverStatus;       // 'active' | 'on_leave' | 'inactive'
  primary_hub_id?: string | null;
  pin_set?: boolean;
  created_at: string;
  updated_at: string;
}

export interface HubOption {
  id: string;
  name: string;
}

export interface Compensation {
  id: string;
  driver_id: string;
  comp_type: CompType;
  rate: number;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null;
  notes: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  driver_id: string;
  goal_type: GoalType;
  target_value: number;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  created_at: string;
}

export const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: "per_load", label: "Per Load" },
  { value: "hourly", label: "Hourly" },
  { value: "flat_day", label: "Flat Day" },
];

export const DRIVER_STATUSES: { value: DriverStatus; label: string; color: string }[] = [
  { value: "active",   label: "Active",   color: "#059669" },
  { value: "on_leave", label: "On Leave", color: "#D97706" },
  { value: "inactive", label: "Inactive", color: "#6B7280" },
];

export const COMP_TYPES: { value: CompType; label: string; unit: string }[] = [
  { value: "per_load", label: "Per Load", unit: "$ / load" },
  { value: "per_mile", label: "Per Mile", unit: "$ / mile" },
  { value: "hourly",   label: "Hourly",   unit: "$ / hour" },
  { value: "flat_day", label: "Flat Day", unit: "$ / day" },
  { value: "salary",   label: "Salary",   unit: "$ / year" },
];

export const GOAL_TYPES: { value: GoalType; label: string; unit: string }[] = [
  { value: "loads_per_week",   label: "Loads / Week",    unit: "loads" },
  { value: "loads_per_month",  label: "Loads / Month",   unit: "loads" },
  { value: "revenue_per_week", label: "Revenue / Week",  unit: "$" },
  { value: "revenue_per_month",label: "Revenue / Month", unit: "$" },
  { value: "on_time_pct",      label: "On-Time %",       unit: "%" },
  { value: "review_score",     label: "Avg Review",      unit: "stars" },
];

/**
 * License expiry tier — drives the color of the expiry text in DriverCard.
 *  - expired:  red bold (past today)
 *  - critical: red       (≤ 30 days)
 *  - warning:  amber     (31–90 days)
 *  - normal:   default   (> 90 days)
 *  - none:     no license date set
 */
export function licenseExpiryTier(
  iso: string | null | undefined
): "expired" | "critical" | "warning" | "normal" | "none" {
  if (!iso) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(iso + "T00:00:00");
  const days = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "normal";
}
