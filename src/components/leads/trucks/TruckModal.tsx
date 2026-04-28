// Slice D Part 1 — Truck identity modal (create + edit).
// No address fields → no PlaceAutocompleteInput → no Dialog/autocomplete bug.
// Hub + Class are required. DOT and Registration are separate fields.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TRUCK_STATUSES, type HubOption, type Truck, type TruckClassOption, type TruckStatus } from "./types";

const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const ERROR_RED = "#DC2626";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-11 rounded-lg";

interface Props {
  open: boolean;
  onClose: () => void;
  truck: Truck | null; // null = Add mode
  password: string;
  onSaved: () => void;
}

interface FormState {
  name: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  license_plate: string;
  hub_id: string;
  class_id: string;
  status: TruckStatus;
  insurance_expiry: string;
  registration_expiry: string;
  dot_expiry: string;
  surecam_device_id: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "", make: "", model: "", year: "", vin: "", license_plate: "",
  hub_id: "", class_id: "", status: "active",
  insurance_expiry: "", registration_expiry: "", dot_expiry: "",
  surecam_device_id: "", notes: "",
};

function truckToForm(t: Truck): FormState {
  return {
    name: t.name || "",
    make: t.make || "",
    model: t.model || "",
    year: t.year != null ? String(t.year) : "",
    vin: t.vin || "",
    license_plate: t.license_plate || "",
    hub_id: t.hub_id || "",
    class_id: t.class_id || "",
    status: ((t.status as TruckStatus) || "active"),
    insurance_expiry: t.insurance_expiry || "",
    registration_expiry: t.registration_expiry || "",
    dot_expiry: t.dot_expiry || "",
    surecam_device_id: t.surecam_device_id || "",
    notes: t.notes || "",
  };
}

const CURRENT_YEAR = new Date().getFullYear();

export default function TruckModal({ open, onClose, truck, password, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = !!truck;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [original, setOriginal] = useState<FormState>(EMPTY);
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [classes, setClasses] = useState<TruckClassOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load hub + class options when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [hubRes, clsRes] = await Promise.all([
        supabase.functions.invoke("leads-auth", { body: { password, action: "hub_list_for_select" } }),
        supabase.functions.invoke("leads-auth", { body: { password, action: "truck_classes_list_for_select" } }),
      ]);
      if (cancelled) return;
      setHubs(((hubRes.data as any)?.hubs || []) as HubOption[]);
      setClasses(((clsRes.data as any)?.classes || []) as TruckClassOption[]);
    })();
    return () => { cancelled = true; };
  }, [open, password]);

  useEffect(() => {
    if (open) {
      const next = truck ? truckToForm(truck) : EMPTY;
      setForm(next);
      setOriginal(next);
      setFormAttempted(false);
      setErrors({});
    }
  }, [open, truck]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Truck number is required";
    if (!form.hub_id) e.hub_id = "Hub is required";
    if (!form.class_id) e.class_id = "Class is required";
    if (form.vin.trim() && form.vin.trim().length !== 17) e.vin = "VIN must be exactly 17 characters";
    if (form.year.trim()) {
      const y = Number(form.year);
      if (!Number.isInteger(y) || y < 1990 || y > CURRENT_YEAR + 1) {
        e.year = `Year must be between 1990 and ${CURRENT_YEAR + 1}`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    setFormAttempted(true);
    if (!validate()) return;

    setSaving(true);
    try {
      let payload: Record<string, unknown>;
      if (!isEdit) {
        payload = {
          name: form.name.trim(),
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: form.year.trim() ? Number(form.year) : null,
          vin: form.vin.trim() || null,
          license_plate: form.license_plate.trim() || null,
          hub_id: form.hub_id,
          class_id: form.class_id,
          status: form.status,
          insurance_expiry: form.insurance_expiry || null,
          registration_expiry: form.registration_expiry || null,
          dot_expiry: form.dot_expiry || null,
          surecam_device_id: form.surecam_device_id.trim() || null,
          notes: form.notes.trim() || null,
        };
      } else {
        payload = { id: truck!.id };
        const diff = <K extends keyof FormState>(k: K, mapper: (v: FormState[K]) => unknown) => {
          if (form[k] !== original[k]) (payload as any)[k] = mapper(form[k]);
        };
        diff("name", v => (v as string).trim());
        diff("make", v => ((v as string).trim() || null));
        diff("model", v => ((v as string).trim() || null));
        diff("year", v => ((v as string).trim() ? Number(v) : null));
        diff("vin", v => ((v as string).trim() || null));
        diff("license_plate", v => ((v as string).trim() || null));
        diff("hub_id", v => v);
        diff("class_id", v => v);
        diff("status", v => v);
        diff("insurance_expiry", v => (v || null));
        diff("registration_expiry", v => (v || null));
        diff("dot_expiry", v => (v || null));
        diff("surecam_device_id", v => ((v as string).trim() || null));
        diff("notes", v => ((v as string).trim() || null));
        if (Object.keys(payload).length === 1) {
          toast({ title: "No changes to save" });
          setSaving(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "truck_upsert", truck: payload },
      });
      const errBody: any = (data as any)?.error ? data : null;
      if (error || errBody) {
        const msg = (errBody?.error as string) || (error?.message as string) || "Save failed";
        if (/already exists|duplicate|unique/i.test(msg)) {
          setErrors(prev => ({ ...prev, name: "A truck with this number already exists" }));
        } else if (errBody?.warning) {
          // soft warning surfaced as toast but save succeeded
          toast({ title: "Saved with warning", description: msg });
        } else {
          toast({ title: "Save failed", description: msg, variant: "destructive" });
        }
        setSaving(false);
        return;
      }

      toast({ title: isEdit ? "Truck saved" : "Truck added" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const showErr = (k: string) => formAttempted && !!errors[k];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide" style={{ color: BRAND_NAVY }}>
            {isEdit ? "Edit Truck" : "Add Truck"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trk-name" className={LABEL_CLS}>Truck Number *</Label>
              <Input
                id="trk-name" maxLength={50} value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="T-101"
                className={`${INPUT_CLS} ${showErr("name") ? "border-2" : ""}`}
                style={showErr("name") ? { borderColor: ERROR_RED } : undefined}
              />
              {showErr("name") && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                  <AlertCircle className="w-3 h-3" /> {errors.name}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="trk-status" className={LABEL_CLS}>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as TruckStatus)}>
                <SelectTrigger id="trk-status" className={INPUT_CLS}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRUCK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="trk-make" className={LABEL_CLS}>Make</Label>
              <Input id="trk-make" value={form.make} onChange={(e) => update("make", e.target.value)}
                placeholder="Peterbilt" className={INPUT_CLS} />
            </div>
            <div>
              <Label htmlFor="trk-model" className={LABEL_CLS}>Model</Label>
              <Input id="trk-model" value={form.model} onChange={(e) => update("model", e.target.value)}
                placeholder="567" className={INPUT_CLS} />
            </div>
            <div>
              <Label htmlFor="trk-year" className={LABEL_CLS}>Year</Label>
              <Input
                id="trk-year" type="number" min="1990" max={CURRENT_YEAR + 1}
                value={form.year} onChange={(e) => update("year", e.target.value)}
                placeholder="2022"
                className={`${INPUT_CLS} ${showErr("year") ? "border-2" : ""}`}
                style={showErr("year") ? { borderColor: ERROR_RED } : undefined}
              />
              {showErr("year") && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                  <AlertCircle className="w-3 h-3" /> {errors.year}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trk-vin" className={LABEL_CLS}>VIN</Label>
              <Input
                id="trk-vin" maxLength={17} value={form.vin}
                onChange={(e) => update("vin", e.target.value.toUpperCase())}
                placeholder="17 characters"
                className={`${INPUT_CLS} font-mono ${showErr("vin") ? "border-2" : ""}`}
                style={showErr("vin") ? { borderColor: ERROR_RED } : undefined}
              />
              {showErr("vin") && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                  <AlertCircle className="w-3 h-3" /> {errors.vin}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="trk-plate" className={LABEL_CLS}>License Plate</Label>
              <Input id="trk-plate" value={form.license_plate}
                onChange={(e) => update("license_plate", e.target.value.toUpperCase())}
                className={`${INPUT_CLS} font-mono`} />
            </div>
          </div>

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trk-hub" className={LABEL_CLS}>Hub *</Label>
              <Select value={form.hub_id} onValueChange={(v) => update("hub_id", v)}>
                <SelectTrigger
                  id="trk-hub"
                  className={`${INPUT_CLS} ${showErr("hub_id") ? "border-2" : ""}`}
                  style={showErr("hub_id") ? { borderColor: ERROR_RED } : undefined}
                >
                  <SelectValue placeholder="Select a hub" />
                </SelectTrigger>
                <SelectContent>
                  {hubs.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {showErr("hub_id") && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                  <AlertCircle className="w-3 h-3" /> {errors.hub_id}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="trk-class" className={LABEL_CLS}>Class *</Label>
              <Select value={form.class_id} onValueChange={(v) => update("class_id", v)}>
                <SelectTrigger
                  id="trk-class"
                  className={`${INPUT_CLS} ${showErr("class_id") ? "border-2" : ""}`}
                  style={showErr("class_id") ? { borderColor: ERROR_RED } : undefined}
                >
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {showErr("class_id") && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                  <AlertCircle className="w-3 h-3" /> {errors.class_id}
                </div>
              )}
            </div>
          </div>

          {/* Compliance dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="trk-ins" className={LABEL_CLS}>Insurance Expiry</Label>
              <Input id="trk-ins" type="date" value={form.insurance_expiry}
                onChange={(e) => update("insurance_expiry", e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <Label htmlFor="trk-reg" className={LABEL_CLS}>Registration Expiry</Label>
              <Input id="trk-reg" type="date" value={form.registration_expiry}
                onChange={(e) => update("registration_expiry", e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <Label htmlFor="trk-dot" className={LABEL_CLS}>DOT Inspection Expiry</Label>
              <Input id="trk-dot" type="date" value={form.dot_expiry}
                onChange={(e) => update("dot_expiry", e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <Label htmlFor="trk-surecam" className={LABEL_CLS}>SureCam Device ID</Label>
            <Input id="trk-surecam" value={form.surecam_device_id}
              onChange={(e) => update("surecam_device_id", e.target.value.trim())}
              placeholder="Optional — for telemetry matching"
              className={`${INPUT_CLS} font-mono`} />
          </div>

          <div>
            <Label htmlFor="trk-notes" className={LABEL_CLS}>Notes</Label>
            <Textarea id="trk-notes" rows={2} maxLength={1000}
              value={form.notes} onChange={(e) => update("notes", e.target.value)}
              placeholder="Internal notes about this truck" />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving}
            style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? "Save Changes" : "Save Truck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
