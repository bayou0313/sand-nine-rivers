import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { updateSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2, User, Phone, Mail, FileText, CreditCard, ArrowLeft, Lock, Banknote, CalendarDays, Clock, ExternalLink, Minus, Plus, Package, ShieldCheck, Printer, Download } from "lucide-react";
import { useCountdown } from "@/hooks/use-countdown";
import { formatPhone, formatCurrency, getTaxRateFromAddress, getParishFromPlaceResult, getTaxRateByParish } from "@/lib/format";
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
import DeliveryDatePicker, { type DeliveryDate, type PitSchedule, SATURDAY_SURCHARGE, getEffectiveSaturdaySurcharge } from "@/components/DeliveryDatePicker";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import logoImg from "@/assets/riversand-logo.png";
import { type PitData, type GlobalPricing, findBestPit, getEffectivePrice, parseGlobalSettings, FALLBACK_GLOBAL_PRICING } from "@/lib/pits";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google: any;
  }
}

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

  // Dynamic pricing from global_settings + PITs
  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL_PRICING);
  const [allPits, setAllPits] = useState<PitData[]>([]);
  const [matchedPit, setMatchedPit] = useState<PitData | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Derived pricing from matched PIT (or global fallback)
  const effectivePricing = useMemo(() => {
    if (matchedPit) return getEffectivePrice(matchedPit, globalPricing);
    return { base_price: globalPricing.base_price, free_miles: globalPricing.free_miles, extra_per_mile: globalPricing.extra_per_mile, max_distance: globalPricing.max_distance, saturday_surcharge: globalPricing.saturday_surcharge };
  }, [matchedPit, globalPricing]);

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, pitsRes] = await Promise.all([
        supabase.from("global_settings").select("key, value"),
        supabase.from("pits").select("id, name, lat, lon, status, base_price, free_miles, price_per_extra_mile, max_distance, operating_days, saturday_surcharge_override, same_day_cutoff").eq("status", "active"),
      ]);
      if (settingsRes.data) {
        const gp = parseGlobalSettings(settingsRes.data as any);
        setGlobalPricing(gp);
        setGlobalSaturdaySurcharge(gp.saturday_surcharge);
      }
      if (pitsRes.data) {
        setAllPits(pitsRes.data as any);
      }
    };
    fetchData();
  }, []);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(null);
  const [codSubOption, setCodSubOption] = useState<"cash" | "check">("cash");
  const [stripePaymentId, setStripePaymentId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [lookupToken, setLookupToken] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);
  const [outOfAreaAddress, setOutOfAreaAddress] = useState("");
  const [outOfAreaDistance, setOutOfAreaDistance] = useState(0);
  const [nearestPitInfo, setNearestPitInfo] = useState<{ id: string; name: string; distance: number } | null>(null);
  const [leadReference, setLeadReference] = useState<string | null>(null);
  const [showProposalBanner, setShowProposalBanner] = useState(false);
  const [matchedPitSchedule, setMatchedPitSchedule] = useState<PitSchedule | null>(null);
  const [globalSaturdaySurcharge, setGlobalSaturdaySurcharge] = useState<number>(SATURDAY_SURCHARGE);
  const [confirmedTotals, setConfirmedTotals] = useState<{
    totalPrice: number;
    totalWithProcessingFee: number;
    processingFee: number;
    taxAmount: number;
    subtotal: number;
    saturdaySurchargeTotal: number;
    distanceFee: number;
    taxInfo: { rate: number; parish: string };
  } | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<DeliveryDate | null>(null);
  const [dateError, setDateError] = useState("");

  const qtyParam = parseInt(searchParams.get("qty") || "1", 10);
  const discountParam = parseFloat(searchParams.get("discount") || "0");
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(10, isNaN(qtyParam) ? 1 : qtyParam)));
  const [discountAmount] = useState(isNaN(discountParam) ? 0 : Math.max(0, discountParam));

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [detectedParish, setDetectedParish] = useState<string | null>(null);

  const taxInfo = useMemo(() => {
    if (detectedParish) return getTaxRateByParish(detectedParish);
    return getTaxRateFromAddress(address);
  }, [address, detectedParish]);

  const PROCESSING_FEE_RATE = 0.035;
  const effectiveSatSurcharge = getEffectiveSaturdaySurcharge(matchedPitSchedule, globalSaturdaySurcharge);
  const saturdaySurchargeTotal = selectedDeliveryDate?.isSaturday ? effectiveSatSurcharge * quantity : 0;
  const effectiveDiscount = result ? Math.min(discountAmount * quantity, result.price * quantity) : 0;
  const subtotal = result ? (result.price * quantity) + saturdaySurchargeTotal - effectiveDiscount : 0;
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
      // Email is sent by the Stripe webhook for same-tab returns
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
          if (pendingOrderId) setConfirmedOrderId(pendingOrderId);
          setPendingOrderId(null);
          setConfirmedTotals({
            totalPrice,
            totalWithProcessingFee,
            processingFee,
            taxAmount,
            subtotal,
            saturdaySurchargeTotal,
            distanceFee: result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0,
            taxInfo,
          });
          setStep("success");
          updateSession({
            stage: "completed_order",
            order_id: signal.order_number || null,
            order_number: signal.order_number || null,
          });
          // Send confirmation email for Stripe payment
          sendOrderEmailRef.current(signal.order_number || null, "stripe-link", "paid", signal.session_id || null);
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

  // Helper: send order confirmation email
  const sendOrderEmail = useCallback((orderNum: string | null, pMethod: string, pStatus: string, sPaymentId: string | null, totalsOverride?: any) => {
    console.log("[Order] sendOrderEmail called, result:", !!result, "confirmedTotals:", !!confirmedTotals, "totalsOverride:", !!totalsOverride, "orderNum:", orderNum, "pMethod:", pMethod);
    const distMiles = result?.distance ?? 0;
    const ct = totalsOverride || confirmedTotals;
    const emailTotalPrice = ct?.totalPrice ?? totalPrice;
    const emailTotalWithFee = ct?.totalWithProcessingFee ?? totalWithProcessingFee;
    const emailSatSurcharge = ct?.saturdaySurchargeTotal ?? saturdaySurchargeTotal;
    const emailTaxRate = ct?.taxInfo?.rate ?? taxInfo.rate;
    const emailTaxAmount = ct?.taxAmount ?? taxAmount;
    const emailTaxParish = ct?.taxInfo?.parish ?? taxInfo.parish;

    if (!result && !ct) { console.warn("[Order] Email NOT sent — no result or totals"); return; }

    const emailPayload = {
      order_number: orderNum,
      customer_name: form.name.trim(),
      customer_email: form.email.trim() || null,
      customer_phone: form.phone.trim(),
      delivery_address: address,
      delivery_date: selectedDeliveryDate?.iso || null,
      delivery_day_of_week: selectedDeliveryDate?.dayOfWeek || null,
      delivery_window: "8:00 AM – 5:00 PM",
      quantity,
      price: pMethod === "stripe-link" ? emailTotalWithFee : emailTotalPrice,
      distance_miles: distMiles,
      saturday_surcharge: selectedDeliveryDate?.isSaturday || false,
      saturday_surcharge_amount: emailSatSurcharge,
      same_day_requested: selectedDeliveryDate?.isSameDay || false,
      tax_rate: emailTaxRate,
      tax_amount: emailTaxAmount,
      tax_parish: emailTaxParish,
      payment_method: pMethod,
      payment_status: pStatus,
      stripe_payment_id: sPaymentId,
      notes: form.notes.trim() || null,
    };
    console.log("[Order] Sending order confirmation email for", orderNum, "payload:", JSON.stringify(emailPayload));
    supabase.functions.invoke("send-email", {
      body: { type: "order_confirmation", data: emailPayload },
    }).then((res) => {
      if (res.error) console.error("[Order] Email invoke error:", res.error);
      else console.log("[Order] Email sent successfully:", res.data);
    }).catch((err) => console.error("[Order] Email send exception:", err));
  }, [result, confirmedTotals, form, address, selectedDeliveryDate, quantity, totalPrice, totalWithProcessingFee, saturdaySurchargeTotal, taxInfo, taxAmount]);

  // Keep a ref to avoid stale closure in Stripe signal listener
  const sendOrderEmailRef = useRef(sendOrderEmail);
  useEffect(() => { sendOrderEmailRef.current = sendOrderEmail; }, [sendOrderEmail]);

  useEffect(() => {
    const paramAddress = searchParams.get("address");
    const paramDistance = searchParams.get("distance");
    const paramPrice = searchParams.get("price");
    const paramDuration = searchParams.get("duration");
    const paramLead = searchParams.get("lead");
    const paramUtmSource = searchParams.get("utm_source");

    if (paramLead) setLeadReference(paramLead);
    if (paramUtmSource === "proposal") setShowProposalBanner(true);

    if (paramAddress && paramPrice) {
      setAddress(paramAddress);
      const price = parseFloat(paramPrice);
      const dist = paramDistance ? parseFloat(paramDistance) : (price > globalPricing.base_price ? ((price - globalPricing.base_price) / globalPricing.extra_per_mile) + globalPricing.free_miles : 10);
      setResult({
        distance: parseFloat(dist.toFixed(1)),
        price: isNaN(price) ? globalPricing.base_price : price,
        address: `${dist.toFixed(1)} miles away`,
        duration: paramDuration || "~30 min",
      });
      setStep(prev => prev === "address" ? "details" : prev);
    } else if (paramAddress && paramDistance && paramDuration) {
      setAddress(paramAddress);
      setResult({
        distance: parseFloat(paramDistance),
        price: parseFloat(paramPrice || String(globalPricing.base_price)),
        address: `${paramDistance} miles away`,
        duration: paramDuration,
      });
      setStep(prev => prev === "address" ? "details" : prev);
    } else if (paramAddress) {
      setAddress(paramAddress);
      // Auto-trigger distance calculation after API loads
      setTimeout(() => {
        if (window.google?.maps) {
          const btn = document.querySelector('[data-calc-btn]') as HTMLButtonElement;
          btn?.click();
        }
      }, 1500);
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
      if (place?.geometry?.location) {
        setCustomerCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
      if (place?.address_components) {
        const parish = getParishFromPlaceResult(place.address_components);
        setDetectedParish(parish);
      }
    });
  }, [apiLoaded]);

  const calculateDistance = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      let custLat = customerCoords?.lat;
      let custLng = customerCoords?.lng;

      // Fallback geocode if coords not captured from Places
      if (custLat == null || custLng == null) {
        if (!GOOGLE_MAPS_API_KEY) {
          setError("Google Maps API key not configured.");
          setLoading(false); return;
        }
        const geocodeResp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`);
        const geocodeData = await geocodeResp.json();
        if (geocodeData.results?.[0]) {
          custLat = geocodeData.results[0].geometry.location.lat;
          custLng = geocodeData.results[0].geometry.location.lng;
        } else {
          setError("Could not locate that address. Please try again.");
          setLoading(false); return;
        }
      }

      if (allPits.length === 0) {
        setError("No delivery locations configured. Please call us for pricing.");
        setLoading(false); return;
      }

      const bestResult = findBestPit(allPits, custLat!, custLng!, globalPricing);

      if (!bestResult) {
        setError("No delivery locations available. Please call us.");
        setLoading(false); return;
      }

      if (!bestResult.serviceable) {
        setError("That address is outside our delivery area. Please call us for options.");
        setOutOfAreaAddress(address);
        setOutOfAreaDistance(parseFloat(bestResult.distance.toFixed(1)));
        setNearestPitInfo({ id: bestResult.pit.id, name: bestResult.pit.name, distance: bestResult.distance });
        setShowOutOfAreaModal(true);
        setLoading(false); return;
      }

      // Store matched PIT for pricing and schedule
      setMatchedPit(bestResult.pit);
      setMatchedPitSchedule({
        operating_days: bestResult.pit.operating_days,
        saturday_surcharge_override: bestResult.pit.saturday_surcharge_override != null ? Number(bestResult.pit.saturday_surcharge_override) : null,
        same_day_cutoff: bestResult.pit.same_day_cutoff,
      });

      setResult({
        distance: parseFloat(bestResult.distance.toFixed(1)),
        price: bestResult.price,
        address: `${bestResult.distance.toFixed(1)} mi away`,
        duration: "~30 min",
      });
      setStep("details");
      updateSession({
        stage: "started_checkout",
        delivery_address: address,
        calculated_price: bestResult.price,
        nearest_pit_id: bestResult.pit.id,
        nearest_pit_name: bestResult.pit.name,
        serviceable: true,
      });
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setLoading(false);
    }
  }, [address, customerCoords, allPits, globalPricing]);

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
    updateSession({
      stage: "reached_payment",
      customer_name: form.name.trim(),
      customer_email: form.email.trim() || null,
      customer_phone: form.phone.trim(),
    });
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
    saturday_surcharge_amount: selectedDeliveryDate!.isSaturday ? effectiveSatSurcharge * quantity : 0,
    delivery_window: "8:00 AM – 5:00 PM",
    same_day_requested: selectedDeliveryDate!.isSameDay,
    tax_rate: taxInfo.rate,
    tax_amount: taxAmount,
    ...(leadReference ? { lead_reference: leadReference } : {}),
  });

  const handleCodSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Please enter your name and phone number.", variant: "destructive" });
      return;
    }
    if (!result || !selectedDeliveryDate) return;

    setSubmitting(true);
    try {
      const { data: rpcResult, error: insertError } = await supabase.rpc("create_order", {
        p_data: {
          ...buildOrderData(),
          payment_method: codSubOption,
          payment_status: "pending",
        },
      });

      if (insertError) throw insertError;
      const inserted = rpcResult as any;
      setOrderNumber(inserted?.order_number || null);
      setConfirmedOrderId(inserted?.id || null);
      setLookupToken(inserted?.lookup_token || null);
      const snapshotTotals = {
        totalPrice,
        totalWithProcessingFee,
        processingFee,
        taxAmount,
        subtotal,
        saturdaySurchargeTotal,
        distanceFee: result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0,
        taxInfo,
      };
      setConfirmedTotals(snapshotTotals);
      setStep("success");
      updateSession({
        stage: "completed_order",
        order_id: inserted?.id || null,
        order_number: inserted?.order_number || null,
      });

      // Send order confirmation email with totals passed directly (state not yet updated)
      sendOrderEmail(inserted?.order_number || null, codSubOption, "pending", null, snapshotTotals);

      // Mark lead as converted if this order came from a proposal
      if (leadReference) {
        supabase.functions.invoke("leads-auth", {
          body: {
            password: "system",
            action: "mark_converted",
            lead_number: leadReference,
            order_number: inserted?.order_number || null,
          },
        }).catch((err: any) => console.warn("[Order] Lead conversion tracking failed:", err));
      }
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
      const { data: rpcResult, error: insertError } = await supabase.rpc("create_order", {
        p_data: orderData,
      });

      if (insertError) throw insertError;
      const insertedOrder = rpcResult as any;

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

      // Store order ID and token for DB polling
      setPendingOrderId(insertedOrder?.id || null);
      setLookupToken(insertedOrder?.lookup_token || null);

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

  const handleDownloadInvoice = async () => {
    if (!confirmedOrderId || !lookupToken) {
      toast({ title: "Unable to download", description: "Order information not available.", variant: "destructive" });
      return;
    }
    setDownloadingInvoice(true);
    try {
      const response = await supabase.functions.invoke("generate-invoice", {
        body: { order_id: confirmedOrderId, lookup_token: lookupToken },
      });
      if (response.error) throw new Error("Failed to generate invoice");

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${orderNumber || "order"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setDownloadingInvoice(false);
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
    <>
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background">
      <Navbar solid />

      <div className="container mx-auto px-4 pt-24 pb-8 md:pt-28 md:pb-12">
        {/* Proposal banner for leads coming from email */}
        {showProposalBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-xl flex items-center justify-between"
            style={{ backgroundColor: "#FFF8E7", border: "1px solid #C07A00" }}
          >
            <p className="font-body text-sm" style={{ color: "#0D2137" }}>
              <strong>Welcome back!</strong> River Sand is now delivering to your area. Your price is locked in below.
            </p>
            <button onClick={() => setShowProposalBanner(false)} className="ml-4 text-lg font-bold" style={{ color: "#0D2137" }}>×</button>
          </motion.div>
        )}
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
                  <Button data-calc-btn onClick={calculateDistance} disabled={loading} className="w-full h-14 font-display tracking-wider text-lg rounded-xl shadow-md hover:shadow-lg transition-shadow">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" /> GET DELIVERY PRICE</>}
                  </Button>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {[
                    { top: "LOCAL AREA", bot: "Included delivery" },
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
                      pitSchedule={matchedPitSchedule}
                      globalSaturdaySurcharge={globalSaturdaySurcharge}
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
                      <ReceiptRow label={`Base delivery × ${quantity}`} value={formatCurrency(effectivePricing.base_price * quantity)} />
                      {result.distance > effectivePricing.free_miles && (
                        <>
                          <div className="border-b border-dashed border-border" />
                          <ReceiptRow label={`Extended delivery surcharge × ${quantity}`} value={`+${formatCurrency((result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity)}`} />
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

                      {effectiveDiscount > 0 && (
                        <>
                          <div className="border-b border-dashed border-border" />
                          <ReceiptRow label="Loyalty discount" value={`-${formatCurrency(effectiveDiscount)}`} accent />
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
                          <span className="font-body text-muted-foreground">Sales tax — {taxInfo.parish} ({(taxInfo.rate * 100).toFixed(2)}%)</span>
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
                      <ReceiptRow label={`Sales tax — ${taxInfo.parish} (${(taxInfo.rate * 100).toFixed(2)}%)`} value={`+${formatCurrency(taxAmount)}`} />

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

            {/* SUCCESS — Full Confirmation Page */}
            {step === "success" && (() => {
              const dt = confirmedTotals;
              const displayTotal = dt?.totalPrice ?? totalPrice;
              const displayTotalWithFee = dt?.totalWithProcessingFee ?? totalWithProcessingFee;
              const displayProcessingFee = dt?.processingFee ?? processingFee;
              const displayTaxAmount = dt?.taxAmount ?? taxAmount;
              const displaySubtotal = dt?.subtotal ?? subtotal;
              const displaySaturdaySurcharge = dt?.saturdaySurchargeTotal ?? saturdaySurchargeTotal;
              const displayDistanceFee = dt?.distanceFee ?? (result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0);
              const displayTaxInfo = dt?.taxInfo ?? taxInfo;
              return (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="space-y-5 print-confirmation">
                {/* Header */}
                <div className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden">
                  <div className="bg-muted/50 py-4 flex justify-center border-b border-border/50">
                    <img src={logoImg} alt="RIVERSAND" className="h-[67px] lg:h-[80px] w-auto object-contain" />
                  </div>
                  <div className="p-8 text-center space-y-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }} className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
                    </motion.div>
                    <h2 className="text-3xl font-display text-foreground">ORDER CONFIRMED</h2>
                    {form.email && (
                      <p className="font-body text-sm text-muted-foreground">A copy of this confirmation has been sent to <strong className="text-foreground">{form.email}</strong></p>
                    )}
                  </div>
                </div>

                {/* Stripe Payment Block (card only) */}
                {(paymentMethod === "stripe-link") && (
                  <div className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden">
                    <div className="bg-foreground px-6 py-3">
                      <h3 className="font-display text-sm text-background tracking-wider">PAYMENT CONFIRMED</h3>
                    </div>
                    <div className="p-6 space-y-2">
                      {stripePaymentId && (
                        <div className="flex justify-between py-1.5">
                          <span className="font-body text-sm text-muted-foreground">Payment ID</span>
                          <span className="font-mono text-xs text-foreground">{stripePaymentId}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Amount Charged</span>
                        <span className="font-display text-sm text-foreground">{formatCurrency(displayTotalWithFee)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Currency</span>
                        <span className="font-display text-sm text-foreground">USD</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Status</span>
                        <span className="font-display text-sm text-[#22C55E]">Succeeded ✓</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Payment Method</span>
                        <span className="font-display text-sm text-foreground">Credit Card</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Payment Date</span>
                        <span className="font-body text-sm text-foreground">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Processing Fee (3.5%)</span>
                        <span className="font-body text-sm text-foreground">{formatCurrency(displayProcessingFee)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cash / Check Block */}
                {(paymentMethod === "cash" || paymentMethod === "check" || codSubOption === "cash" || codSubOption === "check") && paymentMethod !== "stripe-link" && (
                  <div className="bg-background rounded-2xl border border-[#F59E0B]/30 shadow-lg shadow-foreground/5 overflow-hidden">
                    <div className="bg-[#F59E0B]/10 px-6 py-3 border-b border-[#F59E0B]/20">
                      <h3 className="font-display text-sm text-[#F59E0B] tracking-wider">PAYMENT DUE AT DELIVERY</h3>
                    </div>
                    <div className="p-6 space-y-2">
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Method</span>
                        <span className="font-display text-sm text-foreground capitalize">{codSubOption}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Amount Due</span>
                        <span className="font-display text-sm text-foreground">{formatCurrency(displayTotal)}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Due</span>
                        <span className="font-display text-sm text-foreground">At time of delivery</span>
                      </div>
                      <p className="font-body text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg p-3">Please have exact payment ready at delivery. Our driver will provide a receipt.</p>
                    </div>
                  </div>
                )}

                {/* Order Details */}
                <div className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden">
                  <div className="bg-foreground px-6 py-3">
                    <h3 className="font-display text-sm text-background tracking-wider">ORDER DETAILS</h3>
                  </div>
                  <div className="p-6 space-y-2">
                    {orderNumber && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Order Number</span>
                        <span className="font-display text-sm text-primary">{orderNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">Order Date</span>
                      <span className="font-body text-sm text-foreground">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">Product</span>
                      <span className="font-body text-sm text-foreground">River Sand — 9 Cubic Yard Load</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">Quantity</span>
                      <span className="font-body text-sm text-foreground">{quantity} load{quantity > 1 ? "s" : ""}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">Delivery Address</span>
                      <span className="font-body text-sm text-foreground text-right max-w-[60%]">{address}</span>
                    </div>
                    {selectedDeliveryDate && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Delivery Date</span>
                        <span className="font-display text-sm text-foreground">{selectedDeliveryDate.fullLabel}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">Delivery Window</span>
                      <span className="font-body text-sm text-foreground">8:00 AM – 5:00 PM</span>
                    </div>

                    {selectedDeliveryDate?.isSameDay && (
                      <div className="mt-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg p-3">
                        <p className="font-body text-xs text-[#F59E0B]">⚡ Same-day delivery requested. Our team will call {form.phone} to confirm before dispatching.</p>
                      </div>
                    )}
                    {selectedDeliveryDate?.isSaturday && (
                      <div className="mt-3 bg-muted/50 border border-border rounded-lg p-3">
                        <p className="font-body text-xs text-muted-foreground">📅 Saturday delivery — $35 surcharge applied.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="bg-background rounded-2xl border border-border/50 shadow-lg shadow-foreground/5 overflow-hidden">
                  <div className="bg-foreground px-6 py-3">
                    <h3 className="font-display text-sm text-background tracking-wider">PRICING SUMMARY</h3>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">River Sand (×{quantity})</span>
                      <span className="font-body text-sm text-foreground">{formatCurrency(effectivePricing.base_price * quantity)}</span>
                    </div>
                    {displayDistanceFee > 0 && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Distance fee</span>
                        <span className="font-body text-sm text-foreground">{formatCurrency(displayDistanceFee)}</span>
                      </div>
                    )}
                    {selectedDeliveryDate?.isSaturday && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Saturday surcharge</span>
                        <span className="font-body text-sm text-foreground">{formatCurrency(displaySaturdaySurcharge)}</span>
                      </div>
                    )}
                    {displayTaxAmount > 0 && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Sales tax — {displayTaxInfo.parish} ({(displayTaxInfo.rate * 100).toFixed(2)}%)</span>
                        <span className="font-body text-sm text-foreground">{formatCurrency(displayTaxAmount)}</span>
                      </div>
                    )}
                    {paymentMethod === "stripe-link" && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-sm text-muted-foreground">Processing fee (3.5%)</span>
                        <span className="font-body text-sm text-foreground">{formatCurrency(displayProcessingFee)}</span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between py-2">
                      <span className="font-display text-base text-foreground">Total</span>
                      <span className="font-display text-base text-primary">{formatCurrency(paymentMethod === "stripe-link" ? displayTotalWithFee : displayTotal)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-body text-sm text-muted-foreground">
                        {paymentMethod === "stripe-link" ? "Card charged" : "Due at delivery"}
                      </span>
                      <span className="font-display text-sm text-foreground">
                        {formatCurrency(paymentMethod === "stripe-link" ? displayTotalWithFee : displayTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center print-hide">
                  <Button onClick={handleDownloadInvoice} disabled={downloadingInvoice || !confirmedOrderId} variant="outline" className="font-display tracking-wider rounded-xl h-12">
                    {downloadingInvoice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    DOWNLOAD INVOICE
                  </Button>
                  <Button onClick={() => window.print()} variant="outline" className="font-display tracking-wider rounded-xl h-12">
                    <Printer className="w-4 h-4 mr-2" /> PRINT CONFIRMATION
                  </Button>
                  <Button asChild className="font-display tracking-wider rounded-xl h-12">
                    <Link to="/">BACK TO HOME</Link>
                  </Button>
                </div>
              </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </div>
    </div>
    <OutOfAreaModal
      open={showOutOfAreaModal}
      onClose={() => setShowOutOfAreaModal(false)}
      address={outOfAreaAddress}
      distanceMiles={outOfAreaDistance}
      nearestPit={nearestPitInfo}
    />
  </>
  );
};

export default Order;
