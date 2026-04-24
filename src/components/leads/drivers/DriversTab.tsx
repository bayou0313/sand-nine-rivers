// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).
import { useMemo, useState } from "react";
import { Loader2, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DriverRow from "./DriverRow";
import DriverModal from "./DriverModal";
import type { Driver } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";

interface Props {
  drivers: Driver[];
  loading: boolean;
  password: string;
  onRefresh: () => void;
}

export default function DriversTab({ drivers, loading, password, onRefresh }: Props) {
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);

  const visible = useMemo(
    () => (showInactive ? drivers : drivers.filter(d => d.active)),
    [drivers, showInactive]
  );
  const activeCount = useMemo(() => drivers.filter(d => d.active).length, [drivers]);

  function openAdd() {
    setSelected(null);
    setModalOpen(true);
  }
  function openEdit(d: Driver) {
    setSelected(d);
    setModalOpen(true);
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm bg-white" style={{ borderColor: "#E5E7EB" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5" style={{ color: BRAND_NAVY }} />
            <h2 className="font-display uppercase tracking-wider text-xl" style={{ color: BRAND_NAVY }}>
              Drivers
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="text-xs cursor-pointer" style={{ color: "#6B7280" }}>
                Show inactive
              </Label>
            </div>
            <Button
              size="sm"
              onClick={openAdd}
              style={{ backgroundColor: BRAND_GOLD, color: "white" }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Driver
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 border-b text-sm" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
          Active drivers: <span className="font-semibold" style={{ color: BRAND_NAVY }}>{activeCount}</span>
          {showInactive && (
            <>
              {" · "}Total: <span className="font-semibold" style={{ color: BRAND_NAVY }}>{drivers.length}</span>
            </>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#6B7280" }}>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading drivers…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "#6B7280" }}>
            {drivers.length === 0
              ? "No drivers yet. Click \"Add Driver\" to create the first one."
              : "No drivers match the current filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Name</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Phone</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Truck</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Payment</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>License Exp.</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Status</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(d => (
                  <DriverRow key={d.id} driver={d} onEdit={openEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DriverModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        driver={selected}
        password={password}
        onSaved={onRefresh}
      />
    </>
  );
}
