// Slice D Part 1 — Trucks tab. Replaces Phase 0 SureCam-only view.
// Header: status filter pills + Truck Classes button + Add Truck button.
// Body: SureCam Live Status (collapsible) + status pills + 3-col TruckCard grid.
// Soft-delete only — no Delete buttons.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Truck as TruckIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import TruckCard from "./TruckCard";
import TruckModal from "./TruckModal";
import TruckDetail from "./TruckDetail";
import TruckClassesModal from "./TruckClassesModal";
import SureCamLiveStatus from "./SureCamLiveStatus";
import type { Truck, TruckStatus } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

interface Props { password: string }

type Filter = "all" | TruckStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "out_of_service", label: "Out of Service" },
  { value: "inactive", label: "Inactive" },
];

export default function TrucksTab({ password }: Props) {
  const { toast } = useToast();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "truck_list" },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setTrucks(((data as any).trucks || []) as Truck[]);
    } catch (e: any) {
      toast({ title: "Failed to load trucks", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [password, toast]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (filter === "all") return trucks;
    return trucks.filter(t => (t.status || "active") === filter);
  }, [trucks, filter]);

  const counts = useMemo(() => {
    const c = { all: trucks.length, active: 0, out_of_service: 0, inactive: 0 };
    trucks.forEach(t => {
      const s = t.status || "active";
      if (s === "active") c.active++;
      else if (s === "out_of_service") c.out_of_service++;
      else c.inactive++;
    });
    return c;
  }, [trucks]);

  const selected = useMemo(
    () => (selectedId ? trucks.find(t => t.id === selectedId) || null : null),
    [trucks, selectedId],
  );

  if (selected) {
    return (
      <TruckDetail
        truck={selected}
        password={password}
        onBack={() => setSelectedId(null)}
        onChanged={load}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SureCamLiveStatus password={password} />

      <div className="rounded-xl border shadow-sm bg-white" style={{ borderColor: BORDER }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3">
            <TruckIcon className="w-5 h-5" style={{ color: BRAND_NAVY }} />
            <h2 className="font-display uppercase tracking-wider text-xl" style={{ color: BRAND_NAVY }}>
              Trucks
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setClassesOpen(true)}>
              <Layers className="w-4 h-4 mr-1" /> Truck Classes
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}
              style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
              <Plus className="w-4 h-4 mr-1" /> Add Truck
            </Button>
          </div>
        </div>

        {/* Filter strip */}
        <div className="flex items-center gap-2 px-6 py-3 border-b flex-wrap" style={{ borderColor: BORDER }}>
          {FILTERS.map(f => {
            const isActive = filter === f.value;
            const n = counts[f.value as keyof typeof counts];
            return (
              <button
                key={f.value} type="button" onClick={() => setFilter(f.value)}
                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: isActive ? BRAND_NAVY : "transparent",
                  color: isActive ? "white" : MUTED,
                  border: `1px solid ${isActive ? BRAND_NAVY : "#E5E7EB"}`,
                }}>
                {f.label} <span className="ml-1 opacity-70">({n})</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: MUTED }}>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading trucks…
            </div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: MUTED }}>
              {trucks.length === 0
                ? 'No trucks yet. Click "Add Truck" to create the first one.'
                : "No trucks match the current filter."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map(t => <TruckCard key={t.id} truck={t} onClick={() => setSelectedId(t.id)} />)}
            </div>
          )}
        </div>
      </div>

      <TruckModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        truck={null}
        password={password}
        onSaved={load}
      />
      <TruckClassesModal
        open={classesOpen}
        onClose={() => setClassesOpen(false)}
        password={password}
      />
    </div>
  );
}
