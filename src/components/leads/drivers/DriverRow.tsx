// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).
import { Edit2 } from "lucide-react";
import { formatPhone } from "@/lib/format";
import type { Driver } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";

interface Props {
  driver: Driver;
  onEdit: (d: Driver) => void;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86400000);
}

export default function DriverRow({ driver, onEdit }: Props) {
  const license = daysUntil(driver.license_expires_on);
  const licenseColor =
    license === null ? "#9CA3AF" : license < 0 ? "#DC2626" : license <= 30 ? "#DC2626" : "#374151";
  const licenseText = driver.license_expires_on
    ? new Date(driver.license_expires_on + "T00:00:00").toLocaleDateString()
    : "—";

  const payRate = Number(driver.payment_rate || 0);
  const payText = `${driver.payment_type} · $${payRate.toFixed(2)}`;

  return (
    <tr
      className="border-b cursor-pointer hover:bg-gray-50 transition-colors"
      style={{ borderColor: "#E5E7EB" }}
      onClick={() => onEdit(driver)}
    >
      <td className="px-4 py-3 font-semibold" style={{ color: BRAND_NAVY }}>
        {driver.name}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
        {driver.phone ? formatPhone(driver.phone) : "—"}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
        {driver.truck_number || "—"}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
        {payText}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: licenseColor, fontWeight: license !== null && license <= 30 ? 600 : 400 }}>
        {licenseText}
        {license !== null && license <= 30 && license >= 0 && (
          <span className="ml-1 text-[10px]">({license}d)</span>
        )}
        {license !== null && license < 0 && <span className="ml-1 text-[10px]">(EXPIRED)</span>}
      </td>
      <td className="px-4 py-3">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
          style={{
            backgroundColor: driver.active ? "#DCFCE7" : "#F3F4F6",
            color: driver.active ? "#166534" : "#6B7280",
            border: `1px solid ${driver.active ? "#166534" : "#9CA3AF"}`,
          }}
        >
          {driver.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(driver);
          }}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border hover:bg-white transition-colors"
          style={{ color: BRAND_GOLD, borderColor: BRAND_GOLD }}
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>
      </td>
    </tr>
  );
}
