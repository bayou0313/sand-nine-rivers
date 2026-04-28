// Slice D Part 1 — Inline form for assigning a driver to a truck.
// Versioning is handled server-side: truck_assignment_save closes any open
// (effective_to IS NULL) row by setting effective_to = now(), then inserts
// the new open row.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { DriverOption } from "./types";

const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-10 rounded-lg";

interface Props {
  truckId: string;
  hubId: string | null;
  password: string;
  onSaved: () => void;
  onCancel: () => void;
}

const UNASSIGN = "__unassign__";

export default function InlineAssignmentForm({ truckId, hubId, password, onSaved, onCancel }: Props) {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverId, setDriverId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDrivers(true);
      const { data } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "driver_list_for_truck_assignment", hub_id: hubId },
      });
      if (cancelled) return;
      setDrivers(((data as any)?.drivers || []) as DriverOption[]);
      setLoadingDrivers(false);
    })();
    return () => { cancelled = true; };
  }, [password, hubId]);

  async function handleSave() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      toast({ title: "Effective From must be a date", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          password,
          action: "truck_assignment_save",
          truck_id: truckId,
          driver_id: driverId === UNASSIGN || !driverId ? null : driverId,
          effective_from: effectiveFrom,
          notes: notes.trim() || null,
        },
      });
      const errBody: any = (data as any)?.error ? data : null;
      if (error || errBody) {
        toast({
          title: "Save failed",
          description: errBody?.error || error?.message || "Unknown",
          variant: "destructive",
        });
        return;
      }
      const warning = (data as any)?.warning as string | undefined;
      if (warning) {
        toast({ title: "Assignment saved", description: warning });
      } else {
        toast({ title: "Assignment saved" });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BRAND_GOLD }}>
      <div className="font-display uppercase tracking-wide text-sm mb-3" style={{ color: BRAND_NAVY }}>
        New Assignment
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className={LABEL_CLS}>Driver</Label>
          <Select value={driverId || UNASSIGN} onValueChange={setDriverId} disabled={loadingDrivers}>
            <SelectTrigger className={INPUT_CLS}>
              <SelectValue placeholder={loadingDrivers ? "Loading…" : "Select a driver"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGN}>(Unassign — no driver)</SelectItem>
              {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!loadingDrivers && drivers.length === 0 && (
            <div className="text-xs mt-1 italic text-muted-foreground">
              No active drivers at this hub. Save anyway to clear assignment.
            </div>
          )}
        </div>
        <div>
          <Label className={LABEL_CLS}>Effective From</Label>
          <Input
            type="date" value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>
      <div className="mt-3">
        <Label className={LABEL_CLS}>Notes (optional)</Label>
        <Textarea rows={2} maxLength={500} value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for the change…" />
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}
          style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
          {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Save Assignment
        </Button>
      </div>
    </div>
  );
}
