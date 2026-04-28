// Slice D Part 1 — Truck Detail view.
// Sections: Identity (read-only summary + Edit), Assignment (current + inline editor + history),
// Maintenance Log (read-only — Add deferred to Part 1.5/3), Telemetry placeholder (Part 2).
// No Delete buttons — soft-delete via status only.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Loader2, Pencil, Plus, MapPin, Truck as TruckIcon, AlertTriangle, User, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  TRUCK_STATUSES, classBadgeColor, dateExpiryTier,
  type Truck, type TruckAssignment, type TruckMaintenanceEntry, type TruckTelemetrySnapshot,
} from "./types";
import TruckModal from "./TruckModal";
import InlineAssignmentForm from "./InlineAssignmentForm";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const ALERT_RED = "#DC2626";
const WARN_AMBER = "#D97706";
const POSITIVE = "#059669";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

interface Props {
  truck: Truck;
  password: string;
  onBack: () => void;
  onChanged: () => void;
}

function statusPill(status: string | undefined) {
  const meta = TRUCK_STATUSES.find(s => s.value === status) || TRUCK_STATUSES[0];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
      style={{ backgroundColor: meta.color + "1A", color: meta.color, border: `1px solid ${meta.color}55` }}>
      {meta.label}
    </span>
  );
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso.length > 10 ? iso : iso + "T00:00:00").toLocaleDateString("en-US",
    { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US",
    { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function ExpiryRow({ label, iso }: { label: string; iso: string | null | undefined }) {
  const tier = dateExpiryTier(iso);
  const color = tier === "expired" || tier === "critical" ? ALERT_RED
    : tier === "warning" ? WARN_AMBER : BRAND_NAVY;
  const bold = tier === "expired";
  const tag = tier === "expired" ? "EXPIRED" : tier === "critical" ? "≤ 30 days"
    : tier === "warning" ? "≤ 90 days" : null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>{label}:</span>
      <span className={bold ? "font-bold" : ""} style={{ color }}>
        {(tier === "expired" || tier === "critical" || tier === "warning") && (
          <AlertTriangle className="w-3 h-3 inline mr-1" />
        )}
        {fmtDate(iso)}
        {tag && <span className="ml-1 text-[10px] font-bold uppercase">({tag})</span>}
      </span>
    </div>
  );
}

export default function TruckDetail({ truck, password, onBack, onChanged }: Props) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<TruckAssignment[]>([]);
  const [maintenance, setMaintenance] = useState<TruckMaintenanceEntry[]>([]);
  const [telemetry, setTelemetry] = useState<TruckTelemetrySnapshot | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "truck_get_detail", truck_id: truck.id },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setAssignments(((data as any).assignments || []) as TruckAssignment[]);
      setMaintenance(((data as any).maintenance || []) as TruckMaintenanceEntry[]);
      setTelemetry(((data as any).telemetry || null) as TruckTelemetrySnapshot | null);
    } catch (e: any) {
      toast({ title: "Failed to load truck detail", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [password, truck.id, toast]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const currentAssignment = useMemo(
    () => assignments.find(a => a.effective_to == null) || null,
    [assignments],
  );
  const cls = truck.class_name || "—";
  const classColor = classBadgeColor(truck.class_name);

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to trucks
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}
            style={{ backgroundColor: BRAND_NAVY, color: "white" }}>
            <Pencil className="w-3 h-3 mr-1" /> Edit Identity
          </Button>
        </div>

        {/* Identity */}
        <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="font-display uppercase tracking-wider text-2xl" style={{ color: BRAND_NAVY }}>
                {truck.name}
              </div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>
                {[truck.year, truck.make, truck.model].filter(Boolean).join(" ") || "—"}
              </div>
            </div>
            <div className="flex items-center gap-2">{statusPill(truck.status)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: MUTED }} />
              {truck.hub_name || <span className="italic" style={{ color: MUTED }}>No hub assigned</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>Class:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: classColor + "1A", color: classColor, border: `1px solid ${classColor}55` }}>
                {cls}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>VIN:</span>
              <span className="font-mono text-xs" style={{ color: BRAND_NAVY }}>{truck.vin || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>Plate:</span>
              <span className="font-mono text-xs" style={{ color: BRAND_NAVY }}>{truck.license_plate || "—"}</span>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: BORDER }}>
              <ExpiryRow label="Insurance" iso={truck.insurance_expiry} />
              <ExpiryRow label="Registration" iso={truck.registration_expiry} />
              <ExpiryRow label="DOT Inspection" iso={truck.dot_expiry} />
            </div>
            {truck.surecam_device_id && (
              <div className="flex items-center gap-2 md:col-span-2">
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>SureCam Device:</span>
                <span className="font-mono text-xs" style={{ color: BRAND_NAVY }}>{truck.surecam_device_id}</span>
              </div>
            )}
            {truck.notes && (
              <div className="md:col-span-2 pt-2 border-t" style={{ borderColor: BORDER }}>
                <div className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: MUTED }}>Notes</div>
                <div className="whitespace-pre-wrap" style={{ color: BRAND_NAVY }}>{truck.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Assignment */}
        <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="font-display uppercase tracking-wider text-base" style={{ color: BRAND_NAVY }}>
              Driver Assignment
            </h3>
            {!showAssignForm && (
              <Button size="sm" onClick={() => setShowAssignForm(true)}
                style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                <Plus className="w-3 h-3 mr-1" /> Edit Assignment
              </Button>
            )}
          </div>
          <div className="p-5 space-y-3">
            {showAssignForm && (
              <InlineAssignmentForm
                truckId={truck.id}
                hubId={truck.hub_id}
                password={password}
                onCancel={() => setShowAssignForm(false)}
                onSaved={async () => { setShowAssignForm(false); await loadDetail(); onChanged(); }}
              />
            )}

            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm" style={{ color: MUTED }}>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4" style={{ color: MUTED }} />
                  <span>Current driver: </span>
                  {currentAssignment?.driver_id
                    ? <span className="font-semibold" style={{ color: BRAND_NAVY }}>{currentAssignment.driver_name || "Unknown driver"}</span>
                    : <span className="italic" style={{ color: MUTED }}>No driver assigned</span>}
                  {currentAssignment && (
                    <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: POSITIVE + "1A", color: POSITIVE }}>
                      since {fmtDateTime(currentAssignment.effective_from)}
                    </span>
                  )}
                </div>

                {assignments.length > 1 && (
                  <div className="pt-3 border-t" style={{ borderColor: BORDER }}>
                    <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: MUTED }}>History</div>
                    <div className="space-y-1">
                      {assignments.slice(0, 10).map(a => (
                        <div key={a.id} className="flex items-center justify-between text-xs">
                          <span style={{ color: BRAND_NAVY }}>
                            {a.driver_name || (a.driver_id ? "Unknown driver" : <span className="italic" style={{ color: MUTED }}>Unassigned</span>)}
                          </span>
                          <span style={{ color: MUTED }}>
                            {fmtDateTime(a.effective_from)} → {a.effective_to ? fmtDateTime(a.effective_to) : "now"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Maintenance */}
        <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="font-display uppercase tracking-wider text-base flex items-center gap-2" style={{ color: BRAND_NAVY }}>
              <Wrench className="w-4 h-4" /> Maintenance Log
            </h3>
            <Button size="sm" disabled title="Coming in Part 1.5"
              style={{ backgroundColor: BRAND_GOLD, color: "white", opacity: 0.5 }}>
              <Plus className="w-3 h-3 mr-1" /> Add Maintenance
            </Button>
          </div>
          <div className="p-5">
            <div className="text-xs mb-3" style={{ color: MUTED }}>
              Last service: <span className="font-semibold" style={{ color: BRAND_NAVY }}>
                {truck.last_maintenance_date ? fmtDate(truck.last_maintenance_date) : "—"}
              </span>
              {truck.next_service_due_date && (
                <> · Next due: <span className="font-semibold" style={{ color: BRAND_NAVY }}>{fmtDate(truck.next_service_due_date)}</span></>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4 text-sm" style={{ color: MUTED }}>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
              </div>
            ) : maintenance.length === 0 ? (
              <div className="text-sm text-center py-4" style={{ color: MUTED }}>No maintenance entries yet.</div>
            ) : (
              <div className="space-y-1">
                {maintenance.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: "#F3F4F6" }}>
                    <span style={{ color: BRAND_NAVY }}>
                      <span className="font-semibold">{m.service_type}</span>
                      {m.description && <span className="ml-2" style={{ color: MUTED }}>· {m.description}</span>}
                    </span>
                    <span style={{ color: MUTED }}>{fmtDate(m.service_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Telemetry placeholder */}
        <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="font-display uppercase tracking-wider text-base flex items-center gap-2" style={{ color: BRAND_NAVY }}>
              <TruckIcon className="w-4 h-4" /> Telemetry
            </h3>
          </div>
          <div className="p-5">
            {telemetry ? (
              <div className="text-sm space-y-1">
                <div>State: <span className="font-semibold" style={{ color: BRAND_NAVY }}>{telemetry.state || "—"}</span></div>
                <div>Last seen: <span style={{ color: MUTED }}>{fmtDateTime(telemetry.last_connected)}</span></div>
                {telemetry.last_location && (
                  <div>Last location: <a target="_blank" rel="noopener noreferrer"
                    href={`https://www.google.com/maps?q=${telemetry.last_location.lat},${telemetry.last_location.lng}`}
                    style={{ color: BRAND_GOLD }}>
                    {telemetry.last_location.lat.toFixed(4)}, {telemetry.last_location.lng.toFixed(4)}
                  </a></div>
                )}
              </div>
            ) : (
              <div className="text-sm italic" style={{ color: MUTED }}>
                Live map and route history will appear here in Slice D Part 2.
                {truck.surecam_device_id ? null
                  : <span className="block mt-1">No SureCam Device ID set on this truck.</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <TruckModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        truck={truck}
        password={password}
        onSaved={() => { onChanged(); }}
      />
    </>
  );
}
