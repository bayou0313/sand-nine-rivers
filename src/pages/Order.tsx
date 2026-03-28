import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2, User, Phone, Mail, FileText, CreditCard, ArrowLeft, Lock, Banknote, CalendarDays, Clock, ExternalLink, Minus, Plus, Package, ShieldCheck } from "lucide-react";
import { useCountdown } from "@/hooks/use-countdown";
import { formatPhone, formatCurrency, getTaxRateFromAddress } from "@/lib/format";
import EmailInput from "@/components/EmailInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import DeliveryDatePicker, { type DeliveryDate, SATURDAY_SURCHARGE } from "@/components/DeliveryDatePicker";
import logoImg from "@/assets/riversand-logo.png";

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

const CountdownBar = () => {
  const { timeLeft, label } = useCountdown();
  return (
    <div className="flex items-center justify-center gap-2 bg-foreground/90 backdrop-blur-md rounded-xl px-4 py-2.5 mb-6">
      <Clock className="w-4 h-4 text-accent animate-pulse" />
      <span className="font-display text-white text-xs tracking-wider">{label}</span>
      <span className="font-mono text-accent font-bold text-sm">{timeLeft}</span>
    </div>
  );
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

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(null);
  const [codSubOption, setCodSubOption] = useState<"cash" | "check">("cash");
  const [stripePaymentId, setStripePaymentId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<DeliveryDate | null>(null);
  const [dateError, setDateError] = useState("");

  const qtyParam = parseInt(searchParams.get("qty") || "1", 10);
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(10, isNaN(qtyParam) ? 1 : qtyParam)));

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  const taxInfo = useMemo(() => getTaxRateFromAddress(address), [address]);

  const PROCESSING_FEE_RATE = 0.035;
  const saturdaySurchargeTotal = selectedDeliveryDate?.isSaturday ? SATURDAY_SURCHARGE * quantity : 0;
  const subtotal = result ? (result.price * quantity) + saturdaySurchargeTotal : 0;
  const taxAmount = parseFloat((subtotal * taxInfo.rate).toFixed(2));
  const totalPrice = parseFloat((subtotal + taxAmount).toFixed(2));
  const processingFee = parseFloat((totalPrice * PROCESSING_FEE_RATE).toFixed(2));
  const totalWithProcessingFee = parseFloat((totalPrice + processingFee).toFixed(2));

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Handle Stripe return via URL params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (!paymentStatus) return;

    const returnedOrderNumber = searchParams.get("order_number");
    const returnedSessionId = searchParams.get("session_id");
    const returnMode = searchParams.get("return_mode");

    if (returnMode === "popup") {
      // This is the Stripe return tab — signal the original page and close
      const signal = JSON.stringify({
        type: "stripe-payment-result",
        status: paymentStatus,
        order_number: returnedOrderNumber || "",
        session_id: returnedSessionId || "",
        timestamp: Date.now(),
      });
      localStorage.setItem("stripe_payment_signal", signal);
      // Attempt to close the tab
      window.close();
      return;
    }

    // Normal same-tab return
    if (paymentStatus === "success") {
      if (returnedOrderNumber) setOrderNumber(returnedOrderNumber);
      if (returnedSessionId) setStripePaymentId(returnedSessionId);
      setStep("success");
      toast({
        title: "Payment successful",
        description: returnedOrderNumber
          ? `Order ${returnedOrderNumber} is confirmed.`
          : "Your payment was completed successfully.",
      });
      return;
    }

    if (paymentStatus === "canceled") {
      setStep("confirm");
      toast({
        title: "Payment canceled",
        description: "No charge was made. You can try again anytime.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  // Listen for cross-tab Stripe payment signals (from popup return tab)
  useEffect(() => {
    const processSignal = (raw: string) => {
      try {
        const signal = JSON.parse(raw);
        if (signal.type !== "stripe-payment-result") return false;
        localStorage.removeItem("stripe_payment_signal");
        setSubmitting(false);

        if (signal.status === "success") {
          if (signal.order_number) setOrderNumber(signal.order_number);
          if (signal.session_id) setStripePaymentId(signal.session_id);
          setPendingOrderId(null);
          setStep("success");
          toast({
            title: "Payment successful",
            description: signal.order_number
              ? `Order ${signal.order_number} is confirmed.`
              : "Your payment was completed successfully.",
          });
        } else if (signal.status === "canceled") {
          setStep("confirm");
          toast({
            title: "Payment canceled",
            description: "No charge was made. You can try again anytime.",
            variant: "destructive",
          });
        }
        return true;
      } catch {
        return false;
      }
    };

    // Method 1: storage event (fires cross-tab on same origin)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "stripe_payment_signal" && e.newValue) {
        processSignal(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    // Method 2: Poll localStorage as fallback (storage events can be unreliable in iframes)
    const pollInterval = setInterval(() => {
      const raw = localStorage.getItem("stripe_payment_signal");
      if (raw) processSignal(raw);
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      clearInterval(pollInterval);
    };
  }, [toast]);

  // Poll DB for payment status as reliable fallback (webhook updates DB)
  useEffect(() => {
    if (!pendingOrderId || step === "success") return;

    const pollInterval = setInterval(async () => {
      try {
        if (!confirmationToken) return;
        const { data } = await (supabase as any).rpc("get_order_status", {
          p_order_id: pendingOrderId,
          p_token: confirmationToken,
        });
        const row = data?.[0];

        if (row?.payment_status === "paid") {
          if (row.order_number) setOrderNumber(row.order_number);
          setPendingOrderId(null);
          setSubmitting(false);
          setStep("success");
          toast({
            title: "Payment successful",
            description: data.order_number
              ? `Order ${data.order_number} is confirmed.`
              : "Your payment was completed successfully.",
          });
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [pendingOrderId, step, toast]);

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
      setStep(prev => prev === "address" ? "details" : prev);
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
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast({ title: "Missing info", description: "Please enter your name, phone, and email.", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
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
      }).select("order_number, confirmation_token").single();

      if (insertError) throw insertError;
      setOrderNumber(insertedOrder?.order_number || null);
      setStep("success");

      // Send order confirmation emails (fire-and-forget)
      const emailData = {
        ...buildOrderData(),
        payment_method: codSubOption,
        payment_status: "pending",
        order_number: insertedOrder?.order_number,
      };
      supabase.functions.invoke("send-email", {
        body: { type: "order", data: emailData },
      }).catch((err) => console.error("Email send failed:", err));
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
      const orderData = {
        ...buildOrderData(),
        payment_method: "stripe-link",
        payment_status: "pending",
        price: totalWithProcessingFee,
      };
      const { data: insertedOrder, error: insertError } = await (supabase as any)
        .from("orders")
        .insert(orderData)
        .select("id, order_number, confirmation_token")
        .single();

      if (insertError) throw insertError;

      const isEmbedded = window.self !== window.top;
      const description = `River Sand Delivery — ${quantity} load${quantity > 1 ? "s" : ""} × 9 cu yds (incl. 3.5% processing fee)`;
      const { data, error } = await supabase.functions.invoke("create-checkout-link", {
        body: {
          amount: Math.round(totalWithProcessingFee * 100),
          description,
          customer_name: form.name.trim(),
          customer_email: form.email.trim() || null,
          order_id: insertedOrder?.id,
          order_number: insertedOrder?.order_number,
          origin_url: window.location.origin,
          return_mode: isEmbedded ? "popup" : "redirect",
        },
      });

      if (error || !data?.url) {
        throw new Error(data?.error || error?.message || "Failed to create payment link");
      }

      // Store order ID for DB polling
      setPendingOrderId(insertedOrder?.id || null);

      if (isEmbedded) {
        const newTab = window.open(data.url, "_blank");
        if (!newTab) {
          window.location.assign(data.url);
        }
        // Keep submitting=true so button stays disabled while popup is open
        return;
      } else {
        window.location.assign(data.url);
      }
    } catch (err: any) {
      toast({ title: "Payment link failed", description: err.message || "Please try another payment method.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ["Delivery Details", "Payment", "Confirm"];

  const isFormValid = selectedDeliveryDate && form.name.trim() && form.phone.trim() && form.email.trim();

  // --- Section heading helper ---
  const SectionHeading = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-2xl font-display text-foreground tracking-wider">{title}</h2>
    </div>
  );

  // --- Receipt row helper ---
  const ReceiptRow = ({ label, value, accent, destructive }: { label: string; value: string; accent?: boolean; destructive?: boolean }) => (
    <div className="flex justify-between items-center py-2.5">
      <span className={`font-body text-sm ${destructive ? "text-destructive" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-display text-sm ${destructive ? "text-destructive" : accent ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );

  // If this is a popup return tab (window.close() was blocked), show fallback UI
  const isPopupReturn = searchParams.get("return_mode") === "popup" && searchParams.get("payment");
  if (isPopupReturn) {
    const paymentStatus = searchParams.get("payment");
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background flex items-center justify-center">
        <div className="bg-background rounded-2xl p-8 border border-border/50 shadow-lg max-w-md text-center space-y-4">
          {paymentStatus === "success" ? (
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          ) : (
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          )}
          <h2 className="text-2xl font-display text-foreground">
            {paymentStatus === "success" ? "Payment Complete!" : "Payment Canceled"}
          </h2>
          <p className="font-body text-muted-foreground">
            {paymentStatus === "success"
              ? "Your payment has been processed. You can close this tab and return to your order page."
              : "No charge was made. You can close this tab and try again."}
          </p>
          <Button onClick={() => window.close()} className="font-display tracking-wider">
            Close This Tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background">
      <Navbar solid />

      <div className="container mx-auto px-4 pt-24 pb-8 md:pt-28 md:pb-12">
        {/* Sticky countdown + progress */}
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md py-3 border-b border-accent/10 -mx-4 px-4 mb-4">
          <CountdownBar />
          {/* Progress steps */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            {stepLabels.map((label, i) => {
              const stepIndex = ["address", "details", "confirm"].indexOf(step === "success" ? "confirm" : step);
              const isActive = i <= stepIndex;
              const isCurrent = i === stepIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <motion.div
                    animate={{
                      scale: isCurrent ? 1.1 : 1,
                      boxShadow: isCurrent ? "0 4px 14px hsl(var(--accent) / 0.3)" : "0 1px 3px hsl(var(--border) / 0.5)",
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-xs transition-colors duration-300 ${
                      isCurrent ? "bg-accent text-accent-foreground" 
                      : isActive ? "bg-accent/60 text-accent-foreground" 
                      : "bg-muted text-muted-foreground/50"
                    }`}
                  >
                    {isActive && i < stepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </motion.div>
                  <span className={`font-body text-xs hidden sm:inline transition-colors duration-300 ${
                    isCurrent ? "text-foreground font-medium" : isActive ? "text-foreground/70" : "text-muted-foreground/50"
                  }`}>{label}</span>
                  {i < 2 && <div className={`w-8 h-px transition-colors duration-300 ${isActive ? "bg-accent/60" : "bg-border"}`} />}
                </div>
              );
            })}
          </motion.div>
        </div>

        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* STEP 1: Address */}
            {step === "address" && (
              <motion.div key="address" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="bg-background rounded-2xl p-6 md:p-8 border border-border/50 shadow-lg shadow-foreground/5">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-4xl md:text-5xl font-display text-foreground mb-2"
                >
                  PLACE YOUR ORDER
                </motion.h1>
                <p className="font-body text-muted-foreground mb-6">Enter your delivery address to get your instant price. {quantity > 1 ? `${quantity} loads × ` : ""}9 cubic yards of quality river sand.</p>

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
                    className="h-14 text-base rounded-xl border-border/50 shadow-sm focus:shadow-md transition-shadow"
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
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                      <p className="font-body text-sm text-destructive">{error}</p>
                    </motion.div>
                  )}
                  <Button onClick={calculateDistance} disabled={loading} className="w-full h-14 font-display tracking-wider text-lg rounded-xl shadow-md hover:shadow-lg transition-shadow">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" /> GET DELIVERY PRICE</>}
                  </Button>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {[
                    { top: "LOCAL AREA", bot: "Starting at $195" },
                    { top: "EXTENDED", bot: "Surcharge applies" },
                    { top: "9 YDS", bot: "Per load" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.top}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="p-3 bg-muted/50 border border-border/50 rounded-xl hover:shadow-md transition-shadow"
                    >
                      <p className="font-display text-lg text-primary">{item.top}</p>
                      <p className="font-body text-xs text-muted-foreground">{item.bot}</p>
                    </motion.div>
                  ))}
                </div>

                <Link to="/" className="block mt-4">
                  <Button variant="outline" className="w-full font-display tracking-wider">
                    <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO HOME
                  </Button>
                </Link>
              </motion.div>
            )}

            {/* STEP 2: Details + Payment */}
            {step === "details" && result && (
              <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-4">
                {/* Compact delivery confirmation banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="font-display text-sm tracking-wider text-primary">DELIVERY AVAILABLE</span>
                  </div>
                  <span className="font-display text-xl text-primary">{formatCurrency(result.price)}<span className="text-xs font-body text-muted-foreground">/load</span></span>
                </motion.div>

                {/* Combined: Delivery Date + Customer Info */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  {/* Delivery Date Section */}
                  <div className="p-6">
                    <SectionHeading icon={CalendarDays} title="DELIVERY DATE" />
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

                  <Separator />

                  {/* Customer Info Section */}
                  <div className="p-6">
                    <SectionHeading icon={User} title="YOUR INFORMATION" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Full Name *</label>
                        <Input placeholder="John Smith" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg" />
                      </div>
                      <div>
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Phone *</label>
                        <Input type="tel" placeholder="(504) 555-0123" required maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="h-11 rounded-lg" />
                      </div>
                      <div>
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Email *</label>
                        <EmailInput value={form.email} onChange={(v) => setForm({ ...form, email: v })} required className="h-11 rounded-lg" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Delivery Notes (optional)</label>
                        <Textarea placeholder="Gate code, placement instructions..." maxLength={1000} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg" />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Order Summary */}
                {selectedDeliveryDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden hover:shadow-xl transition-shadow duration-300"
                  >
                    <div className="p-6">
                      <SectionHeading icon={Package} title="ORDER SUMMARY" />

                      {/* Quantity selector */}
                      <div className="flex items-center justify-between py-2.5 border-b border-dashed border-border">
                        <span className="font-body text-sm text-muted-foreground">Number of Loads</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-display text-lg text-foreground w-6 text-center">{quantity}</span>
                          <button onClick={() => setQuantity(q => Math.min(10, q + 1))} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <ReceiptRow label={`River Sand (9 cu yds × ${quantity})`} value={`${quantity} load${quantity > 1 ? "s" : ""}`} />
                      <div className="border-b border-dashed border-border" />
                      <ReceiptRow label={`Base delivery × ${quantity}`} value={formatCurrency(195 * quantity)} />
                      {result.distance > BASE_MILES && (
                        <>
                          <div className="border-b border-dashed border-border" />
                          <ReceiptRow label={`Extended delivery surcharge × ${quantity}`} value={`+${formatCurrency((result.distance - BASE_MILES) * PER_MILE_EXTRA * quantity)}`} />
                        </>
                      )}
                      <div className="border-b border-dashed border-border" />
                      <ReceiptRow label="Delivery Date" value={selectedDeliveryDate.fullLabel} />
                      <div className="border-b border-dashed border-border" />
                      <ReceiptRow label="Delivery Window" value="8:00 AM – 5:00 PM" />

                      {selectedDeliveryDate.isSameDay && (
                        <p className="font-body text-xs text-destructive bg-destructive/5 p-2 rounded-lg my-2">
                          ⚡ Same-day request — our team will call to confirm availability.
                        </p>
                      )}

                      {selectedDeliveryDate.isSaturday && (
                        <>
                          <div className="border-b border-dashed border-border" />
                          <ReceiptRow label={`Saturday Surcharge ($35 × ${quantity})`} value={`+${formatCurrency(saturdaySurchargeTotal)}`} destructive />
                        </>
                      )}

                      {/* Totals area */}
                      <div className="mt-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-body text-muted-foreground">Subtotal</span>
                          <span className="font-display text-foreground">{formatCurrency(result.price * quantity)}</span>
                        </div>
                        {selectedDeliveryDate.isSaturday && (
                          <div className="flex justify-between text-sm">
                            <span className="font-body text-muted-foreground">Saturday surcharge</span>
                            <span className="font-display text-foreground">+{formatCurrency(saturdaySurchargeTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="font-body text-muted-foreground">Sales Tax ({(taxInfo.rate * 100).toFixed(2)}% — {taxInfo.parish})</span>
                          <span className="font-display text-foreground">+{formatCurrency(taxAmount)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between items-center">
                          <span className="font-display text-lg text-foreground">TOTAL DUE</span>
                          <span className="font-display text-2xl text-primary">{formatCurrency(totalPrice)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Payment method */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <div className="p-6">
                    <SectionHeading icon={CreditCard} title="PAYMENT METHOD" />

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("stripe-link")}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          paymentMethod === "stripe-link"
                            ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
                            : "border-border bg-card hover:border-accent/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className={`w-4 h-4 ${paymentMethod === "stripe-link" ? "text-accent" : "text-muted-foreground"}`} />
                          <p className="font-display text-xs text-foreground tracking-wider">PAY NOW</p>
                        </div>
                        <p className="font-body text-[10px] text-muted-foreground flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Secure Checkout
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          paymentMethod === "cash" || paymentMethod === "check"
                            ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
                            : "border-border bg-card hover:border-accent/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Banknote className={`w-4 h-4 ${paymentMethod === "cash" || paymentMethod === "check" ? "text-accent" : "text-muted-foreground"}`} />
                          <p className="font-display text-xs text-foreground tracking-wider">AT DELIVERY</p>
                        </div>
                        <p className="font-body text-[10px] text-muted-foreground">Cash or Check</p>
                      </button>
                    </div>

                    {paymentMethod === "stripe-link" && (
                      <div className="space-y-3">
                        <div className="bg-card border border-border rounded-lg p-3 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-body text-muted-foreground">Order Total</span>
                            <span className="font-display text-foreground">{formatCurrency(totalPrice)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-body text-muted-foreground">Processing Fee (3.5%)</span>
                            <span className="font-display text-foreground">+{formatCurrency(processingFee)}</span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex justify-between">
                            <span className="font-display text-sm text-foreground">TOTAL CHARGE</span>
                            <span className="font-display text-lg text-primary">{formatCurrency(totalWithProcessingFee)}</span>
                          </div>
                        </div>
                        <p className="font-body text-[10px] text-muted-foreground text-center">
                          3.5% processing fee applies. Pay at delivery to avoid.
                        </p>
                      </div>
                    )}

                    {(paymentMethod === "cash" || paymentMethod === "check") && (
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
                          <label htmlFor="cash" className="font-body text-sm text-foreground cursor-pointer">Cash</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="check" id="check" />
                          <label htmlFor="check" className="font-body text-sm text-foreground cursor-pointer">Check</label>
                        </div>
                      </RadioGroup>
                    )}

                    {!paymentMethod && (
                      <p className="font-body text-xs text-muted-foreground text-center">Select a payment method to continue.</p>
                    )}
                  </div>

                  {/* Review Order Button */}
                  {paymentMethod && (
                    <div className="px-6 pb-6 space-y-2">
                      <Button
                        onClick={goToStep2}
                        disabled={!isFormValid}
                        className="w-full h-14 font-display tracking-wider text-lg rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-300"
                      >
                        <ShieldCheck className="w-5 h-5 mr-2" /> REVIEW ORDER
                      </Button>
                      {!isFormValid && (
                        <p className="font-body text-xs text-destructive text-center">
                          {!selectedDeliveryDate ? "Please select a delivery date above." : "Please fill in your name and phone number above."}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>

                <Button variant="outline" onClick={() => setStep("address")} className="h-11 font-display tracking-wider rounded-xl border-accent/50 text-accent hover:text-accent hover:bg-accent/10 text-sm">
                  <ArrowLeft className="w-4 h-4 mr-1" /> CHANGE ADDRESS
                </Button>
              </motion.div>
            )}

            {/* STEP 3: Confirm */}
            {step === "confirm" && result && selectedDeliveryDate && (
              <motion.div key="confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-4 relative">
                {/* Payment waiting overlay */}
                {pendingOrderId && submitting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4"
                  >
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="font-display text-lg text-foreground tracking-wider">Waiting for payment confirmation…</p>
                    <p className="font-body text-sm text-muted-foreground max-w-xs text-center">Complete your payment in the Stripe tab. This page will update automatically.</p>
                  </motion.div>
                )}
                {/* Receipt-style confirmation */}
                <div className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden">

                  <div className="p-6 space-y-4">
                    <h2 className="text-2xl font-display text-foreground text-center tracking-wider">CONFIRM YOUR ORDER</h2>

                    {/* Product */}
                    <div>
                      <p className="font-display text-xs text-muted-foreground tracking-wider mb-2">PRODUCT</p>
                      <ReceiptRow label="River Sand" value={`${quantity} × 9 CU YDS`} />
                    </div>
                    <div className="border-b border-dashed border-border" />

                    {/* Delivery */}
                    <div>
                      <p className="font-display text-xs text-muted-foreground tracking-wider mb-2">DELIVERY</p>
                      <ReceiptRow label="Address" value="" />
                      <p className="font-body text-sm text-foreground -mt-1 mb-2 text-right">{address}</p>
                      <ReceiptRow label="Date" value={selectedDeliveryDate.fullLabel} />
                      <ReceiptRow label="Window" value="8:00 AM – 5:00 PM" />
                    </div>
                    <div className="border-b border-dashed border-border" />

                    {/* Customer */}
                    <div>
                      <p className="font-display text-xs text-muted-foreground tracking-wider mb-2">CUSTOMER</p>
                      <ReceiptRow label="Name" value={form.name} />
                      <ReceiptRow label="Phone" value={form.phone} />
                      {form.email && <ReceiptRow label="Email" value={form.email} />}
                    </div>
                    <div className="border-b border-dashed border-border" />

                    {/* Payment */}
                    <div>
                      <p className="font-display text-xs text-muted-foreground tracking-wider mb-2">PAYMENT</p>
                      <ReceiptRow label="Method" value={paymentMethod === "stripe-link" ? "Pay Now — Stripe" : `${codSubOption === "cash" ? "Cash" : "Check"} at Delivery`} />

                      {selectedDeliveryDate.isSameDay && (
                        <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg my-2">
                          ⚡ Same-day request — we'll call to confirm availability.
                        </p>
                      )}

                      {selectedDeliveryDate.isSaturday && (
                        <ReceiptRow label={`Saturday Surcharge ($35 × ${quantity})`} value={`+${formatCurrency(saturdaySurchargeTotal)}`} destructive />
                      )}
                      <ReceiptRow label={`Sales Tax (${(taxInfo.rate * 100).toFixed(2)}%)`} value={`+${formatCurrency(taxAmount)}`} />

                      {paymentMethod === "stripe-link" && (
                        <>
                          <ReceiptRow label="Subtotal" value={formatCurrency(totalPrice)} />
                          <ReceiptRow label="Processing Fee (3.5%)" value={`+${formatCurrency(processingFee)}`} />
                        </>
                      )}
                    </div>

                    {/* Grand total */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 flex justify-between items-center">
                      <span className="font-display text-lg text-foreground">
                        {paymentMethod === "stripe-link" ? "TOTAL CHARGE" : "TOTAL"}
                      </span>
                      <span className="font-display text-3xl text-primary">
                        {paymentMethod === "stripe-link" ? formatCurrency(totalWithProcessingFee) : formatCurrency(totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Curbside disclaimer checkbox */}
                <label htmlFor="disclaimer" className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 cursor-pointer hover:bg-amber-100/60 transition-colors">
                  <Checkbox
                    id="disclaimer"
                    checked={disclaimerAccepted}
                    onCheckedChange={(checked) => setDisclaimerAccepted(!!checked)}
                    className="mt-0.5 border-amber-400 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <span className="text-amber-800 text-xs font-body leading-relaxed">
                    <strong>Curbside Delivery Only:</strong> I understand that all deliveries are curbside only. Due to liability, deliveries cannot be made inside backyards or enclosed areas.
                  </span>
                </label>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setDisclaimerAccepted(false); setStep("details"); }} className="h-12 font-display tracking-wider rounded-xl text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> BACK
                  </Button>
                  <Button
                    onClick={paymentMethod === "stripe-link" ? handleStripeLink : handleCodSubmit}
                    disabled={submitting || !disclaimerAccepted}
                    className="flex-1 h-14 font-display tracking-wider text-base bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-300"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      paymentMethod === "stripe-link"
                        ? <><Lock className="w-4 h-4 mr-2" /> PAY {formatCurrency(totalWithProcessingFee)}</>
                        : <><CheckCircle2 className="w-4 h-4 mr-2" /> PLACE ORDER</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* SUCCESS */}
            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="space-y-4">
                <div className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden">
                  {/* Logo header */}
                  <div className="bg-muted/50 py-4 flex justify-center border-b border-border/50">
                    <img src={logoImg} alt="RIVERSAND" className="h-[67px] lg:h-[80px] w-auto object-contain" />
                  </div>

                  <div className="p-8 text-center space-y-5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                      className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </motion.div>

                    <h2 className="text-3xl font-display text-foreground">ORDER PLACED!</h2>

                    {orderNumber && (
                      <div className="bg-card border-2 border-primary/20 rounded-xl p-4 max-w-xs mx-auto">
                        <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Order Number</p>
                        <p className="font-display text-2xl text-primary mt-1">{orderNumber}</p>
                      </div>
                    )}

                    {stripePaymentId ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <CheckCircle2 className="w-4 h-4" />
                        <p className="font-display text-sm tracking-wider">PAYMENT CONFIRMED</p>
                      </div>
                    ) : (
                      <p className="font-body text-sm text-muted-foreground max-w-sm mx-auto">
                        Payment of <strong className="text-primary">{formatCurrency(totalPrice)}</strong> due at delivery by <strong className="text-foreground">{codSubOption}</strong>.
                      </p>
                    )}

                    {selectedDeliveryDate && (
                      <div className="bg-card border border-border rounded-xl p-3 max-w-xs mx-auto">
                        <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Scheduled Delivery</p>
                        <p className="font-display text-lg text-foreground mt-1">{selectedDeliveryDate.fullLabel}</p>
                        <p className="font-body text-xs text-muted-foreground">8:00 AM – 5:00 PM</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* What happens next timeline */}
                <div className="bg-background rounded-2xl border border-border/50 p-6 shadow-lg shadow-foreground/5">
                  <h3 className="font-display text-lg text-foreground tracking-wider mb-4">WHAT HAPPENS NEXT?</h3>
                  <div className="space-y-4">
                    {[
                      { icon: CheckCircle2, title: "Order Confirmed", desc: "Your order has been received and logged." },
                      { icon: Phone, title: "We'll Call You", desc: `We'll reach out to ${form.phone} to confirm details.` },
                      { icon: Truck, title: "Delivery Day", desc: selectedDeliveryDate ? `${selectedDeliveryDate.fullLabel}, 8 AM – 5 PM` : "As scheduled" },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.15 }}
                        className="flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-display text-sm text-foreground">{item.title}</p>
                          <p className="font-body text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="font-display tracking-wider rounded-xl h-12">
                    <Link to="/">BACK TO HOME</Link>
                  </Button>
                  <Button variant="outline" asChild className="font-display tracking-wider rounded-xl h-12">
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
