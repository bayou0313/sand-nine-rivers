import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2, User, Phone, Mail, FileText, CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google: any;
  }
}

const ORIGIN = "1215 River Rd, Bridge City, LA 70094";
const BASE_PRICE = 195;
const BASE_MILES = 15;
const MAX_MILES = 25;
const PER_MILE_EXTRA = 3.49;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBDjm1VJ85yJ7KX-cSRX3RCXVir4DOyQ-I";

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
  duration: string;
};

const Order = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"address" | "details" | "confirm" | "success">("address");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState("");
  const [apiLoaded, setApiLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Pre-fill from estimator URL params
  useEffect(() => {
    const paramAddress = searchParams.get("address");
    const paramDistance = searchParams.get("distance");
    const paramPrice = searchParams.get("price");
    const paramDuration = searchParams.get("duration");

    if (paramAddress && paramDistance && paramPrice && paramDuration) {
      setAddress(paramAddress);
      setResult({
        distance: parseFloat(paramDistance),
        price: parseFloat(paramPrice),
        address: `${paramDistance} miles away`,
        duration: paramDuration,
      });
      setStep("details");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    if (window.google?.maps?.places) {
      setApiLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setApiLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!apiLoaded || !inputRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      types: ["address"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) setAddress(place.formatted_address);
    });
  }, [apiLoaded]);

  const calculateDistance = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    setLoading(true);
    setError("");
    setResult(null);

    if (!apiLoaded) {
      setError("Google Maps API is not loaded. Please check API key configuration.");
      setLoading(false);
      return;
    }

    try {
      const service = new window.google.maps.DistanceMatrixService();
      const response = await service.getDistanceMatrix({
        origins: [ORIGIN],
        destinations: [address],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      });

      const element = response.rows[0]?.elements[0];
      if (!element || element.status !== "OK") {
        setError("Could not calculate distance. Please check the address.");
        setLoading(false);
        return;
      }

      const distanceMiles = element.distance.value / 1609.34;
      if (distanceMiles > MAX_MILES) {
        setError(`That address is ${distanceMiles.toFixed(1)} miles away. We deliver within ${MAX_MILES} miles. Please call us for options.`);
        setLoading(false);
        return;
      }

      let price = BASE_PRICE;
      if (distanceMiles > BASE_MILES) price += (distanceMiles - BASE_MILES) * PER_MILE_EXTRA;

      setResult({
        distance: parseFloat(distanceMiles.toFixed(1)),
        price: parseFloat(price.toFixed(2)),
        address: element.distance.text + " away",
        duration: element.duration.text,
      });
      setStep("details");
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setLoading(false);
    }
  }, [address, apiLoaded]);

  const handleSubmitOrder = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Please enter your name and phone number.", variant: "destructive" });
      return;
    }
    if (!result) return;

    setSubmitting(true);
    try {
      const { error: insertError } = await (supabase as any).from("orders").insert({
        customer_name: form.name.trim(),
        customer_email: form.email.trim() || null,
        customer_phone: form.phone.trim(),
        delivery_address: address,
        distance_miles: result.distance,
        price: result.price,
        payment_method: "COD",
        notes: form.notes.trim() || null,
      });

      if (insertError) throw insertError;
      setStep("success");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message || "Please try again or call us.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-dark">
      {/* Header */}
      <div className="bg-foreground/95 border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-3xl font-display text-background tracking-wider">RIVERSAND</Link>
          <Link to="/" className="font-body text-sm text-background/60 hover:text-background transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress steps */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {["Address", "Your Info", "Confirm"].map((label, i) => {
              const stepIndex = ["address", "details", "confirm"].indexOf(step === "success" ? "confirm" : step);
              const isActive = i <= stepIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-sm ${isActive ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <span className={`font-body text-sm hidden sm:inline ${isActive ? "text-primary-foreground" : "text-primary-foreground/40"}`}>{label}</span>
                  {i < 2 && <div className={`w-8 h-px ${isActive ? "bg-accent" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {step === "address" && (
              <motion.div key="address" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-background rounded-lg p-8 border border-border shadow-lg">
                <h1 className="text-4xl md:text-5xl font-display text-foreground mb-2">PLACE YOUR ORDER</h1>
                <p className="font-body text-muted-foreground mb-8">Enter your delivery address to get your instant price. 9 cubic yards of quality river sand.</p>

                <div className="space-y-4">
                  <label className="font-display text-lg text-foreground tracking-wider flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" /> DELIVERY ADDRESS
                  </label>
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter your delivery address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-14 text-base"
                    maxLength={500}
                    onKeyDown={(e) => e.key === "Enter" && calculateDistance()}
                  />
                  {!GOOGLE_MAPS_API_KEY && (
                    <p className="text-sm text-muted-foreground font-body flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-accent" />
                      Google Maps API key not configured.
                    </p>
                  )}
                  {error && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                      <p className="font-body text-sm text-destructive">{error}</p>
                    </div>
                  )}
                  <Button onClick={calculateDistance} disabled={loading} className="w-full h-14 font-display tracking-wider text-lg">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" /> GET DELIVERY PRICE</>}
                  </Button>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <p className="font-display text-xl text-primary">0–15 MI</p>
                    <p className="font-body text-xs text-muted-foreground">$195 flat</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <p className="font-display text-xl text-primary">15–25 MI</p>
                    <p className="font-body text-xs text-muted-foreground">+$3.49/mi</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <p className="font-display text-xl text-primary">9 YDS</p>
                    <p className="font-body text-xs text-muted-foreground">Per load</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "details" && result && (
              <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                {/* Price summary */}
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-display text-xl tracking-wider">DELIVERY AVAILABLE!</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-background rounded-md">
                      <p className="font-body text-xs text-muted-foreground uppercase">Distance</p>
                      <p className="font-display text-2xl text-foreground">{result.distance} MI</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-md">
                      <p className="font-body text-xs text-muted-foreground uppercase">Drive Time</p>
                      <p className="font-display text-2xl text-foreground">{result.duration}</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-md">
                      <p className="font-body text-xs text-muted-foreground uppercase">Total</p>
                      <p className="font-display text-2xl text-primary flex items-center justify-center">
                        <DollarSign className="w-5 h-5" />{result.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer form */}
                <div className="bg-background rounded-lg p-8 border border-border shadow-lg">
                  <h2 className="text-3xl font-display text-foreground mb-2">YOUR INFORMATION</h2>
                  <p className="font-body text-muted-foreground mb-6">Tell us where to reach you. Payment is Cash on Delivery (COD).</p>

                  <div className="space-y-4">
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-primary" /> FULL NAME *
                      </label>
                      <Input placeholder="John Smith" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12" />
                    </div>
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <Phone className="w-4 h-4 text-primary" /> PHONE NUMBER *
                      </label>
                      <Input type="tel" placeholder="(504) 555-0123" required maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12" />
                    </div>
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-primary" /> EMAIL (optional)
                      </label>
                      <Input type="email" placeholder="john@example.com" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12" />
                    </div>
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-primary" /> DELIVERY NOTES (optional)
                      </label>
                      <Textarea placeholder="Gate code, placement instructions, preferred time..." maxLength={1000} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                      <CreditCard className="w-6 h-6 text-accent shrink-0" />
                      <div>
                        <p className="font-display text-sm text-foreground tracking-wider">CASH ON DELIVERY (COD)</p>
                        <p className="font-body text-xs text-muted-foreground">Payment is collected upon delivery. Cash or check accepted.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep("address")} className="h-12 font-display tracking-wider">BACK</Button>
                      <Button onClick={() => setStep("confirm")} className="flex-1 h-12 font-display tracking-wider text-lg" disabled={!form.name.trim() || !form.phone.trim()}>
                        REVIEW ORDER
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "confirm" && result && (
              <motion.div key="confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-background rounded-lg p-8 border border-border shadow-lg">
                <h2 className="text-3xl font-display text-foreground mb-6">CONFIRM YOUR ORDER</h2>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Product</span>
                    <span className="font-display text-foreground">9 CUBIC YARDS RIVER SAND</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Delivery To</span>
                    <span className="font-body text-foreground text-right max-w-[60%]">{address}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Distance</span>
                    <span className="font-display text-foreground">{result.distance} MILES</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Customer</span>
                    <span className="font-body text-foreground">{form.name}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Phone</span>
                    <span className="font-body text-foreground">{form.phone}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Payment</span>
                    <span className="font-display text-foreground">CASH ON DELIVERY</span>
                  </div>
                  <div className="flex justify-between py-3 bg-primary/5 rounded-lg px-4">
                    <span className="font-display text-lg text-foreground">TOTAL</span>
                    <span className="font-display text-2xl text-primary">${result.price.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("details")} className="h-12 font-display tracking-wider">BACK</Button>
                  <Button onClick={handleSubmitOrder} disabled={submitting} className="flex-1 h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "PLACE ORDER — COD"}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-background rounded-lg p-12 border border-border shadow-lg text-center space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-4xl font-display text-foreground">ORDER PLACED!</h2>
                <p className="font-body text-muted-foreground max-w-md mx-auto">
                  Your order has been received. We'll call you at <strong className="text-foreground">{form.phone}</strong> to confirm delivery details and timing.
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  Payment of <strong className="text-primary">${result?.price.toFixed(2)}</strong> is due upon delivery (Cash on Delivery).
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button asChild className="font-display tracking-wider">
                    <Link to="/">BACK TO HOME</Link>
                  </Button>
                  <Button variant="outline" asChild className="font-display tracking-wider">
                    <a href="tel:+15551234567"><Phone className="w-4 h-4 mr-2" /> CALL US</a>
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Order;
