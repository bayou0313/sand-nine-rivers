// Slice C — Inline form for adding a new goal row.
// Goals are configuration (targets), not transactional records — hard-delete is
// allowed on the server via diff. Adding here is a single-row insert via parent.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GOAL_TYPES, type GoalType, type Goal } from "./types";

const BRAND_GOLD = "#C07A00";
const BRAND_NAVY = "#0D2137";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-10 rounded-lg";

interface Props {
  // Adds the goal locally (parent batches via save_driver_goals on its own commit).
  onAdd: (g: Omit<Goal, "id" | "driver_id" | "created_at">) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function InlineGoalForm({ onAdd, onCancel, saving = false }: Props) {
  const [goalType, setGoalType] = useState<GoalType>("loads_per_week");
  const today = new Date().toISOString().slice(0, 10);
  const monthEnd = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  })();
  const [target, setTarget] = useState("");
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(monthEnd);

  const unit = GOAL_TYPES.find(g => g.value === goalType)?.unit || "";
  const valid = Number(target) > 0 && periodStart && periodEnd && periodStart <= periodEnd;

  function handleAdd() {
    if (!valid) return;
    onAdd({
      goal_type: goalType,
      target_value: Number(target),
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: BRAND_GOLD }}>
      <div className="font-display uppercase tracking-wide text-sm mb-3" style={{ color: BRAND_NAVY }}>
        New Goal
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className={LABEL_CLS}>Metric</Label>
          <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
            <SelectTrigger className={INPUT_CLS}><SelectValue /></SelectTrigger>
            <SelectContent>
              {GOAL_TYPES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={LABEL_CLS}>Target ({unit})</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Period Start</Label>
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Period End</Label>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!valid || saving}
          style={{ backgroundColor: BRAND_GOLD, color: "white" }}
        >
          {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          Add Goal
        </Button>
      </div>
    </div>
  );
}
