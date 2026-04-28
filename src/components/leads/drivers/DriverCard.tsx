// Slice C — Driver list card. Used in DriversTab grid.
// Click → opens detail view. License expiry colored by tier (expired/critical/warning/normal).
// Slice C+ — adds "Compensation needed" badge when no active driver_compensation row.
import { Truck, Phone, MapPin, AlertTriangle, AlertCircle } from "lucide-react";
import { DRIVER_STATUSES, licenseExpiryTier, type Driver } from "./types";
import { formatPhone } from "@/lib/format";

const BRAND_NAVY = "#0D2137";
const ALERT_RED = "#DC2626";
const WARN_AMBER = "#D97706";
const MUTED = "#6B7280";

interface Props {
  driver: Driver;
  hubName?: string | null;
  hasCompensation?: boolean;
  onClick: (d: Driver) => void;
}

function statusPill(status: string | undefined) {
  const meta = DRIVER_STATUSES.find(s => s.value === status) || DRIVER_STATUSES[0];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: meta.color + "1A", color: meta.color, border: `1px solid ${meta.color}55` }}
    >
      {meta.label}
    </span>
  );
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DriverCard({ driver, hubName, hasCompensation = true, onClick }: Props) {
  const tier = licenseExpiryTier(driver.license_expires_on);
  const expColor =
    tier === "expired" || tier === "critical" ? ALERT_RED :
    tier === "warning" ? WARN_AMBER : BRAND_NAVY;
  const expBold = tier === "expired";
  const expLabel =
    tier === "expired" ? "EXPIRED" :
    tier === "critical" ? "≤ 30 days" :
    tier === "warning" ? "≤ 90 days" : null;

  const status = (driver.status as string) || (driver.active ? "active" : "inactive");
  // Show "Compensation needed" badge when there's no active driver_compensation row.
  // Legacy payment_rate > 0 still triggers the nudge — versioned compensation is the
  // source of truth going forward (Slice C+).
  const needsCompensation = !hasCompensation;

  return (
    <button
      type="button"
      onClick={() => onClick(driver)}
      className="text-left rounded-xl border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 flex flex-col gap-2"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display uppercase tracking-wide text-base truncate" style={{ color: BRAND_NAVY }}>
            {driver.name}
          </div>
          {driver.truck_number && (
            <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: MUTED }}>
              <Truck className="w-3 h-3" /> {driver.truck_number}
            </div>
          )}
        </div>
        {statusPill(status)}
      </div>

      <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
        <Phone className="w-3 h-3" /> {formatPhone(driver.phone)}
      </div>

      <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
        <MapPin className="w-3 h-3" />
        {hubName ? hubName : <span className="italic">No hub assigned</span>}
      </div>

      <div className="flex items-center justify-between pt-2 mt-auto border-t text-xs" style={{ borderColor: "#F3F4F6" }}>
        <span style={{ color: MUTED }}>License</span>
        <span
          className={`flex items-center gap-1 ${expBold ? "font-bold" : ""}`}
          style={{ color: expColor }}
        >
          {(tier === "expired" || tier === "critical" || tier === "warning") && (
            <AlertTriangle className="w-3 h-3" />
          )}
          {formatExpiry(driver.license_expires_on)}
          {expLabel && <span className="ml-1 text-[10px] font-bold uppercase">({expLabel})</span>}
        </span>
      </div>

      {needsCompensation && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold"
          style={{
            backgroundColor: WARN_AMBER + "1A",
            color: WARN_AMBER,
            border: `1px solid ${WARN_AMBER}55`,
          }}
        >
          <AlertCircle className="w-3 h-3" />
          Compensation needed
        </div>
      )}
    </button>
  );
}
