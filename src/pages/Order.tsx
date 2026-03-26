import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2, User, Phone, Mail, FileText, CreditCard, ArrowLeft, Lock, Banknote, CalendarDays, Clock, ExternalLink, Minus, Plus } from "lucide-react";
import { formatPhone, formatCurrency, getTaxRateFromAddress } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DeliveryDatePicker, { type DeliveryDate, SATURDAY_SURCHARGE } from "@/components/DeliveryDatePicker";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google: any;
  }
}

const ORIGIN = "1215 River Rd, Bridge City, LA 70094";
const BASE_PRICE = 195;
const BASE_MILES = 15;
const MAX_MILES = 30;
const PER_MILE_EXTRA = 3.49;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBDjm1VJ85yJ7KX-cSRX3RCXVir4DOyQ-I";

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
  duration: string;
};

type PaymentMethodType = "stripe-link" | "cash" | "check" | null;

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

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(null);
  const [codSubOption, setCodSubOption] = useState<"cash" | "check">("cash");
  const [stripePaymentId, setStripePaymentId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<DeliveryDate | null>(null);
  const [dateError, setDateError] = useState("");

  // Quantity from URL params (default 1)
  const qtyParam = parseInt(searchParams.get("qty") || "1", 10);
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(10, isNaN(qtyParam) ? 1 : qtyParam)));

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Tax calculation based on delivery address
  const taxInfo = useMemo(() => getTaxRateFromAddress(address), [address]);

  // Computed total with Saturday surcharge — $35 per load, plus tax
  const saturdaySurchargeTotal = selectedDeliveryDate?.isSaturday ? SATURDAY_SURCHARGE * quantity : 0;
  const subtotal = result ? (result.price * quantity) + saturdaySurchargeTotal : 0;
  const taxAmount = parseFloat((subtotal * taxInfo.rate).toFixed(2));
  const totalPrice = parseFloat((subtotal + taxAmount).toFixed(2));

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
        setError("That address is outside our delivery area. Please call us for options.");
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

  const goToStep2 = () => {
    if (!selectedDeliveryDate) {
      setDateError("Please select a delivery date to continue.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Please enter your name and phone number.", variant: "destructive" });
      return;
    }
    setDateError("");
    setStep("confirm");
  };

  const buildOrderData = () => ({
    customer_name: form.name.trim(),
    customer_email: form.email.trim() || null,
    customer_phone: form.phone.trim(),
    delivery_address: address,
    distance_miles: result!.distance,
    price: totalPrice,
    quantity,
    notes: form.notes.trim() || null,
    delivery_date: selectedDeliveryDate!.iso,
    delivery_day_of_week: selectedDeliveryDate!.dayOfWeek,
    saturday_surcharge: selectedDeliveryDate!.isSaturday,
    saturday_surcharge_amount: selectedDeliveryDate!.isSaturday ? SATURDAY_SURCHARGE * quantity : 0,
    delivery_window: "8:00 AM – 5:00 PM",
    same_day_requested: selectedDeliveryDate!.isSameDay,
    tax_rate: taxInfo.rate,
    tax_amount: taxAmount,
  });

  const handleCodSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Please enter your name and phone number.", variant: "destructive" });
      return;
    }
    if (!result || !selectedDeliveryDate) return;

    setSubmitting(true);
    try {
      const { data: insertedOrder, error: insertError } = await (supabase as any).from("orders").insert({
        ...buildOrderData(),
        payment_method: codSubOption,
        payment_status: "pending",
      }).select("order_number").single();

      if (insertError) throw insertError;
      setOrderNumber(insertedOrder?.order_number || null);
      setStep("success");
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message || "Please try again or call us.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStripeLink = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Please enter your name and phone number.", variant: "destructive" });
      return;
    }
    if (!result || !selectedDeliveryDate) return;

    setSubmitting(true);
    try {
      // First save the order as pending
      const orderData = {
        ...buildOrderData(),
        payment_method: "stripe-link",
        payment_status: "pending",
      };
      const { data: insertedOrder, error: insertError } = await (supabase as any)
        .from("orders")
        .insert(orderData)
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Generate Stripe checkout link
      const description = `River Sand Delivery — ${quantity} load${quantity > 1 ? "s" : ""} × 9 cu yds`;
      const { data, error } = await supabase.functions.invoke("create-checkout-link", {
        body: {
          amount: Math.round(totalPrice * 100),
          description,
          customer_name: form.name.trim(),
          customer_email: form.email.trim() || null,
          order_id: insertedOrder?.id,
          origin_url: window.location.origin,
        },
      });

      if (error || !data?.url) {
        throw new Error(data?.error || error?.message || "Failed to create payment link");
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Payment link failed", description: err.message || "Please try another payment method.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ["Delivery Details", "Payment", "Confirm"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-dark to-foreground">
      {/* Header */}
      <div className="bg-foreground/95 backdrop-blur-sm border-b border-border/20">
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
            {stepLabels.map((label, i) => {
              const stepIndex = ["address", "details", "confirm"].indexOf(step === "success" ? "confirm" : step);
              const isActive = i <= stepIndex;
              const isCurrent = i === stepIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-sm transition-all duration-300 ${
                    isCurrent ? "bg-accent text-accent-foreground scale-110 shadow-lg shadow-accent/30" 
                    : isActive ? "bg-accent/60 text-accent-foreground" 
                    : "bg-muted/30 text-muted-foreground/50"
                  }`}>
                    {isActive && i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`font-body text-sm hidden sm:inline transition-colors ${
                    isCurrent ? "text-background font-medium" : isActive ? "text-background/70" : "text-background/30"
                  }`}>{label}</span>
                  {i < 2 && <div className={`w-10 h-px transition-colors ${isActive ? "bg-accent/60" : "bg-muted/20"}`} />}
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1: Address */}
            {step === "address" && (
              <motion.div key="address" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-background rounded-2xl p-8 border border-border shadow-2xl shadow-foreground/10">
                <h1 className="text-4xl md:text-5xl font-display text-foreground mb-2">PLACE YOUR ORDER</h1>
                <p className="font-body text-muted-foreground mb-8">Enter your delivery address to get your instant price. {quantity > 1 ? `${quantity} loads × ` : ""}9 cubic yards of quality river sand.</p>

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
                    className="h-14 text-base rounded-xl"
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
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                      <p className="font-body text-sm text-destructive">{error}</p>
                    </div>
                  )}
                  <Button onClick={calculateDistance} disabled={loading} className="w-full h-14 font-display tracking-wider text-lg rounded-xl">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" /> GET DELIVERY PRICE</>}
                  </Button>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                  {[
                    { top: "LOCAL AREA", bot: "Starting at $195" },
                    { top: "EXTENDED AREA", bot: "Surcharge applies" },
                    { top: "9 YDS", bot: "Per load" },
                  ].map((item) => (
                    <div key={item.top} className="p-3 bg-card border border-border rounded-xl">
                      <p className="font-display text-xl text-primary">{item.top}</p>
                      <p className="font-body text-xs text-muted-foreground">{item.bot}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Delivery Details + Payment */}
            {step === "details" && result && (
              <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                {/* Price summary */}
                <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-display text-xl tracking-wider">DELIVERY AVAILABLE!</span>
                  </div>
                  <div className="text-center p-4 bg-background rounded-xl">
                    <p className="font-body text-xs text-muted-foreground uppercase">{quantity > 1 ? `Subtotal (${quantity} loads)` : "Per Load"}</p>
                    <p className="font-display text-3xl text-primary flex items-center justify-center">
                      {formatCurrency(result.price * quantity)}
                    </p>
                  </div>
                </div>

                {/* Delivery Date Picker */}
                <div className="bg-background rounded-2xl p-8 border border-border shadow-2xl shadow-foreground/5">
                  <DeliveryDatePicker
                    selectedDate={selectedDeliveryDate}
                    onSelect={(d) => {
                      setSelectedDeliveryDate(d);
                      setDateError("");
                    }}
                  />
                  {dateError && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                      <p className="font-body text-sm text-destructive">{dateError}</p>
                    </div>
                  )}
                </div>

                {/* Customer form */}
                <div className="bg-background rounded-2xl p-8 border border-border shadow-2xl shadow-foreground/5">
                  <h2 className="text-3xl font-display text-foreground mb-2">YOUR INFORMATION</h2>
                  <p className="font-body text-muted-foreground mb-6">Tell us where to reach you.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-primary" /> FULL NAME *
                      </label>
                      <Input placeholder="John Smith" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
                    </div>
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <Phone className="w-4 h-4 text-primary" /> PHONE NUMBER *
                      </label>
                      <Input type="tel" placeholder="(504) 555-0123" required maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="h-12 rounded-xl" />
                    </div>
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-primary" /> EMAIL (optional)
                      </label>
                      <Input type="email" placeholder="john@example.com" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl" />
                    </div>
                    <div>
                      <label className="font-display text-sm text-foreground tracking-wider flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-primary" /> DELIVERY NOTES (optional)
                      </label>
                      <Textarea placeholder="Gate code, placement instructions, preferred time..." maxLength={1000} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl" />
                    </div>
                  </div>
                </div>

                {/* Full Cost Breakdown */}
                {selectedDeliveryDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background rounded-2xl p-8 border border-border shadow-2xl shadow-foreground/5"
                  >
                    <h2 className="text-3xl font-display text-foreground mb-4">ORDER SUMMARY</h2>

                    {/* Quantity selector */}
                    <div className="flex items-center justify-between py-3 border-b border-border">
                      <span className="font-body text-muted-foreground">Number of Loads</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-display text-xl text-foreground w-8 text-center">{quantity}</span>
                        <button onClick={() => setQuantity(q => Math.min(10, q + 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0">
                      {/* Product line */}
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="font-body text-muted-foreground">River Sand (9 cubic yards × {quantity})</span>
                        <span className="font-display text-foreground">{quantity} load{quantity > 1 ? "s" : ""}</span>
                      </div>

                      {/* Base price per load */}
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="font-body text-muted-foreground">Base delivery × {quantity}</span>
                        <span className="font-display text-foreground">{formatCurrency(195 * quantity)}</span>
                      </div>

                      {/* Extra mileage */}
                      {result.distance > BASE_MILES && (
                        <div className="flex justify-between py-3 border-b border-border">
                          <span className="font-body text-muted-foreground">
                            Extended delivery surcharge × {quantity} load{quantity > 1 ? "s" : ""}
                          </span>
                          <span className="font-display text-foreground">
                            +{formatCurrency((result.distance - BASE_MILES) * PER_MILE_EXTRA * quantity)}
                          </span>
                        </div>
                      )}

                      {/* Delivery date */}
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="font-body text-muted-foreground">Delivery Date</span>
                        <span className="font-body text-foreground">
                          {selectedDeliveryDate.fullLabel}
                        </span>
                      </div>

                      {/* Delivery window */}
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="font-body text-muted-foreground">Delivery Window</span>
                        <span className="font-body text-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 8:00 AM – 5:00 PM
                        </span>
                      </div>

                      {selectedDeliveryDate.isSameDay && (
                        <p className="font-body text-xs text-destructive bg-destructive/5 p-2 rounded-lg my-2">
                          ⚡ Same-day request — our team will call to confirm availability before dispatching.
                        </p>
                      )}

                      {/* Saturday surcharge */}
                      {selectedDeliveryDate.isSaturday && (
                         <div className="flex justify-between py-3 border-b border-border">
                          <span className="font-body text-destructive">Saturday Surcharge ($35 × {quantity} load{quantity > 1 ? "s" : ""})</span>
                          <span className="font-display text-destructive">+{formatCurrency(saturdaySurchargeTotal)}</span>
                        </div>
                      )}

                      {/* Subtotal breakdown */}
                      <div className="mt-4 bg-primary/5 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="font-body text-sm text-muted-foreground">Subtotal ({quantity} load{quantity > 1 ? "s" : ""} × {formatCurrency(result.price)}/load)</span>
                          <span className="font-display text-foreground">{formatCurrency(result.price * quantity)}</span>
                        </div>
                        {selectedDeliveryDate.isSaturday && (
                          <div className="flex justify-between">
                            <span className="font-body text-sm text-muted-foreground">Saturday surcharge ($35 × {quantity})</span>
                            <span className="font-display text-foreground">+{formatCurrency(saturdaySurchargeTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="font-body text-sm text-muted-foreground">Sales Tax ({(taxInfo.rate * 100).toFixed(2)}% — {taxInfo.parish})</span>
                          <span className="font-display text-foreground">+{formatCurrency(taxAmount)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-border">
                          <span className="font-display text-xl text-foreground">TOTAL DUE</span>
                          <span className="font-display text-3xl text-primary">{formatCurrency(totalPrice)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Payment method selection */}
                <div className="bg-background rounded-2xl p-8 border border-border shadow-2xl shadow-foreground/5">
                  <h2 className="text-3xl font-display text-foreground mb-2">PAYMENT METHOD</h2>
                  <p className="font-body text-muted-foreground mb-6">Choose how you'd like to pay.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("stripe-link")}
                      className={`p-5 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "stripe-link"
                          ? "border-accent bg-accent/5 shadow-lg shadow-accent/10"
                          : "border-border bg-card hover:border-accent/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === "stripe-link" ? "bg-accent/20" : "bg-muted"}`}>
                          <CreditCard className={`w-5 h-5 ${paymentMethod === "stripe-link" ? "text-accent" : "text-muted-foreground"}`} />
                        </div>
                        <p className="font-display text-sm text-foreground tracking-wider">PAY NOW</p>
                      </div>
                      <p className="font-body text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Secure Stripe Checkout
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`p-5 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === "cash" || paymentMethod === "check"
                          ? "border-accent bg-accent/5 shadow-lg shadow-accent/10"
                          : "border-border bg-card hover:border-accent/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === "cash" || paymentMethod === "check" ? "bg-accent/20" : "bg-muted"}`}>
                          <Banknote className={`w-5 h-5 ${paymentMethod === "cash" || paymentMethod === "check" ? "text-accent" : "text-muted-foreground"}`} />
                        </div>
                        <p className="font-display text-sm text-foreground tracking-wider">PAY AT DELIVERY</p>
                      </div>
                      <p className="font-body text-xs text-muted-foreground">Cash or Check accepted</p>
                    </button>
                  </div>

                  {paymentMethod === "stripe-link" && (
                    <div className="space-y-4">
                      <p className="font-body text-sm text-muted-foreground">
                        We'll create your order and generate a secure Stripe payment link. You'll be redirected to Stripe to complete payment.
                      </p>
                      <Button
                        onClick={handleStripeLink}
                        disabled={submitting || !form.name.trim() || !form.phone.trim()}
                        className="w-full h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 rounded-xl"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ExternalLink className="w-5 h-5 mr-2" /> PAY {formatCurrency(totalPrice)} VIA STRIPE</>}
                      </Button>
                    </div>
                  )}

                  {(paymentMethod === "cash" || paymentMethod === "check") && (
                    <div className="space-y-4">
                      <RadioGroup
                        value={codSubOption}
                        onValueChange={(v) => {
                          setCodSubOption(v as "cash" | "check");
                          setPaymentMethod(v as "cash" | "check");
                        }}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cash" id="cash" />
                          <label htmlFor="cash" className="font-body text-foreground cursor-pointer">Cash</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="check" id="check" />
                          <label htmlFor="check" className="font-body text-foreground cursor-pointer">Check</label>
                        </div>
                      </RadioGroup>

                      <Button
                        onClick={goToStep2}
                        disabled={!form.name.trim() || !form.phone.trim()}
                        className="w-full h-14 font-display tracking-wider text-lg rounded-xl"
                      >
                        REVIEW ORDER
                      </Button>
                    </div>
                  )}

                  {!paymentMethod && (
                    <p className="font-body text-sm text-muted-foreground text-center">Select a payment method to continue.</p>
                  )}
                </div>

                <Button variant="outline" onClick={() => setStep("address")} className="h-12 font-display tracking-wider rounded-xl border-accent/50 text-accent hover:text-accent hover:bg-accent/10">
                  <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO ADDRESS
                </Button>
              </motion.div>
            )}

            {/* STEP 3: Confirm */}
            {step === "confirm" && result && selectedDeliveryDate && (
              <motion.div key="confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-background rounded-2xl p-8 border border-border shadow-2xl shadow-foreground/10">
                <h2 className="text-3xl font-display text-foreground mb-6">CONFIRM YOUR ORDER</h2>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Product</span>
                    <span className="font-display text-foreground">{quantity} × 9 CU YDS RIVER SAND</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Delivery To</span>
                    <span className="font-body text-foreground text-right max-w-[60%]">{address}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Delivery Date</span>
                    <span className="font-body text-foreground">
                      {selectedDeliveryDate.fullLabel}
                      {selectedDeliveryDate.isSaturday && <span className="text-amber-600 text-sm ml-1">(+$35)</span>}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Delivery Window</span>
                    <span className="font-body text-foreground">8:00 AM – 5:00 PM</span>
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
                    <span className="font-display text-foreground">
                      {codSubOption === "cash" ? "CASH" : "CHECK"} AT DELIVERY
                    </span>
                  </div>
                  {selectedDeliveryDate.isSameDay && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="font-body text-sm text-amber-800">
                        ⚡ This is a same-day delivery request. Our team will contact you to confirm availability before dispatching.
                      </p>
                    </div>
                  )}
                  {selectedDeliveryDate.isSaturday && (
                    <div className="flex justify-between py-3 border-b border-border">
                      <span className="font-body text-destructive">Saturday Surcharge ($35 × {quantity})</span>
                      <span className="font-display text-destructive">+{formatCurrency(saturdaySurchargeTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-b border-border">
                    <span className="font-body text-muted-foreground">Sales Tax ({(taxInfo.rate * 100).toFixed(2)}%)</span>
                    <span className="font-display text-foreground">+{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-primary/5 rounded-xl px-4">
                    <span className="font-display text-lg text-foreground">TOTAL</span>
                    <span className="font-display text-2xl text-primary">{formatCurrency(totalPrice)}</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                  <p className="text-amber-800 text-sm font-body">
                    <strong>⚠️ Curbside Delivery Only:</strong> All deliveries are made curbside. Due to liability, we cannot deliver inside backyards or enclosed areas.
                  </p>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setStep("details")} className="h-12 font-display tracking-wider rounded-xl">BACK</Button>
                  <Button onClick={handleCodSubmit} disabled={submitting} className="flex-1 h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 rounded-xl">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `PLACE ORDER — ${codSubOption.toUpperCase()} AT DELIVERY`}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* SUCCESS */}
            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-background rounded-2xl p-12 border border-border shadow-2xl shadow-foreground/10 text-center space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-4xl font-display text-foreground">ORDER PLACED!</h2>

                {stripePaymentId ? (
                  <>
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <CheckCircle2 className="w-5 h-5" />
                      <p className="font-display text-lg tracking-wider">PAYMENT CONFIRMED</p>
                    </div>
                    <p className="font-body text-muted-foreground max-w-md mx-auto">
                      Your card payment of <strong className="text-primary">{formatCurrency(totalPrice)}</strong> has been processed.
                      We'll call you at <strong className="text-foreground">{form.phone}</strong> to confirm delivery.
                    </p>
                  </>
                ) : (
                  <p className="font-body text-muted-foreground max-w-md mx-auto">
                    Your order is confirmed. Payment of <strong className="text-primary">{formatCurrency(totalPrice)}</strong> due at delivery by <strong className="text-foreground">{codSubOption}</strong>.
                    We'll call you at <strong className="text-foreground">{form.phone}</strong> to confirm delivery.
                  </p>
                )}

                {selectedDeliveryDate && (
                  <div className="bg-card border border-border rounded-xl p-4 max-w-sm mx-auto space-y-1">
                    <p className="font-display text-sm text-muted-foreground tracking-wider">SCHEDULED DELIVERY</p>
                    <p className="font-display text-xl text-foreground">{selectedDeliveryDate.fullLabel}</p>
                    <p className="font-body text-sm text-muted-foreground">8:00 AM – 5:00 PM</p>
                    {selectedDeliveryDate.isSameDay && (
                      <p className="font-body text-xs text-amber-700">Same-day — we'll confirm availability</p>
                    )}
                    {selectedDeliveryDate.isSaturday && (
                      <p className="font-body text-xs text-amber-700">Saturday surcharge of $35 included</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button asChild className="font-display tracking-wider rounded-xl">
                    <Link to="/">BACK TO HOME</Link>
                  </Button>
                  <Button variant="outline" asChild className="font-display tracking-wider rounded-xl">
                    <a href="tel:+18554689297"><Phone className="w-4 h-4 mr-2" /> CALL US</a>
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
