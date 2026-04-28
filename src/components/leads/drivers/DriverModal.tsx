// Slice C — Driver identity modal.
// Scoped to identity + hub + status + license + notes + PIN.
// Compensation and goals are managed inline in DriverDetail.
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, stripPhone } from "@/lib/format";
import { formatEmail, formatProperName, formatProperNameFinal } from "@/lib/textFormat";
import EmailInput from "@/components/EmailInput";
import { DRIVER_STATUSES, type Driver, type DriverStatus, type HubOption } from "./types";

const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const ERROR_RED = "#DC2626";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-11 rounded-lg";

interface Props {
  open: boolean;
  onClose: () => void;
  driver: Driver | null; // null = Add mode
  password: string;
  onSaved: () => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  truck_number: string;
  license_expires_on: string;
  notes: string;
  status: DriverStatus;
  primary_hub_id: string; // "" → null
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  truck_number: "",
  license_expires_on: "",
  notes: "",
  status: "active",
  primary_hub_id: "",
};

const NO_HUB = "__none__";

function driverToForm(d: Driver): FormState {
  return {
    name: d.name || "",
    phone: d.phone ? formatPhone(d.phone) : "",
    email: d.email || "",
    truck_number: d.truck_number || "",
    license_expires_on: d.license_expires_on || "",
    notes: d.notes || "",
    status: (d.status as DriverStatus) || (d.active ? "active" : "inactive"),
    primary_hub_id: d.primary_hub_id || "",
  };
}

export default function DriverModal({ open, onClose, driver, password, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = !!driver;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [original, setOriginal] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formAttempted, setFormAttempted] = useState(false);
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  // Load hub options when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "hub_list_for_select" },
      });
      if (!cancelled) setHubs((data as any)?.hubs || []);
    })();
    return () => { cancelled = true; };
  }, [open, password]);

  useEffect(() => {
    if (open) {
      const next = driver ? driverToForm(driver) : EMPTY;
      setForm(next);
      setOriginal(next);
      setPhoneError(null);
      setNameError(null);
      setFormAttempted(false);
      setPin("");
      setPinConfirm("");
      setPinError(null);
    }
  }, [open, driver]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "phone") setPhoneError(null);
    if (k === "name") setNameError(null);
  };

  async function invokeUpsert(payload: Record<string, unknown>) {
    return await supabase.functions.invoke("leads-auth", {
      body: { password, action: "upsert_driver", driver: payload },
    });
  }

  async function handleSave() {
    setFormAttempted(true);
    setPhoneError(null);
    setNameError(null);

    const trimmedName = form.name.trim();
    const phoneDigits = stripPhone(form.phone);

    let hasError = false;
    if (!isEdit) {
      if (!trimmedName) { setNameError("Name is required"); hasError = true; }
      if (phoneDigits.length < 10) { setPhoneError("Phone must have at least 10 digits"); hasError = true; }
    } else {
      if (form.name !== original.name && !trimmedName) { setNameError("Name cannot be empty"); hasError = true; }
      if (form.phone !== original.phone && phoneDigits.length < 10) { setPhoneError("Phone must have at least 10 digits"); hasError = true; }
    }
    if (hasError) return;

    setSaving(true);
    try {
      let payload: Record<string, unknown>;

      if (!isEdit) {
        payload = {
          name: trimmedName,
          phone: phoneDigits,
          email: form.email.trim() || null,
          truck_number: form.truck_number.trim() || null,
          license_expires_on: form.license_expires_on || null,
          notes: form.notes.trim() || null,
          status: form.status,
          primary_hub_id: form.primary_hub_id || null,
        };
      } else {
        payload = { id: driver!.id };
        if (form.name !== original.name) payload.name = trimmedName;
        if (form.phone !== original.phone) payload.phone = phoneDigits;
        if (form.email !== original.email) payload.email = form.email.trim() || null;
        if (form.truck_number !== original.truck_number) payload.truck_number = form.truck_number.trim() || null;
        if (form.license_expires_on !== original.license_expires_on) payload.license_expires_on = form.license_expires_on || null;
        if (form.notes !== original.notes) payload.notes = form.notes.trim() || null;
        if (form.status !== original.status) payload.status = form.status;
        if (form.primary_hub_id !== original.primary_hub_id) payload.primary_hub_id = form.primary_hub_id || null;

        if (Object.keys(payload).length === 1) {
          toast({ title: "No changes to save" });
          setSaving(false);
          return;
        }
      }

      const { data, error } = await invokeUpsert(payload);
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        const msg = (errBody?.error as string) || (error?.message as string) || "Save failed";
        const status = (error as any)?.context?.status;
        if (status === 409 || /already exists/i.test(msg)) {
          setPhoneError("A driver with this phone number already exists");
        } else {
          toast({ title: "Save failed", description: msg, variant: "destructive" });
        }
        setSaving(false);
        return;
      }

      toast({ title: isEdit ? "Driver saved" : "Driver added" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPin() {
    setPinError(null);
    if (!/^\d{4,6}$/.test(pin)) { setPinError("PIN must be 4–6 digits"); return; }
    if (pin !== pinConfirm) { setPinError("PINs do not match"); return; }
    setPinSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "set_driver_pin", driver_id: driver!.id, new_pin: pin },
      });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        toast({
          title: "PIN update failed",
          description: errBody?.error || error?.message || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "PIN updated. Driver's existing sessions have been revoked." });
      setPin("");
      setPinConfirm("");
      onSaved();
    } finally {
      setPinSaving(false);
    }
  }

  const showNameError = formAttempted && !!nameError;
  const showPhoneError = formAttempted && !!phoneError;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide" style={{ color: BRAND_NAVY }}>
            {isEdit ? "Edit Driver" : "Add Driver"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="drv-name" className={LABEL_CLS}>Name *</Label>
            <Input
              id="drv-name"
              autoComplete="name"
              maxLength={100}
              value={form.name}
              onChange={(e) => update("name", formatProperName(e.target.value))}
              onBlur={(e) => update("name", formatProperNameFinal(e.target.value))}
              placeholder="John Smith"
              className={`${INPUT_CLS} ${showNameError ? "border-2" : ""}`}
              style={showNameError ? { borderColor: ERROR_RED } : undefined}
            />
            {showNameError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-3 h-3" /> {nameError}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="drv-phone" className={LABEL_CLS}>Phone *</Label>
            <Input
              id="drv-phone"
              type="tel"
              autoComplete="tel"
              maxLength={14}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update("phone", formatPhone(e.target.value))}
              placeholder="(504) 555-1234"
              className={`${INPUT_CLS} ${showPhoneError ? "border-2" : ""}`}
              style={showPhoneError ? { borderColor: ERROR_RED } : undefined}
            />
            {showPhoneError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-3 h-3" /> {phoneError}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="drv-email" className={LABEL_CLS}>Email</Label>
            <EmailInput
              id="drv-email"
              value={form.email}
              onChange={(v) => update("email", formatEmail(v))}
              placeholder="driver@example.com"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="drv-truck" className={LABEL_CLS}>Truck Number</Label>
              <Input
                id="drv-truck"
                value={form.truck_number}
                onChange={(e) => update("truck_number", e.target.value)}
                placeholder="T-101"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <Label htmlFor="drv-license" className={LABEL_CLS}>License Expires</Label>
              <Input
                id="drv-license"
                type="date"
                value={form.license_expires_on}
                onChange={(e) => update("license_expires_on", e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="drv-hub" className={LABEL_CLS}>Primary Hub</Label>
              <Select
                value={form.primary_hub_id || NO_HUB}
                onValueChange={(v) => update("primary_hub_id", v === NO_HUB ? "" : v)}
              >
                <SelectTrigger id="drv-hub" className={INPUT_CLS}>
                  <SelectValue placeholder="No hub" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_HUB}>No hub</SelectItem>
                  {hubs.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="drv-status" className={LABEL_CLS}>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as DriverStatus)}>
                <SelectTrigger id="drv-status" className={INPUT_CLS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRIVER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="drv-notes" className={LABEL_CLS}>Notes</Label>
            <Textarea
              id="drv-notes"
              rows={2}
              maxLength={1000}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Internal notes about this driver"
            />
          </div>

          {/* PIN section — Edit mode only. Setting PIN revokes active sessions. */}
          {isEdit && (
            <div className="pt-3 border-t" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4" style={{ color: BRAND_GOLD }} />
                <span className="font-display uppercase tracking-wide text-sm" style={{ color: BRAND_NAVY }}>
                  Driver PIN
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Setting a new PIN will sign the driver out of all active sessions.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="drv-pin" className={LABEL_CLS}>New PIN</Label>
                  <Input
                    id="drv-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="new-password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinError(null); }}
                    placeholder="4–6 digits"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <Label htmlFor="drv-pin-confirm" className={LABEL_CLS}>Confirm PIN</Label>
                  <Input
                    id="drv-pin-confirm"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="new-password"
                    maxLength={6}
                    value={pinConfirm}
                    onChange={(e) => { setPinConfirm(e.target.value.replace(/\D/g, "")); setPinError(null); }}
                    placeholder="Repeat"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              {pinError && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                  <AlertCircle className="w-3 h-3" /> {pinError}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSetPin}
                disabled={pinSaving || !pin || !pinConfirm}
                className="mt-2"
                style={{ backgroundColor: BRAND_NAVY, color: "white" }}
              >
                {pinSaving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {driver?.pin_set ? "Reset PIN" : "Set PIN"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: BRAND_GOLD, color: "white" }}
          >
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? "Save Changes" : "Save Driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
