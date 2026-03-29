import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OutOfAreaModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  distanceMiles: number;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const OutOfAreaModal = ({ open, onClose, address, distanceMiles }: OutOfAreaModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && (email.trim().length > 0 || phone.replace(/\D/g, "").length === 10);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("delivery_leads").insert({
        address,
        distance_miles: parseFloat(distanceMiles.toFixed(1)),
        customer_name: name.trim(),
        customer_email: email.trim() || null,
        customer_phone: phone.trim() || null,
      });

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
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-5 h-5 text-primary" />
            We're Not There Yet
          </DialogTitle>
          <DialogDescription>
            That address is outside our current delivery area. Leave your info and we'll reach out when we expand to your area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="lead-name">Name *</Label>
            <Input
              id="lead-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              type="tel"
              placeholder="(xxx) xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={14}
            />
          </div>
          <p className="text-xs text-muted-foreground">* At least one of email or phone is required.</p>

          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Notify Me
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutOfAreaModal;
