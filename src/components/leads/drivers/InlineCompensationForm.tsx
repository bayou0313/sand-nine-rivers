// Slice C — Inline form for adding a new compensation row.
// Versioning is handled server-side: save_driver_compensation closes any open
// (effective_to IS NULL) row by setting effective_to = effective_from - 1 day,
// then inserts the new open row.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { COMP_TYPES, type CompType } from "./types";

const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-10 rounded-lg";

interface Props {
  driverId: string;
  password: string;
  onSaved: () => void;
  onCancel: () => void;
}

export default function InlineCompensationForm({ driverId, password, onSaved, onCancel }: Props) {
  const { toast } = useToast();
  const [compType, setCompType] = useState<CompType>("per_load");
  const [rate, setRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const r = Number(rate);
    if (!Number.isFinite(r) || r < 0) {
      toast({ title: "Rate must be a non-negative number", variant: "destructive" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      toast({ title: "Effective From must be a date", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          password,
          action: "save_driver_compensation",
          driver_id: driverId,
          compensation: {
            comp_type: compType,
            rate: r,
            effective_from: effectiveFrom,
            notes: notes.trim() || null,
          },
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
      toast({ title: "Compensation updated" });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const unit = COMP_TYPES.find(c => c.value === compType)?.unit || "";

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BRAND_GOLD }}>
      <div className="font-display uppercase tracking-wide text-sm mb-3" style={{ color: BRAND_NAVY }}>
        New Compensation
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className={LABEL_CLS}>Type</Label>
          <Select value={compType} onValueChange={(v) => setCompType(v as CompType)}>
            <SelectTrigger className={INPUT_CLS}><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMP_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={LABEL_CLS}>Rate ({unit})</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.00"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Effective From</Label>
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>
      <div className="mt-3">
        <Label className={LABEL_CLS}>Notes (optional)</Label>
        <Textarea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for the change…"
        />
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving || !rate}
          style={{ backgroundColor: BRAND_GOLD, color: "white" }}
        >
          {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Save Compensation
        </Button>
      </div>
    </div>
  );
}
