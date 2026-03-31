import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

interface OutOfAreaModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  distanceMiles: number;
  nearestPit?: { id: string; name: string; distance: number } | null;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const OutOfAreaModal = ({ open, onClose, address, distanceMiles, nearestPit }: OutOfAreaModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && (email.trim().length > 0 || phone.replace(/\D/g, "").length === 10);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const insertData: any = {
        address,
        distance_miles: parseFloat(distanceMiles.toFixed(1)),
        customer_name: name.trim(),
        customer_email: email.trim() || null,
        customer_phone: phone.trim() || null,
      };

      if (nearestPit) {
        insertData.nearest_pit_id = nearestPit.id;
        insertData.nearest_pit_name = nearestPit.name;
        insertData.nearest_pit_distance = parseFloat(nearestPit.distance.toFixed(1));
      }

      const { error } = await supabase.from("delivery_leads").insert(insertData as any);
      if (error) throw error;

      // Send email notification (fire-and-forget)
      supabase.functions.invoke("send-email", {
        body: {
          type: "out_of_area_lead",
          data: {
            address,
            distance_miles: distanceMiles.toFixed(1),
            customer_name: name.trim(),
            customer_email: email.trim() || "Not provided",
            customer_phone: phone.trim() || "Not provided",
            created_at: new Date().toISOString(),
          },
        },
      }).catch((err) => console.error("[lead-email] Error:", err));

      trackEvent("generate_lead", {
        address,
        nearest_pit: nearestPit?.name || "unknown",
        distance_miles: distanceMiles,
      });
      toast.success("Thanks! We'll contact you when we expand to your area.");
      setName("");
      setEmail("");
      setPhone("");
      onClose();
    } catch (err: any) {
      console.error("[lead-submit]", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-lg font-semibold"
            style={{ color: "#0D2137", letterSpacing: "0.02em", textTransform: "none" }}
          >
            We're Not in Your Area Yet — But We're Expanding
          </DialogTitle>
          <DialogDescription>
            Leave your info and you'll be first to know when we reach your area. No spam, just one email when we go live near you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="lead-name">Name *</Label>
            <Input id="lead-name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div>
            <Label htmlFor="lead-phone">Phone</Label>
            <Input id="lead-phone" type="tel" placeholder="(xxx) xxx-xxxx" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} maxLength={14} />
          </div>
          <p className="text-xs text-muted-foreground">* At least one of email or phone is required.</p>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full font-semibold text-white rounded-lg"
            style={{ backgroundColor: "#C07A00", borderRadius: 8 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Notify Me
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutOfAreaModal;
