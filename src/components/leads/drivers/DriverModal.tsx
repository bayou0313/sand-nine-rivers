// Path B Phase 1 — Drivers tab UI. Reads/writes drivers table via leads-auth list_drivers/upsert_driver (Phase 0 foundation).
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserX, UserPlus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, stripPhone } from "@/lib/format";
import { formatEmail, formatProperName, formatProperNameFinal } from "@/lib/textFormat";
import EmailInput from "@/components/EmailInput";
import { PAYMENT_TYPES, type Driver, type PaymentType } from "./types";

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
  phone: string; // formatted for display
  email: string;
  truck_number: string;
  payment_type: PaymentType;
  payment_rate: string;
  license_expires_on: string;
  notes: string;
  active: boolean;
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  truck_number: "",
  payment_type: "per_load",
  payment_rate: "0",
  license_expires_on: "",
  notes: "",
  active: true,
};

function driverToForm(d: Driver): FormState {
  return {
    name: d.name || "",
    phone: d.phone ? formatPhone(d.phone) : "",
    email: d.email || "",
    truck_number: d.truck_number || "",
    payment_type: (PAYMENT_TYPES.find(p => p.value === d.payment_type)?.value || "per_load") as PaymentType,
    payment_rate: String(d.payment_rate ?? 0),
    license_expires_on: d.license_expires_on || "",
    notes: d.notes || "",
    active: !!d.active,
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
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (open) {
      const next = driver ? driverToForm(driver) : EMPTY;
      setForm(next);
      setOriginal(next);
      setPhoneError(null);
      setNameError(null);
      setFormAttempted(false);
      setConfirmDeactivate(false);
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
      if (!trimmedName) {
        setNameError("Name is required");
        hasError = true;
      }
      if (phoneDigits.length < 10) {
        setPhoneError("Phone must have at least 10 digits");
        hasError = true;
      }
    } else {
      if (form.name !== original.name && !trimmedName) {
        setNameError("Name cannot be empty");
        hasError = true;
      }
      if (form.phone !== original.phone && phoneDigits.length < 10) {
        setPhoneError("Phone must have at least 10 digits");
        hasError = true;
      }
    }
    if (hasError) return;

    setSaving(true);
    try {
      let payload: Record<string, unknown>;

      if (!isEdit) {
        // INSERT — send all fields
        payload = {
          name: trimmedName,
          phone: phoneDigits,
          email: form.email.trim() || null,
          truck_number: form.truck_number.trim() || null,
          payment_type: form.payment_type,
          payment_rate: Number(form.payment_rate) || 0,
          license_expires_on: form.license_expires_on || null,
          notes: form.notes.trim() || null,
          active: form.active,
        };
      } else {
        // UPDATE — diff only changed fields, partial update per Phase 0 validator
        payload = { id: driver!.id };
        if (form.name !== original.name) payload.name = trimmedName;
        if (form.phone !== original.phone) payload.phone = phoneDigits;
        if (form.email !== original.email) payload.email = form.email.trim() || null;
        if (form.truck_number !== original.truck_number) payload.truck_number = form.truck_number.trim() || null;
        if (form.payment_type !== original.payment_type) payload.payment_type = form.payment_type;
        if (form.payment_rate !== original.payment_rate) payload.payment_rate = Number(form.payment_rate) || 0;
        if (form.license_expires_on !== original.license_expires_on) payload.license_expires_on = form.license_expires_on || null;
        if (form.notes !== original.notes) payload.notes = form.notes.trim() || null;
        if (form.active !== original.active) payload.active = form.active;

        if (Object.keys(payload).length === 1) {
          toast({ title: "No changes to save" });
          setSaving(false);
          return;
        }
      }

      const { data, error } = await invokeUpsert(payload);

      // Edge function returns 409 with { error } body for duplicate phone
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

  async function handleDeactivateToggle() {
    if (!driver) return;
    const target = !driver.active;
    if (target === false && !confirmDeactivate) {
      setConfirmDeactivate(true);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await invokeUpsert({ id: driver.id, active: target });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        toast({
          title: target ? "Reactivate failed" : "Deactivate failed",
          description: errBody?.error || error?.message || "Unknown error",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      toast({ title: target ? "Driver reactivated" : "Driver deactivated" });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
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
                <AlertCircle className="w-3 h-3" />
                {nameError}
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
                <AlertCircle className="w-3 h-3" />
                {phoneError}
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
              <Label htmlFor="drv-paytype" className={LABEL_CLS}>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={(v) => update("payment_type", v as PaymentType)}>
                <SelectTrigger id="drv-paytype" className={INPUT_CLS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="drv-payrate" className={LABEL_CLS}>Payment Rate ($)</Label>
              <Input
                id="drv-payrate"
                type="number"
                step="0.01"
                min="0"
                value={form.payment_rate}
                onChange={(e) => update("payment_rate", e.target.value)}
                className={INPUT_CLS}
              />
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

          {isEdit && (
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#E5E7EB" }}>
              <Label htmlFor="drv-active" className={`${LABEL_CLS} cursor-pointer mb-0`}>Active</Label>
              <Switch id="drv-active" checked={form.active} onCheckedChange={(v) => update("active", v)} />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={handleDeactivateToggle}
              className="border-2"
              style={
                driver!.active
                  ? { borderColor: "#DC2626", color: "#DC2626" }
                  : { borderColor: "#16A34A", color: "#16A34A" }
              }
            >
              {driver!.active ? <UserX className="w-3 h-3 mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
              {driver!.active
                ? (confirmDeactivate ? "Click again to confirm" : "Deactivate Driver")
                : "Reactivate Driver"}
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
