// Slice D Part 1 — Trucks Tab types.
// NOTE: the trucks table column is `name` (not `truck_number`). UI labels it
// "Truck Number" but binds to `name`. Keep that mapping consistent everywhere.

export type TruckStatus = "active" | "out_of_service" | "inactive";
export type TruckClassStatus = "active" | "inactive";

export interface Truck {
  id: string;
  name: string;                       // displayed as "Truck Number"
  hub_id: string | null;              // primary hub
  class_id: string | null;
  surecam_device_id: string | null;
  license_plate: string | null;
  vin: string | null;
  status: TruckStatus | string;
  notes: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  last_maintenance_date: string | null;
  next_service_due_date: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry: string | null;
  registration_state: string | null;
  registration_expiry: string | null;
  dot_number: string | null;
  dot_expiry: string | null;          // Slice A.10 — separate from registration
  created_at: string;
  updated_at: string;
  // Resolved (added by truck_list / truck_get_detail server actions):
  hub_name?: string | null;
  class_name?: string | null;
  current_driver_id?: string | null;
  current_driver_name?: string | null;
}

export interface TruckClass {
  id: string;
  name: string;
  description: string | null;
  capacity_tons: number | null;
  max_yards: number | null;
  max_tons: number | null;
  status: TruckClassStatus | string;
  active_truck_count?: number;
}

export interface TruckClassOption {
  id: string;
  name: string;
}

export interface HubOption {
  id: string;
  name: string;
}

export interface DriverOption {
  id: string;
  name: string;
}

export interface TruckAssignment {
  id: string;
  truck_id: string;
  driver_id: string | null;
  driver_name?: string | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
}

export interface TruckMaintenanceEntry {
  id: string;
  truck_id: string;
  service_date: string;
  service_type: string;
  description: string | null;
  cost: number | null;
  performed_by: string | null;
  mileage_at_service: number | null;
  next_service_due: string | null;
  parts_replaced: string[] | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TruckTelemetrySnapshot {
  state?: string | null;
  last_connected?: string | null;
  last_location?: { lat: number; lng: number; speed_mph: number | null; heading: number | null; time: string | null } | null;
}

export const TRUCK_STATUSES: { value: TruckStatus; label: string; color: string }[] = [
  { value: "active",         label: "Active",         color: "#10B981" },
  { value: "out_of_service", label: "Out of Service", color: "#D97706" },
  { value: "inactive",       label: "Inactive",       color: "#6B7280" },
];

/**
 * Date expiry tier — drives color of date text.
 * Mirrors licenseExpiryTier in drivers/types.ts.
 *  - expired:  red bold (past today)
 *  - critical: red       (≤ 30 days)
 *  - warning:  amber     (31–90 days)
 *  - normal:   default   (> 90 days)
 *  - none:     no date
 */
export function dateExpiryTier(
  iso: string | null | undefined,
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

/** Stable color hash → small palette of 5 brand-safe class badge colors. */
export function classBadgeColor(name: string | null | undefined): string {
  const palette = ["#0D2137", "#C07A00", "#0E7C66", "#7C3AED", "#B91C1C"];
  if (!name) return palette[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}
