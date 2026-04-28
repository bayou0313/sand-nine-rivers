// Slice D Part 1 — Truck list card. Used in TrucksTab grid.
// Click → opens detail view. Status pill, hub + class badges, VIN tail.
import { Truck as TruckIcon, MapPin } from "lucide-react";
import { TRUCK_STATUSES, classBadgeColor, type Truck } from "./types";

const BRAND_NAVY = "#0D2137";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

interface Props {
  truck: Truck;
  onClick: (t: Truck) => void;
}

function statusPill(status: string | undefined) {
  const meta = TRUCK_STATUSES.find(s => s.value === status) || TRUCK_STATUSES[0];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: meta.color + "1A", color: meta.color, border: `1px solid ${meta.color}55` }}
    >
      {meta.label}
    </span>
  );
}

function classBadge(name: string | null | undefined) {
  if (!name) return null;
  const c = classBadgeColor(name);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: c + "1A", color: c, border: `1px solid ${c}55` }}
    >
      {name}
    </span>
  );
}

export default function TruckCard({ truck, onClick }: Props) {
  const status = truck.status || "active";
  const vinTail = truck.vin ? `…${truck.vin.slice(-6).toUpperCase()}` : null;
  const makeModel = [truck.year, truck.make, truck.model].filter(Boolean).join(" ").trim();

  return (
    <button
      type="button"
      onClick={() => onClick(truck)}
      className="text-left rounded-xl border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 flex flex-col gap-2"
      style={{ borderColor: BORDER }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display uppercase tracking-wide text-base truncate" style={{ color: BRAND_NAVY }}>
            {truck.name}
          </div>
          {makeModel && (
            <div className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>
              {makeModel}
            </div>
          )}
        </div>
        {statusPill(status)}
      </div>

      <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
        <MapPin className="w-3 h-3" />
        {truck.hub_name ? truck.hub_name : <span className="italic">No hub assigned</span>}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {classBadge(truck.class_name)}
        {truck.license_plate && (
          <span className="text-[11px] font-mono" style={{ color: MUTED }}>
            {truck.license_plate}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 mt-auto border-t text-xs" style={{ borderColor: "#F3F4F6" }}>
        <span className="flex items-center gap-1" style={{ color: MUTED }}>
          <TruckIcon className="w-3 h-3" />
          {vinTail || "No VIN"}
        </span>
        <span className="text-[11px]" style={{ color: BRAND_NAVY }}>View →</span>
      </div>
    </button>
  );
}
