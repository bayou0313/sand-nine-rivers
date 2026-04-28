// Slice C — Drivers tab. List view = 3-column grid of DriverCard with status
// segmented filter (All / Active / On Leave / Inactive). Click a card → detail view.
// No Delete buttons — soft-delete only via status (enforced at DB level by Slice A.9).
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import DriverCard from "./DriverCard";
import DriverModal from "./DriverModal";
import DriverDetail from "./DriverDetail";
import type { Driver, HubOption, DriverStatus } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const MUTED = "#6B7280";

interface Props {
  drivers: Driver[];
  loading: boolean;
  password: string;
  onRefresh: () => void;
}

type Filter = "all" | DriverStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "inactive", label: "Inactive" },
];

export default function DriversTab({ drivers, loading, password, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hubs, setHubs] = useState<HubOption[]>([]);

  // Hub options for card display + detail view
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "hub_list_for_select" },
      });
      if (!cancelled) setHubs((data as any)?.hubs || []);
    })();
    return () => { cancelled = true; };
  }, [password]);

  const hubName = useMemo(() => {
    const map = new Map(hubs.map(h => [h.id, h.name]));
    return (id: string | null | undefined) => (id ? map.get(id) || null : null);
  }, [hubs]);

  const visible = useMemo(() => {
    if (filter === "all") return drivers;
    return drivers.filter(d => {
      const s = (d.status as string) || (d.active ? "active" : "inactive");
      return s === filter;
    });
  }, [drivers, filter]);

  const counts = useMemo(() => {
    const c = { all: drivers.length, active: 0, on_leave: 0, inactive: 0 };
    drivers.forEach(d => {
      const s = (d.status as string) || (d.active ? "active" : "inactive");
      if (s === "active") c.active++;
      else if (s === "on_leave") c.on_leave++;
      else c.inactive++;
    });
    return c;
  }, [drivers]);

  const selected = useMemo(
    () => (selectedId ? drivers.find(d => d.id === selectedId) || null : null),
    [drivers, selectedId]
  );

  // ── Detail view ────────────────────────────────────────────────────────
  if (selected) {
    return (
      <DriverDetail
        driver={selected}
        hubs={hubs}
        password={password}
        onBack={() => setSelectedId(null)}
        onChanged={onRefresh}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
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
          <Button size="sm" onClick={() => setModalOpen(true)} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            <Plus className="w-4 h-4 mr-1" /> Add Driver
          </Button>
        </div>

        {/* Filter strip */}
        <div className="flex items-center gap-2 px-6 py-3 border-b" style={{ borderColor: "#E5E7EB" }}>
          {FILTERS.map(f => {
            const isActive = filter === f.value;
            const n = counts[f.value as keyof typeof counts];
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: isActive ? BRAND_NAVY : "transparent",
                  color: isActive ? "white" : MUTED,
                  border: `1px solid ${isActive ? BRAND_NAVY : "#E5E7EB"}`,
                }}
              >
                {f.label} <span className="ml-1 opacity-70">({n})</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: MUTED }}>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading drivers…
            </div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: MUTED }}>
              {drivers.length === 0
                ? 'No drivers yet. Click "Add Driver" to create the first one.'
                : "No drivers match the current filter."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map(d => (
                <DriverCard
                  key={d.id}
                  driver={d}
                  hubName={hubName(d.primary_hub_id)}
                  onClick={() => setSelectedId(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DriverModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        driver={null}
        password={password}
        onSaved={onRefresh}
      />
    </>
  );
}
