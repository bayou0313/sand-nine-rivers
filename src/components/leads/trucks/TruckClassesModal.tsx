// Slice D Part 1 — Truck Classes management modal.
// Edit name + description only. Capacity fields are read-only (operational data
// — changes affect rate matrices on every hub). Soft-delete via status.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, X, Save, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TruckClass } from "./types";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

interface Props { open: boolean; onClose: () => void; password: string }

export default function TruckClassesModal({ open, onClose, password }: Props) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<TruckClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "list_truck_classes" },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setClasses(((data as any).classes || []) as TruckClass[]);
    } catch (e: any) {
      toast({ title: "Failed to load classes", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  function startEdit(c: TruckClass) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description || "");
  }
  function cancelEdit() { setEditingId(null); setEditName(""); setEditDesc(""); }

  async function saveEdit(c: TruckClass) {
    if (!editName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          password, action: "truck_class_update",
          class_id: c.id, name: editName.trim(), description: editDesc.trim() || null,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Class updated" });
      cancelEdit();
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function archiveClass(c: TruckClass) {
    if (c.active_truck_count && c.active_truck_count > 0) {
      const ok = window.confirm(
        `${c.active_truck_count} active truck(s) reference "${c.name}". Archiving may break rate matrices. Continue?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { password, action: "truck_class_update", class_id: c.id, status: "inactive" },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Class archived" });
      await load();
    } catch (e: any) {
      toast({ title: "Archive failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide" style={{ color: BRAND_NAVY }}>
            Truck Classes
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm" style={{ color: MUTED }}>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : classes.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: MUTED }}>No classes defined.</div>
        ) : (
          <div className="space-y-2">
            {classes.map(c => {
              const isEditing = editingId === c.id;
              const active = c.status === "active";
              return (
                <div key={c.id} className="rounded-lg border p-3" style={{ borderColor: BORDER }}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder="Class name" className="h-9" />
                      <Textarea rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description (optional)" maxLength={500} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(c)} disabled={saving}
                          style={{ backgroundColor: BRAND_GOLD, color: "white" }}>
                          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display uppercase tracking-wide text-base" style={{ color: BRAND_NAVY }}>
                            {c.name}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: active ? "#10B98115" : "#6B728015",
                              color: active ? "#10B981" : MUTED,
                              border: `1px solid ${active ? "#10B98155" : "#6B728055"}`,
                            }}>
                            {c.status}
                          </span>
                          <span className="text-xs" style={{ color: MUTED }}>
                            {c.active_truck_count ?? 0} truck{(c.active_truck_count ?? 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        {c.description && (
                          <div className="text-xs mt-1" style={{ color: MUTED }}>{c.description}</div>
                        )}
                        <div className="text-[11px] mt-1" style={{ color: MUTED }}>
                          {c.max_yards != null && <span>Max yards: <span className="font-semibold">{c.max_yards}</span></span>}
                          {c.max_yards != null && c.max_tons != null && <span className="mx-2">·</span>}
                          {c.max_tons != null && <span>Max tons: <span className="font-semibold">{c.max_tons}</span></span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)} disabled={saving}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        {active && (
                          <Button size="sm" variant="outline" onClick={() => archiveClass(c)} disabled={saving}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] mt-3 italic" style={{ color: MUTED }}>
          Capacity fields (max yards / max tons) are operational data and cannot be changed here.
          Contact the admin to alter capacity definitions.
        </div>
      </DialogContent>
    </Dialog>
  );
}
