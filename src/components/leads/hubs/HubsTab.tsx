/**
 * Slice B — Hubs Tab
 *
 * Self-contained operational dashboard for managing dispatch Hubs.
 * Renders three views: list, detail (Identity + Rate Matrix + Attached Pits),
 * plus modals for create / edit identity / edit rates / attach pits.
 *
 * All data access goes through the leads-auth edge function.
 *
 * UI conventions:
 * - LMT design tokens (T.* passed in from parent)
 * - Brand: BRAND_NAVY / BRAND_GOLD / POSITIVE / ALERT_RED / WARN_YELLOW
 * - bonus_pct stored as 0..1 fraction; UI shows/accepts whole-number percent
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ArrowLeft, AlertTriangle, Pencil, Link2, Unlink, Pause, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PlaceAutocompleteInput, { type PlaceSelectResult } from "@/components/PlaceAutocompleteInput";
import EmailInput from "@/components/EmailInput";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { formatPhone, stripPhone } from "@/lib/format";
import { formatEmail } from "@/lib/textFormat";

// ─── Brand Constants (mirror Leads.tsx) ─────────────────────────────────────
const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const POSITIVE = "#059669";
const ALERT_RED = "#DC2626";
const WARN_YELLOW = "#D97706";

interface HubsTabProps {
  T: any;
  storedPassword: () => string;
}

interface HubSummary {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  contact_email: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  truck_class_count: number;
  rates_unset_count: number;
  truck_count: number;
  attached_pit_count: number;
  active_pit_count: number;
}

interface TruckClass {
  id: string;
  name: string;
  description: string | null;
  capacity_tons: number | null;
  status: string;
}

interface RateRow {
  hub_id: string;
  truck_class_id: string;
  per_mile_rate: number;
  base_delivery_fee: number;
  driver_extra_mile_bonus_pct: number;
}

interface AttachedPit {
  pit_id: string;
  status: string;
  priority: number;
  pit: { id: string; name: string; address: string; status: string } | null;
}

export default function HubsTab({ T, storedPassword }: HubsTabProps) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "detail">("list");
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  // Detail state
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailHub, setDetailHub] = useState<any | null>(null);
  const [truckClasses, setTruckClasses] = useState<TruckClass[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [attachedPits, setAttachedPits] = useState<AttachedPit[]>([]);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEditIdentity, setShowEditIdentity] = useState(false);
  const [showEditRates, setShowEditRates] = useState(false);
  const [showAttachPits, setShowAttachPits] = useState(false);

  // ─── Load hub list ──────────────────────────────────────────────────────
  async function loadHubs() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_list" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setHubs((data as any).hubs || []);
    } catch (err: any) {
      toast({ title: "Failed to load hubs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(hubId: string) {
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_get_detail", hub_id: hubId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDetailHub((data as any).hub);
      setTruckClasses((data as any).truck_classes || []);
      setRates((data as any).rates || []);
      setAttachedPits((data as any).attached_pits || []);
    } catch (err: any) {
      toast({ title: "Failed to load hub", description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadHubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "detail" && selectedHubId) loadDetail(selectedHubId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedHubId]);

  // ─── Render ─────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>Hub Manager</h3>
            <p className="text-sm" style={{ color: T.textSecond }}>{hubs.length} {hubs.length === 1 ? "hub" : "hubs"}</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            <Plus className="w-4 h-4 mr-1" /> Add Hub
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND_GOLD }} /></div>
        ) : hubs.length === 0 ? (
          <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
            <p className="text-sm mb-3" style={{ color: T.textSecond }}>No hubs yet.</p>
            <Button size="sm" onClick={() => setShowCreate(true)} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
              <Plus className="w-4 h-4 mr-1" /> Create your first hub
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {hubs.map((h) => (
              <button
                key={h.id}
                onClick={() => { setSelectedHubId(h.id); setView("detail"); }}
                className="text-left rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer"
                style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-sm" style={{ color: T.textPrimary }}>{h.name}</div>
                  <StatusPill status={h.status} />
                </div>
                {h.address && <p className="text-xs mb-2 truncate" style={{ color: T.textSecond }}>{h.address}</p>}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <Stat label="Trucks" value={h.truck_count ?? 0} T={T} />
                  <Stat label="Pits" value={`${h.active_pit_count}/${h.attached_pit_count}`} T={T} />
                  <Stat label="Rates set" value={`${h.truck_class_count - h.rates_unset_count}/${h.truck_class_count}`} T={T} />
                </div>
                {h.rates_unset_count > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: WARN_YELLOW }}>
                    <AlertTriangle className="w-3 h-3" />
                    {h.rates_unset_count} rate{h.rates_unset_count === 1 ? "" : "s"} unset
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <CreateHubModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          T={T}
          storedPassword={storedPassword}
          onCreated={(id) => {
            setShowCreate(false);
            loadHubs();
            setSelectedHubId(id);
            setView("detail");
            toast({ title: "Hub created" });
          }}
        />
      </div>
    );
  }

  // ─── DETAIL VIEW ────────────────────────────────────────────────────────
  const hasUnsetRate = rates.some((r) => Number(r.per_mile_rate || 0) === 0);
  const activeTruckClasses = truckClasses.filter((tc) => tc.status === "active");

  return (
    <div>
      <button
        onClick={() => { setView("list"); setSelectedHubId(null); setDetailHub(null); loadHubs(); }}
        className="flex items-center gap-1 text-sm mb-4 hover:underline"
        style={{ color: BRAND_GOLD }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to hubs
      </button>

      {detailLoading || !detailHub ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND_GOLD }} /></div>
      ) : (
        <>
          {hasUnsetRate && (
            <div className="rounded-lg border p-3 mb-4 flex items-start gap-2"
              style={{ backgroundColor: "#FFFBEB", borderColor: WARN_YELLOW, color: "#7C2D12" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: WARN_YELLOW }} />
              <div className="text-sm">
                <strong>Hub not yet operational.</strong> One or more truck-class rates have <code>per_mile_rate = 0</code>. Set rates before this hub can quote deliveries.
              </div>
            </div>
          )}

          {/* IDENTITY SECTION */}
          <Section title="Identity" T={T} action={
            <Button size="sm" variant="outline" onClick={() => setShowEditIdentity(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Name" value={detailHub.name} T={T} />
              <Field label="Status" value={<StatusPill status={detailHub.status} />} T={T} />
              <Field label="Address" value={detailHub.address || "—"} T={T} />
              <Field label="Phone" value={detailHub.phone || "—"} T={T} />
              <Field label="Contact email" value={detailHub.contact_email || "—"} T={T} />
              <Field label="Coordinates" value={detailHub.lat != null && detailHub.lng != null ? `${Number(detailHub.lat).toFixed(5)}, ${Number(detailHub.lng).toFixed(5)}` : "—"} T={T} />
            </div>
          </Section>

          {/* RATE MATRIX */}
          <Section title="Rate Matrix" T={T} action={
            <Button size="sm" variant="outline" onClick={() => setShowEditRates(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Rates
            </Button>
          }>
            {activeTruckClasses.length === 0 ? (
              <p className="text-sm" style={{ color: T.textSecond }}>No active truck classes configured.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: T.tableHeaderBg }}>
                      <Th T={T}>Truck Class</Th>
                      <Th T={T} right>Base Fee</Th>
                      <Th T={T} right>$/mile</Th>
                      <Th T={T} right>Driver Bonus</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTruckClasses.map((tc) => {
                      const r = rates.find((x) => x.truck_class_id === tc.id);
                      const ppm = Number(r?.per_mile_rate || 0);
                      const bdf = Number(r?.base_delivery_fee || 0);
                      return (
                        <tr key={tc.id} style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                          <td className="px-3 py-2" style={{ color: T.textPrimary }}>
                            <div className="font-medium">{tc.name}</div>
                            {tc.description && <div className="text-[11px]" style={{ color: T.textSecond }}>{tc.description}</div>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: bdf === 0 ? WARN_YELLOW : T.textPrimary }}>
                            ${bdf.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: ppm === 0 ? WARN_YELLOW : T.textPrimary }}>
                            ${ppm.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: T.textPrimary }}>
                            {(Number(r?.driver_extra_mile_bonus_pct || 0) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ATTACHED PITS */}
          <Section title={`Attached Pits (${attachedPits.length})`} T={T} action={
            <Button size="sm" variant="outline" onClick={() => setShowAttachPits(true)}>
              <Link2 className="w-3.5 h-3.5 mr-1" /> Attach Pits
            </Button>
          }>
            {attachedPits.length === 0 ? (
              <p className="text-sm" style={{ color: T.textSecond }}>No pits attached. Click "Attach Pits" to link this hub to one or more pits.</p>
            ) : (
              <div className="space-y-2">
                {attachedPits.map((ap) => (
                  <div key={ap.pit_id} className="flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{ backgroundColor: T.subtleBg, borderColor: T.cardBorder }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: T.textPrimary }}>
                          {ap.pit?.name || "(deleted pit)"}
                        </span>
                        <StatusPill status={ap.status} />
                      </div>
                      {ap.pit?.address && <div className="text-[11px] truncate" style={{ color: T.textSecond }}>{ap.pit.address}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => togglePitStatus(ap)}>
                        {ap.status === "active" ? <><Pause className="w-3.5 h-3.5 mr-1" /> Pause</> : <><Play className="w-3.5 h-3.5 mr-1" /> Resume</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => detachPit(ap)} style={{ color: ALERT_RED, borderColor: ALERT_RED }}>
                        <Unlink className="w-3.5 h-3.5 mr-1" /> Detach
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {detailHub && (
        <>
          <EditIdentityModal
            open={showEditIdentity}
            onClose={() => setShowEditIdentity(false)}
            hub={detailHub}
            T={T}
            storedPassword={storedPassword}
            onSaved={() => { setShowEditIdentity(false); loadDetail(detailHub.id); loadHubs(); toast({ title: "Identity saved" }); }}
          />
          <EditRatesModal
            open={showEditRates}
            onClose={() => setShowEditRates(false)}
            hubId={detailHub.id}
            truckClasses={activeTruckClasses}
            existingRates={rates}
            T={T}
            storedPassword={storedPassword}
            onSaved={() => { setShowEditRates(false); loadDetail(detailHub.id); loadHubs(); toast({ title: "Rates saved" }); }}
          />
          <AttachPitsModal
            open={showAttachPits}
            onClose={() => setShowAttachPits(false)}
            hubId={detailHub.id}
            T={T}
            storedPassword={storedPassword}
            onAttached={(n) => { setShowAttachPits(false); loadDetail(detailHub.id); loadHubs(); toast({ title: `Attached ${n} pit${n === 1 ? "" : "s"}` }); }}
          />
        </>
      )}
    </div>
  );

  // ─── Action handlers ────────────────────────────────────────────────────
  async function togglePitStatus(ap: AttachedPit) {
    if (!detailHub) return;
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_toggle_pit_status", hub_id: detailHub.id, pit_id: ap.pit_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      loadDetail(detailHub.id);
      loadHubs();
    } catch (err: any) {
      toast({ title: "Toggle failed", description: err.message, variant: "destructive" });
    }
  }

  async function detachPit(ap: AttachedPit) {
    if (!detailHub) return;
    if (!window.confirm(`Detach "${ap.pit?.name || "this pit"}" from ${detailHub.name}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_detach_pit", hub_id: detailHub.id, pit_id: ap.pit_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      loadDetail(detailHub.id);
      loadHubs();
      toast({ title: "Pit detached" });
    } catch (err: any) {
      toast({ title: "Detach failed", description: err.message, variant: "destructive" });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, action, children, T }: { title: string; action?: React.ReactNode; children: React.ReactNode; T: any }) {
  return (
    <div className="rounded-xl border p-5 mb-4" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display uppercase tracking-wide text-sm" style={{ color: T.textPrimary }}>{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, T }: { label: string; value: any; T: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textSecond }}>{label}</div>
      <div style={{ color: T.textPrimary }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, T }: { label: string; value: any; T: any }) {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: T.subtleBg }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: T.textSecond }}>{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color: T.textPrimary }}>{value}</div>
    </div>
  );
}

function Th({ children, right, T }: { children: React.ReactNode; right?: boolean; T: any }) {
  return (
    <th className={`px-3 py-2 text-[11px] uppercase tracking-wide font-bold ${right ? "text-right" : "text-left"}`}
      style={{ color: T.tableHeaderText }}>
      {children}
    </th>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active:   { bg: "#DCFCE7", fg: "#065F46", label: "Active" },
    inactive: { bg: "#F3F4F6", fg: "#374151", label: "Inactive" },
    paused:   { bg: "#FEF3C7", fg: "#92400E", label: "Paused" },
  };
  const s = map[status] || { bg: "#F3F4F6", fg: "#374151", label: status };
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE HUB MODAL
// ═══════════════════════════════════════════════════════════════════════════
function CreateHubModal({ open, onClose, T, storedPassword, onCreated }: {
  open: boolean; onClose: () => void; T: any; storedPassword: () => string; onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const { loaded: googleLoaded } = useGoogleMaps();
  const [saving, setSaving] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", phone: "", contact_email: "",
    lat: null as number | null, lng: null as number | null,
  });

  useEffect(() => {
    if (open) {
      setForm({ name: "", address: "", phone: "", contact_email: "", lat: null, lng: null });
      setFormAttempted(false);
    }
  }, [open]);

  const isFormValid = !!form.name.trim();

  useEffect(() => {
    if (isFormValid && formAttempted) setFormAttempted(false);
  }, [isFormValid, formAttempted]);

  function handlePlaceSelect(result: PlaceSelectResult) {
    setForm((f) => ({ ...f, address: result.formattedAddress, lat: result.lat, lng: result.lng }));
  }

  async function handleCreate() {
    if (!isFormValid) {
      setFormAttempted(true);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          password: storedPassword(),
          action: "hub_create",
          hub: {
            name: form.name.trim(),
            address: form.address || null,
            phone: form.phone ? stripPhone(form.phone) : null,
            contact_email: form.contact_email ? formatEmail(form.contact_email).trim() : null,
            lat: form.lat,
            lng: form.lng,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      onCreated((data as any).hub.id);
    } catch (err: any) {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const showNameError = formAttempted && !form.name.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Hub</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="Name *">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Kenner Hub"
              className={showNameError ? "border-2" : ""}
              style={showNameError ? { borderColor: ALERT_RED } : undefined}
            />
            {showNameError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ALERT_RED }}>
                <AlertCircle className="w-3 h-3" /> Required
              </div>
            )}
          </FormRow>
          <FormRow label="Address">
            {googleLoaded ? (
              <PlaceAutocompleteInput
                onPlaceSelect={handlePlaceSelect}
                onInputChange={(val) => setForm((f) => ({ ...f, address: val, lat: null, lng: null }))}
                placeholder="Start typing an address..."
                initialValue={form.address}
                containerClassName="place-autocomplete-admin"
              />
            ) : (
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value, lat: null, lng: null })}
                placeholder="Loading Google Maps..."
              />
            )}
            {form.address && form.lat == null && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: WARN_YELLOW }}>
                <AlertTriangle className="w-3 h-3" /> Select from suggestions to capture coordinates
              </p>
            )}
            {form.lat != null && form.lng != null && (
              <p className="text-xs mt-1" style={{ color: T.textSecond }}>
                ✓ {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
              </p>
            )}
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Phone">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={14}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                placeholder="(504) 555-0100"
              />
            </FormRow>
            <FormRow label="Contact email">
              <EmailInput
                value={form.contact_email}
                onChange={(v) => setForm({ ...form, contact_email: formatEmail(v) })}
              />
            </FormRow>
          </div>
          <p className="text-[11px]" style={{ color: T.textSecond }}>
            Active truck classes will be auto-attached with default rates ($120 base fee, $0/mile). Set per-class rates after creating.
          </p>
          {formAttempted && !isFormValid && (
            <p className="text-xs" style={{ color: ALERT_RED }}>
              Please fill in all required fields above.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Hub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT IDENTITY MODAL
// ═══════════════════════════════════════════════════════════════════════════
function EditIdentityModal({ open, onClose, hub, T, storedPassword, onSaved }: {
  open: boolean; onClose: () => void; hub: any; T: any; storedPassword: () => string; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open && hub) {
      setForm({
        name: hub.name || "",
        address: hub.address || "",
        phone: hub.phone || "",
        contact_email: hub.contact_email || "",
        lat: hub.lat ?? "",
        lng: hub.lng ?? "",
        status: hub.status || "active",
      });
    }
  }, [open, hub]);

  async function handleSave() {
    if (!form.name?.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_update_identity", hub_id: hub.id, hub: form },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      onSaved();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Identity</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="Name *"><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormRow>
          <FormRow label="Address"><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Latitude"><Input value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></FormRow>
            <FormRow label="Longitude"><Input value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Phone"><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormRow>
            <FormRow label="Contact email"><Input type="email" value={form.contact_email || ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></FormRow>
          </div>
          <FormRow label="Status">
            <select className="w-full h-10 rounded-md border px-2 text-sm bg-background"
              value={form.status || "active"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT RATES MODAL
// ═══════════════════════════════════════════════════════════════════════════
function EditRatesModal({ open, onClose, hubId, truckClasses, existingRates, T, storedPassword, onSaved }: {
  open: boolean; onClose: () => void; hubId: string; truckClasses: TruckClass[]; existingRates: RateRow[];
  T: any; storedPassword: () => string; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, { base_delivery_fee: string; per_mile_rate: string; driver_extra_mile_bonus_pct: string }>>({});

  useEffect(() => {
    if (open) {
      const next: typeof draft = {};
      truckClasses.forEach((tc) => {
        const r = existingRates.find((x) => x.truck_class_id === tc.id);
        next[tc.id] = {
          base_delivery_fee: String(r?.base_delivery_fee ?? 120),
          per_mile_rate: String(r?.per_mile_rate ?? 0),
          // Display as whole-number percent (stored 0..1)
          driver_extra_mile_bonus_pct: String((Number(r?.driver_extra_mile_bonus_pct ?? 0) * 100).toFixed(2)).replace(/\.00$/, ""),
        };
      });
      setDraft(next);
    }
  }, [open, truckClasses, existingRates]);

  function update(tcId: string, key: string, value: string) {
    setDraft((d) => ({ ...d, [tcId]: { ...d[tcId], [key]: value } }));
  }

  async function handleSave() {
    // Validate bonus 0..100
    for (const tc of truckClasses) {
      const v = Number(draft[tc.id]?.driver_extra_mile_bonus_pct || 0);
      if (v < 0 || v > 100) {
        toast({ title: "Invalid bonus %", description: `${tc.name}: must be 0–100`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const rates = truckClasses.map((tc) => {
        const d = draft[tc.id];
        return {
          truck_class_id: tc.id,
          base_delivery_fee: Number(d?.base_delivery_fee || 120),
          per_mile_rate: Number(d?.per_mile_rate || 0),
          // Convert whole-number percent → 0..1 fraction for storage
          driver_extra_mile_bonus_pct: Number(d?.driver_extra_mile_bonus_pct || 0) / 100,
        };
      });
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_update_rates", hub_id: hubId, rates },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      onSaved();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Edit Rate Matrix</DialogTitle></DialogHeader>
        <p className="text-xs" style={{ color: T.textSecond }}>
          Driver bonus is entered as a whole-number percent (e.g. <code>10</code> = 10%) and stored as a fraction. Base fee defaults to $120 if left blank.
        </p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: T.tableHeaderBg }}>
                <Th T={T}>Truck Class</Th>
                <Th T={T} right>Base Fee</Th>
                <Th T={T} right>$/mile</Th>
                <Th T={T} right>Driver Bonus %</Th>
              </tr>
            </thead>
            <tbody>
              {truckClasses.map((tc) => (
                <tr key={tc.id} style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                  <td className="px-3 py-2" style={{ color: T.textPrimary }}>{tc.name}</td>
                  <td className="px-2 py-1.5"><Input className="text-right" type="number" min="0" step="0.01" placeholder="120" value={draft[tc.id]?.base_delivery_fee ?? ""} onChange={(e) => update(tc.id, "base_delivery_fee", e.target.value)} /></td>
                  <td className="px-2 py-1.5"><Input className="text-right" type="number" min="0" step="0.01" value={draft[tc.id]?.per_mile_rate ?? ""} onChange={(e) => update(tc.id, "per_mile_rate", e.target.value)} /></td>
                  <td className="px-2 py-1.5"><Input className="text-right" type="number" min="0" max="100" step="0.1" value={draft[tc.id]?.driver_extra_mile_bonus_pct ?? ""} onChange={(e) => update(tc.id, "driver_extra_mile_bonus_pct", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTACH PITS MODAL
// ═══════════════════════════════════════════════════════════════════════════
function AttachPitsModal({ open, onClose, hubId, T, storedPassword, onAttached }: {
  open: boolean; onClose: () => void; hubId: string; T: any; storedPassword: () => string; onAttached: (n: number) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pits, setPits] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("leads-auth", {
          body: { password: storedPassword(), action: "hub_list_unattached_pits", hub_id: hubId },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setPits((data as any).pits || []);
      } catch (err: any) {
        toast({ title: "Load failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hubId]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAttach() {
    if (selected.size === 0) {
      toast({ title: "Select at least one pit" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password: storedPassword(), action: "hub_attach_pit", hub_id: hubId, pit_ids: Array.from(selected) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      onAttached((data as any).attached || selected.size);
    } catch (err: any) {
      toast({ title: "Attach failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Attach Pits</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_GOLD }} /></div>
        ) : pits.length === 0 ? (
          <p className="text-sm" style={{ color: T.textSecond }}>All pits are already attached to this hub.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1">
            {pits.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer hover:bg-muted">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: T.textPrimary }}>{p.name}</span>
                    <StatusPill status={p.status} />
                  </div>
                  {p.address && <div className="text-[11px] truncate" style={{ color: T.textSecond }}>{p.address}</div>}
                </div>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleAttach} disabled={saving || selected.size === 0} style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Attach ${selected.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
