import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Mail, User, MapPin, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { WAYS_PHONE_DISPLAY, WAYS_PHONE_TEL } from "@/lib/constants";
import { formatPhone } from "@/lib/format";
import { formatProperName, formatProperNameFinal, formatEmail, formatSentence } from "@/lib/textFormat";
import EmailInput from "@/components/EmailInput";

const LOGO_WHITE =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";

interface OutOfAreaModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  distanceMiles: number;
  nearestPit?: { id: string; name: string; distance: number } | null;
  calculatedPrice?: number | null;
}


/* ── Animated checkmark ── */
const AnimatedCheckmark = () => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
  >
    <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
      <motion.circle
        cx="40" cy="40" r="36" stroke="#16A34A" strokeWidth="3" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      />
      <motion.path
        d="M24 42 L35 53 L56 28" stroke="#16A34A" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.7, ease: "easeOut" }}
      />
    </svg>
  </motion.div>
);

const OutOfAreaModal = ({ open, onClose, address, distanceMiles, nearestPit, calculatedPrice }: OutOfAreaModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [browserGeo, setBrowserGeo] = useState<{ lat: number; lng: number } | null>(null);

  const [businessSettings, setBusinessSettings] = useState({
    response_time_hours: "2",
    business_days: "Monday-Saturday",
    business_hours_start: "07:00",
    business_hours_end: "17:00",
  });

  useEffect(() => {
    if (!open) return;
    // Reset submitted state when modal reopens
    setSubmitted(false);

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

    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setIpAddress(d.ip || null))
      .catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setBrowserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
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
      const { error } = await supabase.functions.invoke("leads-auth", {
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

      setSubmitted(true);
    } catch (err: any) {
      console.error("[lead-submit]", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitted) {
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setSubmitted(false);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0">
        {submitted ? (
          /* ── BRANDED CONFIRMATION STATE ── */
          <div className="font-body">
            {/* Navy header */}
            <div className="flex flex-col items-center py-6" style={{ backgroundColor: "#0D2137" }}>
              <img src={LOGO_WHITE} alt="River Sand" title="River Sand Delivery — RiverSand.net" className="w-[160px] object-contain" />
              <div className="mt-3" style={{ width: 40, height: 2, backgroundColor: "#C07A00" }} />
            </div>

            {/* White body */}
            <div className="bg-white py-8 px-6 flex flex-col items-center text-center">
              <AnimatedCheckmark />

              <h2
                className="mt-4 font-display text-[22px] font-bold tracking-wider"
                style={{ color: "#0D2137" }}
              >
                Request Received!
              </h2>

              <p className="mt-3 text-sm max-w-sm" style={{ color: "#6B7280" }}>
                Thank you, <span className="font-semibold" style={{ color: "#374151" }}>{name}</span>. 
                Our team will review your request and get back to you within{" "}
                <strong>{businessSettings.response_time_hours} hours</strong> during business hours.
              </p>

              <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>
                {businessSettings.business_days} · {formatTime(businessSettings.business_hours_start)}–{formatTime(businessSettings.business_hours_end)}
              </p>

              {/* Address summary */}
              <div
                className="mt-5 w-full rounded-lg p-4 text-left"
                style={{ backgroundColor: "#F9FAFB" }}
              >
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "#0D2137" }}>
                  DELIVERY ADDRESS
                </p>
                <p className="text-sm" style={{ color: "#374151" }}>{address}</p>
              </div>

              <div className="mt-6 space-y-2 text-center">
                <p className="text-sm" style={{ color: "#6B7280" }}>Questions?</p>
                <a
                  href={WAYS_PHONE_TEL}
                  className="font-display text-base tracking-wider block"
                  style={{ color: "#C07A00" }}
                >
                  {WAYS_PHONE_DISPLAY}
                </a>
              </div>

              <Button
                onClick={handleClose}
                className="mt-6 w-full font-display tracking-wider"
                style={{ backgroundColor: "#0D2137" }}
              >
                Done
              </Button>
            </div>

            {/* Mini footer */}
            <div className="py-4 text-center" style={{ backgroundColor: "#F3F4F6" }}>
              <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                © 2026 Ways Materials LLC · riversand.net
              </p>
            </div>
          </div>
        ) : (
          /* ── FORM STATE ── */
          <div className="p-6">
            <div className="mb-4">
              <h2
                className="text-lg font-semibold"
                style={{ color: "#0D2137", letterSpacing: "0.02em" }}
              >
                Let Our Team Take a Look
              </h2>
              <p className="text-sm leading-relaxed mt-1" style={{ color: "#6B7280" }}>
                We may be able to help — fill out the quick form below and our manager will review your request within{" "}
                <strong>{businessSettings.response_time_hours} hours</strong> during{" "}
                {businessSettings.business_days}{" "}
                {formatTime(businessSettings.business_hours_start)}–{formatTime(businessSettings.business_hours_end)}.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="lead-name" className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lead-name"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(formatProperName(e.target.value))}
                  onBlur={(e) => setName(formatProperNameFinal(e.target.value))}
                  maxLength={100}
                  autoComplete="name"
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OutOfAreaModal;
