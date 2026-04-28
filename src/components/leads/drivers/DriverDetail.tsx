// Slice C — Driver Detail view.
// Shows: Identity (read-only summary + Edit button), Compensation history (versioned),
// Goals (diff-saved), Performance placeholder.
// No Delete buttons anywhere — soft-delete via status only.
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Loader2, Pencil, Plus, KeyRound, Phone, Mail, Truck, MapPin,
  AlertTriangle, X, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/format";
import {
  COMP_TYPES, DRIVER_STATUSES, GOAL_TYPES, licenseExpiryTier,
  type Compensation, type Driver, type Goal, type HubOption,
} from "./types";
import DriverModal from "./DriverModal";
import InlineCompensationForm from "./InlineCompensationForm";
import InlineGoalForm from "./InlineGoalForm";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const ALERT_RED = "#DC2626";
const WARN_AMBER = "#D97706";
const POSITIVE = "#059669";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

interface Props {
  driver: Driver;
  hubs: HubOption[];
  password: string;
  onBack: () => void;
  onChanged: () => void; // tells parent to refresh driver list
}

function compTypeLabel(v: string) {
  return COMP_TYPES.find(c => c.value === v)?.label || v;
}
function compTypeUnit(v: string) {
  return COMP_TYPES.find(c => c.value === v)?.unit || "";
}
function goalTypeLabel(v: string) {
  return GOAL_TYPES.find(g => g.value === v)?.label || v;
}
function goalTypeUnit(v: string) {
  return GOAL_TYPES.find(g => g.value === v)?.unit || "";
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US",
    { month: "short", day: "numeric", year: "numeric" });
}
function statusPill(status: string | undefined) {
  const meta = DRIVER_STATUSES.find(s => s.value === status) || DRIVER_STATUSES[0];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
      style={{ backgroundColor: meta.color + "1A", color: meta.color, border: `1px solid ${meta.color}55` }}
    >
      {meta.label}
    </span>
  );
}

export default function DriverDetail({ driver, hubs, password, onBack, onChanged }: Props) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [compensation, setCompensation] = useState<Compensation[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [showCompForm, setShowCompForm] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [pendingGoals, setPendingGoals] = useState<Goal[]>([]); // local diff buffer
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);

  const hub = useMemo(
    () => hubs.find(h => h.id === driver.primary_hub_id) || null,
    [hubs, driver.primary_hub_id]
  );

  async function loadCompensation() {
    setCompLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "list_driver_compensation", driver_id: driver.id },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Failed");
      setCompensation((data as any).compensation || []);
    } catch (e: any) {
      toast({ title: "Failed to load compensation", description: e?.message, variant: "destructive" });
    } finally {
      setCompLoading(false);
    }
  }

  async function loadGoals() {
    setGoalsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "list_driver_goals", driver_id: driver.id },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Failed");
      const arr = ((data as any).goals || []) as Goal[];
      setGoals(arr);
      setPendingGoals(arr);
    } catch (e: any) {
      toast({ title: "Failed to load goals", description: e?.message, variant: "destructive" });
    } finally {
      setGoalsLoading(false);
    }
  }

  useEffect(() => {
    loadCompensation();
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver.id]);

  const goalsDirty = useMemo(() => {
    if (pendingGoals.length !== goals.length) return true;
    const sortKey = (g: Goal) => `${g.id || "new"}|${g.goal_type}|${g.target_value}|${g.period_start}|${g.period_end}`;
    const a = [...goals].map(sortKey).sort().join("\n");
    const b = [...pendingGoals].map(sortKey).sort().join("\n");
    return a !== b;
  }, [goals, pendingGoals]);

  async function commitGoals() {
    setSavingGoals(true);
    try {
      const payload = pendingGoals.map(g => g.id ? { id: g.id } : {
        goal_type: g.goal_type,
        target_value: g.target_value,
        period_start: g.period_start,
        period_end: g.period_end,
      });
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "save_driver_goals", driver_id: driver.id, goals: payload },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Save failed");
      }
      const fresh = ((data as any).goals || []) as Goal[];
      setGoals(fresh);
      setPendingGoals(fresh);
      toast({ title: "Goals saved" });
    } catch (e: any) {
      toast({ title: "Failed to save goals", description: e?.message, variant: "destructive" });
    } finally {
      setSavingGoals(false);
    }
  }

  const tier = licenseExpiryTier(driver.license_expires_on);
  const expColor =
    tier === "expired" || tier === "critical" ? ALERT_RED :
    tier === "warning" ? WARN_AMBER : BRAND_NAVY;
  const expBold = tier === "expired";

  // Read-through fallback: if no compensation rows, show legacy payment_type/payment_rate as "(legacy)"
  const showLegacyComp = !compLoading && compensation.length === 0 && Number(driver.payment_rate) > 0;

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to drivers
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)} style={{ backgroundColor: BRAND_NAVY, color: "white" }}>
            <Pencil className="w-3 h-3 mr-1" /> Edit Identity
          </Button>
        </div>

        {/* Identity card */}
        <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="font-display uppercase tracking-wider text-2xl" style={{ color: BRAND_NAVY }}>
                {driver.name}
              </div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>
                Driver since {fmtDate(driver.created_at?.slice(0, 10))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusPill((driver.status as string) || (driver.active ? "active" : "inactive"))}
              {driver.pin_set && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase"
                  style={{ backgroundColor: POSITIVE + "1A", color: POSITIVE }}>
                  <KeyRound className="w-3 h-3" /> PIN Set
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: MUTED }} /> {formatPhone(driver.phone)}</div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4" style={{ color: MUTED }} /> {driver.email || <span className="italic" style={{ color: MUTED }}>—</span>}</div>
            <div className="flex items-center gap-2"><Truck className="w-4 h-4" style={{ color: MUTED }} /> {driver.truck_number || <span className="italic" style={{ color: MUTED }}>No truck</span>}</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: MUTED }} /> {hub ? hub.name : <span className="italic" style={{ color: MUTED }}>No hub assigned</span>}</div>
            <div className="flex items-center gap-2 md:col-span-2">
              <span style={{ color: MUTED }} className="text-xs uppercase tracking-wider font-bold">License Expires:</span>
              <span className={expBold ? "font-bold" : ""} style={{ color: expColor }}>
                {(tier === "expired" || tier === "critical" || tier === "warning") && (
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                )}
                {fmtDate(driver.license_expires_on)}
                {tier === "expired" && " (EXPIRED)"}
                {tier === "critical" && " (≤ 30 days)"}
                {tier === "warning" && " (≤ 90 days)"}
              </span>
            </div>
            {driver.notes && (
              <div className="md:col-span-2 pt-2 border-t" style={{ borderColor: BORDER }}>
                <div className="text-xs uppercase tracking-wider font-bold mb-1" style={{ color: MUTED }}>Notes</div>
                <div className="whitespace-pre-wrap" style={{ color: BRAND_NAVY }}>{driver.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Compensation */}
        <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="font-display uppercase tracking-wider text-base" style={{ color: BRAND_NAVY }}>
              Compensation History
            </h3>
            {!showCompForm && (
              <Button size="sm" onClick={() => setShowCompForm(true)} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                <Plus className="w-3 h-3 mr-1" /> New Rate
              </Button>
            )}
          </div>

          <div className="p-5 space-y-3">
            {showCompForm && (
              <InlineCompensationForm
                driverId={driver.id}
                password={password}
                onCancel={() => setShowCompForm(false)}
                onSaved={async () => {
                  setShowCompForm(false);
                  await loadCompensation();
                  onChanged();
                }}
              />
            )}

            {compLoading ? (
              <div className="flex items-center justify-center py-8 text-sm" style={{ color: MUTED }}>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
              </div>
            ) : compensation.length === 0 && !showLegacyComp ? (
              <div className="text-sm text-center py-6" style={{ color: MUTED }}>
                No compensation history yet. Click <strong>New Rate</strong> to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: BORDER, backgroundColor: "#F9FAFB" }}>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Type</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Rate</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Effective</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensation.map(c => {
                      const isOpen = c.effective_to == null;
                      return (
                        <tr key={c.id} className="border-b" style={{ borderColor: BORDER }}>
                          <td className="px-3 py-2">
                            <span className="font-semibold" style={{ color: BRAND_NAVY }}>{compTypeLabel(c.comp_type)}</span>
                            {isOpen && (
                              <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: POSITIVE + "1A", color: POSITIVE }}>
                                Current
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums">${Number(c.rate).toFixed(2)} <span className="text-xs" style={{ color: MUTED }}>{compTypeUnit(c.comp_type)}</span></td>
                          <td className="px-3 py-2 text-xs" style={{ color: MUTED }}>
                            {fmtDate(c.effective_from)} → {c.effective_to ? fmtDate(c.effective_to) : "now"}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: MUTED }}>{c.notes || "—"}</td>
                        </tr>
                      );
                    })}
                    {showLegacyComp && (
                      <tr style={{ backgroundColor: "#FEF3C7" }}>
                        <td className="px-3 py-2 text-xs" style={{ color: BRAND_NAVY }}>
                          <span className="font-semibold">{compTypeLabel(driver.payment_type)}</span>
                          <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                            Legacy
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-xs">${Number(driver.payment_rate).toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: MUTED }} colSpan={2}>
                          From legacy single-rate field. Add a new rate to migrate.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Goals */}
        <div className="rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="font-display uppercase tracking-wider text-base" style={{ color: BRAND_NAVY }}>
              Goals
            </h3>
            <div className="flex items-center gap-2">
              {goalsDirty && (
                <Button size="sm" onClick={commitGoals} disabled={savingGoals}
                  style={{ backgroundColor: POSITIVE, color: "white" }}>
                  {savingGoals ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                  Save Changes
                </Button>
              )}
              {!showGoalForm && (
                <Button size="sm" onClick={() => setShowGoalForm(true)}
                  style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                  <Plus className="w-3 h-3 mr-1" /> New Goal
                </Button>
              )}
            </div>
          </div>

          <div className="p-5 space-y-3">
            {showGoalForm && (
              <InlineGoalForm
                onCancel={() => setShowGoalForm(false)}
                onAdd={(g) => {
                  setPendingGoals(prev => [...prev, { ...g, id: "", driver_id: driver.id, created_at: "" }]);
                  setShowGoalForm(false);
                }}
              />
            )}

            {goalsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm" style={{ color: MUTED }}>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
              </div>
            ) : pendingGoals.length === 0 ? (
              <div className="text-sm text-center py-6" style={{ color: MUTED }}>
                No goals set. Click <strong>New Goal</strong> to add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingGoals.map((g, idx) => {
                  const isNew = !g.id;
                  return (
                    <div
                      key={g.id || `new-${idx}`}
                      className="rounded-lg border p-3 flex items-center justify-between gap-3"
                      style={{ borderColor: isNew ? BRAND_GOLD : BORDER, backgroundColor: isNew ? "#FFFBEB" : "white" }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>
                          {goalTypeLabel(g.goal_type)}
                          {isNew && <span className="ml-2 text-[10px]" style={{ color: BRAND_GOLD }}>(unsaved)</span>}
                        </div>
                        <div className="font-display text-xl mt-0.5 tabular-nums" style={{ color: BRAND_NAVY }}>
                          {Number(g.target_value).toLocaleString()} <span className="text-xs font-body" style={{ color: MUTED }}>{goalTypeUnit(g.goal_type)}</span>
                        </div>
                        <div className="text-[11px] mt-1" style={{ color: MUTED }}>
                          {fmtDate(g.period_start)} – {fmtDate(g.period_end)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setPendingGoals(prev => prev.filter((_, i) => i !== idx))}
                        title="Remove goal"
                      >
                        <X className="w-4 h-4" style={{ color: MUTED }} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Performance — placeholder */}
        <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
          <h3 className="font-display uppercase tracking-wider text-base mb-2" style={{ color: BRAND_NAVY }}>
            Performance
          </h3>
          <p className="text-sm" style={{ color: MUTED }}>
            Loads completed, on-time rate, revenue generated, and customer reviews will appear here once
            order driver-assignment data accumulates. (Slice C+ — backend instrumentation in progress.)
          </p>
        </div>
      </div>

      <DriverModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        driver={driver}
        password={password}
        onSaved={() => onChanged()}
      />
    </>
  );
}
