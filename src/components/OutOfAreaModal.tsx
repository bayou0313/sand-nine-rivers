import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Mail, User, MapPin, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

interface OutOfAreaModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  distanceMiles: number;
  nearestPit?: { id: string; name: string; distance: number } | null;
  calculatedPrice?: number | null;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const OutOfAreaModal = ({ open, onClose, address, distanceMiles, nearestPit, calculatedPrice }: OutOfAreaModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [browserGeo, setBrowserGeo] = useState<{ lat: number; lng: number } | null>(null);

  // Business settings
  const [businessSettings, setBusinessSettings] = useState({
    response_time_hours: "2",
    business_days: "Monday-Saturday",
    business_hours_start: "07:00",
    business_hours_end: "17:00",
  });

  // Fetch business hours settings and IP on mount
  useEffect(() => {
    if (!open) return;

    // Fetch business settings
    supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["response_time_hours", "business_days", "business_hours_start", "business_hours_end"])
      .then(({ data }) => {
        if (data) {
          const updates: Record<string, string> = {};
          data.forEach((s) => { updates[s.key] = s.value; });
          setBusinessSettings((prev) => ({ ...prev, ...updates }));
        }
      });

    // Fetch IP (best-effort)
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setIpAddress(d.ip || null))
      .catch(() => {});

    // Request geolocation silently (non-blocking)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setBrowserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silently ignore denial
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && phone.replace(/\D/g, "").length === 10;

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          action: "create_out_of_area_lead",
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
          address,
          distance_miles: parseFloat(distanceMiles.toFixed(1)),
          notes: notes.trim() || null,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          browser_geolat: browserGeo?.lat ?? null,
          browser_geolng: browserGeo?.lng ?? null,
          calculated_price: calculatedPrice ?? null,
          nearest_pit_id: nearestPit?.id ?? null,
          nearest_pit_name: nearestPit?.name ?? null,
          nearest_pit_distance: nearestPit ? parseFloat(nearestPit.distance.toFixed(1)) : null,
        },
      });

      if (error) throw error;

      trackEvent("generate_lead", {
        address,
        nearest_pit: nearestPit?.name || "unknown",
        distance_miles: distanceMiles,
      });

      toast.success(
        `Thank you — we've received your request. Expect to hear from us within ${businessSettings.response_time_hours} hours during business hours.`,
        { duration: 6000 }
      );
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle
            className="text-lg font-semibold"
            style={{ color: "#0D2137", letterSpacing: "0.02em", textTransform: "none" }}
          >
            Let Our Team Take a Look
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            We may be able to help — fill out the quick form below and our manager will review your request within{" "}
            <strong>{businessSettings.response_time_hours} hours</strong> during{" "}
            {businessSettings.business_days}{" "}
            {formatTime(businessSettings.business_hours_start)}–{formatTime(businessSettings.business_hours_end)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="lead-name" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lead-name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="lead-phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lead-phone"
              type="tel"
              placeholder="(xxx) xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={14}
            />
          </div>
          <div>
            <Label htmlFor="lead-email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email <span className="text-red-500">*</span>
            </Label>
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
            <Label htmlFor="lead-address" className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Delivery Address
            </Label>
            <Input
              id="lead-address"
              value={address}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <Label htmlFor="lead-notes" className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Delivery Notes <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="lead-notes"
              placeholder="Gate code, special instructions, project details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full font-semibold text-white rounded-lg"
            style={{ backgroundColor: "#C07A00", borderRadius: 8 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit Request
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            We'll review and get back to you — no spam, no obligation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutOfAreaModal;
