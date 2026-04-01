import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { updateSession, initSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2, User, Phone, Mail, FileText, CreditCard, ArrowLeft, Lock, Banknote, CalendarDays, Clock, ExternalLink, Minus, Plus, Package, ShieldCheck } from "lucide-react";
import OrderConfirmation from "@/components/OrderConfirmation";
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
import { type PitData, type GlobalPricing, findBestPitDriving, getEffectivePrice, parseGlobalSettings, FALLBACK_GLOBAL_PRICING } from "@/lib/pits";
import PlaceAutocompleteInput, { getPlaceInputValue, type PlaceSelectResult } from "@/components/PlaceAutocompleteInput";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google: any;
  }
}

import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useBrandPalette } from "@/hooks/useBrandPalette";

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
  useBrandPalette();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"address" | "details" | "confirm" | "success">("address");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState("");
  const { loaded: apiLoaded } = useGoogleMaps();
  const addressContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { initSession(); }, []);

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
  const [deliveryTermsAccepted, setDeliveryTermsAccepted] = useState(false);
  const [cardAuthAccepted, setCardAuthAccepted] = useState(false);

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

    // Normal same-tab return — state may be lost due to page reload
    if (paymentStatus === "success") {
      if (returnedOrderNumber) setOrderNumber(returnedOrderNumber);
      if (returnedSessionId) setStripePaymentId(returnedSessionId);

      // If we have in-memory state, use it
      if (totalPrice > 0 && address) {
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
      } else if (returnedOrderNumber) {
        // Page reloaded from Stripe redirect — fetch order from DB
        (async () => {
          try {
            const { data: order } = await supabase
              .from("orders")
              .select("*")
              .eq("order_number", returnedOrderNumber)
              .single();
            if (order) {
              setAddress(order.delivery_address || "");
              setForm(prev => ({
                ...prev,
                name: order.customer_name || prev.name,
                phone: order.customer_phone || prev.phone,
                email: order.customer_email || prev.email,
              }));
              setQuantity(order.quantity || 1);
              if (order.delivery_date) {
                const d = new Date(order.delivery_date + "T00:00:00");
                const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                const shortDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                setSelectedDeliveryDate({
                  date: d,
                  label: shortDays[d.getDay()],
                  dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  fullLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
                  iso: order.delivery_date,
                  dayOfWeek: order.delivery_day_of_week || dayNames[d.getDay()],
                  isSaturday: order.saturday_surcharge || false,
                  isSameDay: order.same_day_requested || false,
                });
              }
              setPaymentMethod((order.payment_method as PaymentMethodType) || "stripe-link");
              const orderTaxRate = order.tax_rate || 0;
              const orderTaxAmount = order.tax_amount || 0;
              const orderSatSurcharge = order.saturday_surcharge_amount || 0;
              const isStripe = order.payment_method === "stripe-link";
              // For Stripe orders, order.price includes the processing fee
              const orderProcessingFee = isStripe
                ? parseFloat((order.price / 1.035 * 0.035).toFixed(2))
                : 0;
              const orderTotalWithFee = order.price;
              const orderTotalWithoutFee = isStripe
                ? parseFloat((order.price - orderProcessingFee).toFixed(2))
                : order.price;
              const orderSubtotal = orderTotalWithoutFee - orderTaxAmount;
              setConfirmedTotals({
                totalPrice: orderTotalWithoutFee,
                totalWithProcessingFee: orderTotalWithFee,
                processingFee: orderProcessingFee,
                taxAmount: orderTaxAmount,
                subtotal: orderSubtotal,
                saturdaySurchargeTotal: orderSatSurcharge,
                distanceFee: 0,
                taxInfo: { rate: orderTaxRate, parish: "" },
              });
              if (order.distance_miles) {
                setResult({
                  distance: order.distance_miles,
                  price: orderTotalWithoutFee / (order.quantity || 1),
                  address: `${order.distance_miles.toFixed(1)} miles away`,
                  duration: "",
                });
              }
              setStep("success");
            }
          } catch (err) {
            console.error("[Order] Failed to fetch order for confirmation:", err);
            setStep("success"); // Still show success — payment went through
          }
        })();
      } else {
        setStep("success");
      }

      toast({
        title: "Payment successful",
        description: returnedOrderNumber
          ? `Order ${returnedOrderNumber} is confirmed.`
          : "Your payment was completed successfully.",
      });
      return;
    }

    if (paymentStatus === "canceled") {
      // If we still have in-memory state, just go back to confirm step
      if (totalPrice > 0 && address) {
        setStep("confirm");
      } else {
        // Page reloaded from Stripe redirect — restore from sessionStorage snapshot
        try {
          const raw = sessionStorage.getItem("pending_order_snapshot");
          if (raw) {
            const snap = JSON.parse(raw);
            setAddress(snap.address || "");
            setForm(snap.form || { name: "", phone: "", email: "", notes: "" });
            setQuantity(snap.quantity || 1);
            setPendingOrderId(snap.pendingOrderId || null);
            setOrderNumber(snap.orderNumber || null);
            setPaymentMethod(snap.paymentMethod || "stripe-link");
            if (snap.selectedDeliveryDate) {
              setSelectedDeliveryDate(snap.selectedDeliveryDate);
            }
            if (snap.result) {
              setResult(snap.result);
            }
            setStep("confirm");
          } else {
            setStep("address");
          }
        } catch {
          setStep("address");
        }
      }

      toast({
        title: "Payment canceled",
        description: "Your order details are saved. Try again when you're ready.",
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
          const snap = pricingSnapshotRef.current;
          if (signal.order_number) setOrderNumber(signal.order_number);
          if (signal.session_id) setStripePaymentId(signal.session_id);
          if (snap.pendingOrderId) setConfirmedOrderId(snap.pendingOrderId);
          setPendingOrderId(null);
          setAddress(snap.address);
          setSelectedDeliveryDate(snap.selectedDeliveryDate);
          setPaymentMethod(snap.paymentMethod);
          setForm(snap.form);
          setConfirmedTotals({
            totalPrice: snap.totalPrice,
            totalWithProcessingFee: snap.totalWithProcessingFee,
            processingFee: snap.processingFee,
            taxAmount: snap.taxAmount,
            subtotal: snap.subtotal,
            saturdaySurchargeTotal: snap.saturdaySurchargeTotal,
            distanceFee: snap.result ? Math.max(0, (snap.result.distance - snap.effectivePricing.free_miles) * snap.effectivePricing.extra_per_mile * snap.quantity) : 0,
            taxInfo: snap.taxInfo,
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

  // Keep refs to avoid stale closures in Stripe signal listener
  const sendOrderEmailRef = useRef(sendOrderEmail);
  useEffect(() => { sendOrderEmailRef.current = sendOrderEmail; }, [sendOrderEmail]);

  // Snapshot of current pricing state for cross-tab handler
  const pricingSnapshotRef = useRef({
    totalPrice, totalWithProcessingFee, processingFee, taxAmount, subtotal,
    saturdaySurchargeTotal, taxInfo, result, effectivePricing, quantity,
    address, selectedDeliveryDate, form, paymentMethod, pendingOrderId,
  });
  useEffect(() => {
    pricingSnapshotRef.current = {
      totalPrice, totalWithProcessingFee, processingFee, taxAmount, subtotal,
      saturdaySurchargeTotal, taxInfo, result, effectivePricing, quantity,
      address, selectedDeliveryDate, form, paymentMethod, pendingOrderId,
    };
  });

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


  const handleOrderPlaceSelect = useCallback((result: PlaceSelectResult) => {
    setAddress(result.formattedAddress);
    setCustomerCoords({ lat: result.lat, lng: result.lng });
    if (result.addressComponents) {
      const parish = getParishFromPlaceResult(result.addressComponents);
      setDetectedParish(parish);
    }
  }, []);

  const calculateDistance = useCallback(async () => {
    console.log("[calculateDistance] starting, address:", address);
    console.log("[calculateDistance] customerCoords:", customerCoords);
    const currentAddress = address.trim() || getPlaceInputValue(addressContainerRef.current);
    if (!currentAddress) { setError("Please enter a delivery address."); return; }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      let custLat = customerCoords?.lat;
      let custLng = customerCoords?.lng;

      // Fallback geocode if coords not captured from Places
      if (custLat == null || custLng == null) {
        if (!window.google?.maps?.Geocoder) {
          setError("Maps not loaded yet. Please wait a moment and try again.");
          setLoading(false); return;
        }
        const geocoder = new window.google.maps.Geocoder();
        const geocodeResult = await geocoder.geocode({ address });
        if (geocodeResult.results?.[0]?.geometry?.location) {
          custLat = geocodeResult.results[0].geometry.location.lat();
          custLng = geocodeResult.results[0].geometry.location.lng();
        } else {
          setError("Could not locate that address. Please try again.");
          setLoading(false); return;
        }
      }

      console.log("[calculateDistance] coords:", custLat, custLng);

      if (allPits.length === 0) {
        setError("No delivery locations configured. Please call us for pricing.");
        setLoading(false); return;
      }

      console.log("[calculateDistance] calling findBestPitDriving, pits:", allPits.length);
      const bestResult = await findBestPitDriving(allPits, custLat!, custLng!, globalPricing, supabase);
      console.log("[calculateDistance] bestResult:", bestResult);

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
      trackEvent("begin_checkout", {
        value: bestResult.price,
        currency: "USD",
        items: [{ item_name: "River Sand 9 cu/yd", item_id: "river-sand-9yd", price: bestResult.price, quantity }],
      });
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
    trackEvent("add_payment_info", {
      value: totalPrice,
      currency: "USD",
      payment_type: paymentMethod,
    });
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
    delivery_terms_accepted: deliveryTermsAccepted,
    delivery_terms_timestamp: new Date().toISOString(),
    card_authorization_accepted: cardAuthAccepted,
    card_authorization_timestamp: cardAuthAccepted ? new Date().toISOString() : null,
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
      trackEvent("purchase", {
        transaction_id: inserted?.order_number || "",
        value: totalPrice,
        currency: "USD",
        tax: taxAmount,
        items: [{ item_name: "River Sand 9 cu/yd", item_id: "river-sand-9yd", price: result?.price || 0, quantity }],
      });
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

      // Save order state to sessionStorage so it can be restored if Stripe is canceled
      try {
        sessionStorage.setItem("pending_order_snapshot", JSON.stringify({
          address,
          form,
          quantity,
          selectedDeliveryDate,
          paymentMethod: "stripe-link",
          pendingOrderId: insertedOrder?.id || null,
          orderNumber: insertedOrder?.order_number || null,
          result,
          totalPrice,
          totalWithProcessingFee,
          processingFee,
          taxAmount,
          subtotal,
          saturdaySurchargeTotal,
          taxInfo,
        }));
      } catch {}

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
  const ReceiptRow = ({ label, value, accent, destructive, bold, small }: { label: string; value: string; accent?: boolean; destructive?: boolean; bold?: boolean; small?: boolean }) => (
    <div className="flex justify-between items-center py-2.5">
      <span className={`font-body ${small ? "text-xs" : "text-sm"} ${destructive ? "text-destructive" : small ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{label}</span>
      <span className={`${bold ? "font-display text-base" : small ? "font-body text-xs text-muted-foreground/70" : "font-display text-sm"} ${destructive ? "text-destructive" : accent ? "text-primary" : bold ? "text-primary" : "text-foreground"}`}>{value}</span>
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
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md py-3 border-b border-border/30 -mx-4 px-4 mb-6 shadow-sm">
          <CountdownBar />
          {/* Progress steps */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center justify-center gap-1 sm:gap-3 mb-2"
          >
            {stepLabels.map((label, i) => {
              const stepIndex = ["address", "details", "confirm"].indexOf(step === "success" ? "confirm" : step);
              const isActive = i <= stepIndex;
              const isCurrent = i === stepIndex;
              const isCompleted = i < stepIndex;
              return (
                <div key={label} className="flex items-center gap-1 sm:gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <motion.div
                      animate={{
                        scale: isCurrent ? 1.15 : 1,
                        boxShadow: isCurrent ? "0 4px 14px hsl(var(--accent) / 0.35)" : "none",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-xs transition-all duration-300 ${
                        isCompleted ? "bg-primary text-primary-foreground"
                        : isCurrent ? "bg-accent text-accent-foreground ring-2 ring-accent/30 ring-offset-2 ring-offset-background" 
                        : "bg-muted text-muted-foreground/40 border border-border"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </motion.div>
                    <span className={`font-body text-[10px] sm:text-xs transition-colors duration-300 whitespace-nowrap ${
                      isCurrent ? "text-foreground font-semibold" : isActive ? "text-foreground/60" : "text-muted-foreground/40"
                    }`}>{label}</span>
                  </div>
                  {i < 2 && (
                    <div className="relative w-8 sm:w-12 h-0.5 mt-[-12px] sm:mt-[-14px]">
                      <div className="absolute inset-0 bg-border rounded-full" />
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-accent rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: isActive && i < stepIndex ? "100%" : "0%" }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      />
                    </div>
                  )}
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
                  <label htmlFor="order-address" className="font-display text-lg text-foreground tracking-wider flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" /> DELIVERY ADDRESS
                  </label>
                  <div ref={addressContainerRef}>
                    {apiLoaded ? (
                      <PlaceAutocompleteInput
                        onPlaceSelect={handleOrderPlaceSelect}
                        onInputChange={(val) => setAddress(val)}
                        onEnterKey={calculateDistance}
                        placeholder="Enter your delivery address..."
                        initialValue={address || undefined}
                        id="order-address"
                        containerClassName="place-autocomplete-order"
                      />
                    ) : (
                      <div className="h-14 rounded-xl border border-input bg-background animate-pulse" />
                    )}
                  </div>
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
                    { icon: Truck, top: "LOCAL AREA", bot: "Delivery included" },
                    { icon: MapPin, top: "EXTENDED", bot: "Surcharge applies" },
                    { icon: Package, top: "9 CU YDS", bot: "Per load" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.top}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="p-3 bg-muted/50 border border-border/50 rounded-xl"
                    >
                      <item.icon className="w-5 h-5 text-primary" />
                      <p className="font-display text-sm text-primary mt-1">{item.top}</p>
                      <p className="font-body text-[10px] text-muted-foreground">{item.bot}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Trust strip */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-4 flex items-center justify-center gap-4 text-muted-foreground"
                >
                  <span className="flex items-center gap-1 text-[10px] font-body"><Lock className="w-3 h-3" /> Secure</span>
                  <span className="w-px h-3 bg-border" />
                  <span className="flex items-center gap-1 text-[10px] font-body"><ShieldCheck className="w-3 h-3" /> No Account Needed</span>
                  <span className="w-px h-3 bg-border" />
                  <span className="flex items-center gap-1 text-[10px] font-body"><CheckCircle2 className="w-3 h-3" /> Instant Pricing</span>
                </motion.div>

                <Link to="/" className="block mt-4">
                  <Button variant="ghost" className="w-full font-display tracking-wider text-muted-foreground hover:text-foreground">
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
                  className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-display text-sm tracking-wider text-primary block">DELIVERY CONFIRMED</span>
                      <span className="font-body text-xs text-muted-foreground">{address.length > 45 ? address.slice(0, 42) + "…" : address}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-2xl text-primary">{formatCurrency(result.price)}</span>
                    <span className="text-[10px] font-body text-muted-foreground block">/load</span>
                  </div>
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
                        <label htmlFor="order-name" className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Full Name *</label>
                        <Input id="order-name" name="name" autoComplete="name" placeholder="John Smith" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg" />
                      </div>
                      <div>
                        <label htmlFor="order-phone" className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Phone *</label>
                        <Input id="order-phone" name="phone" type="tel" autoComplete="tel" placeholder="(504) 555-0123" required maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="h-11 rounded-lg" />
                      </div>
                      <div>
                        <label htmlFor="order-email" className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Email *</label>
                        <EmailInput id="order-email" name="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required className="h-11 rounded-lg" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="order-notes" className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Delivery Notes (optional)</label>
                        <Textarea id="order-notes" name="notes" placeholder="Gate code, placement instructions..." maxLength={1000} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg" />
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
                          Same-day request — our team will call to confirm availability.
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
                        className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                          paymentMethod === "stripe-link"
                            ? "border-accent bg-accent/5 shadow-lg shadow-accent/15"
                            : "border-border bg-card hover:border-accent/40 hover:shadow-md"
                        }`}
                      >
                        {paymentMethod === "stripe-link" && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-accent-foreground" />
                          </motion.div>
                        )}
                        <CreditCard className={`w-6 h-6 mb-2 ${paymentMethod === "stripe-link" ? "text-accent" : "text-muted-foreground"}`} />
                        <p className="font-display text-sm text-foreground tracking-wider">PAY NOW</p>
                        <p className="font-body text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Secure Stripe Checkout
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                          paymentMethod === "cash" || paymentMethod === "check"
                            ? "border-accent bg-accent/5 shadow-lg shadow-accent/15"
                            : "border-border bg-card hover:border-accent/40 hover:shadow-md"
                        }`}
                      >
                        {(paymentMethod === "cash" || paymentMethod === "check") && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-accent-foreground" />
                          </motion.div>
                        )}
                        <Banknote className={`w-6 h-6 mb-2 ${paymentMethod === "cash" || paymentMethod === "check" ? "text-accent" : "text-muted-foreground"}`} />
                        <p className="font-display text-sm text-foreground tracking-wider">AT DELIVERY</p>
                        <p className="font-body text-[10px] text-muted-foreground mt-1">Cash or Check — no fee</p>
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
                    <div className="px-6 pb-6 space-y-3">
                      <Button
                        onClick={goToStep2}
                        disabled={!isFormValid}
                        className="w-full h-14 font-display tracking-wider text-lg rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-300"
                      >
                        <ShieldCheck className="w-5 h-5 mr-2" /> REVIEW ORDER
                      </Button>
                      {!isFormValid && (
                        <p className="font-body text-xs text-destructive text-center">
                          {!selectedDeliveryDate ? "Please select a delivery date above." : "Please fill in all required fields above."}
                        </p>
                      )}
                      <p className="font-body text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Your information is secure and never shared
                      </p>
                    </div>
                  )}
                </motion.div>

                <button onClick={() => setStep("address")} className="flex items-center gap-1 mx-auto text-xs font-body text-muted-foreground hover:text-foreground transition-colors py-2">
                  <ArrowLeft className="w-3 h-3" /> Change delivery address
                </button>
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
                  {/* Secure header */}
                  <div className="bg-primary px-6 py-3 flex items-center justify-between">
                    <h2 className="font-display text-sm text-primary-foreground tracking-wider">ORDER REVIEW</h2>
                    <span className="flex items-center gap-1 text-primary-foreground/70 text-[10px] font-body"><Lock className="w-2.5 h-2.5" /> Secure Checkout</span>
                  </div>

                  <div className="p-6 space-y-4">

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
                          Same-day request — we'll call to confirm availability.
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

                {/* Delivery Terms — required for ALL orders */}
                <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
                  <p className="font-display text-xs tracking-wider text-foreground">DELIVERY TERMS</p>
                  <div className="space-y-1.5">
                    <p className="font-body text-xs text-muted-foreground">• Delivery is curbside only — between the curb and nearest sidewalk or driveway edge</p>
                    <p className="font-body text-xs text-muted-foreground">• Driver will not enter private property under any circumstances</p>
                    <p className="font-body text-xs text-muted-foreground">• Customer must ensure a clear and accessible delivery area before arrival</p>
                    <p className="font-body text-xs text-muted-foreground">• Ways Materials LLC is not responsible for damage to driveways, landscaping, vehicles, or any private property</p>
                    <p className="font-body text-xs text-muted-foreground">• Customer or designated representative must be present at time of delivery</p>
                    <p className="font-body text-xs text-muted-foreground">• Same-day orders are subject to availability confirmation by our dispatch team</p>
                    <p className="font-body text-xs text-muted-foreground">• Cancellation Policy — Orders canceled more than 2 hours before scheduled delivery will be refunded in full. Processing fees are non-refundable.</p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryTermsAccepted}
                      onChange={(e) => setDeliveryTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-primary"
                    />
                    <span className="font-body text-xs text-foreground leading-relaxed">
                      I have read and agree to the delivery terms and cancellation policy.
                      I understand that processing fees are non-refundable.
                    </span>
                  </label>
                </div>

                {/* Card Authorization — only for COD orders */}
                {(paymentMethod === "cash" || paymentMethod === "check" ||
                  codSubOption === "cash" || codSubOption === "check") && paymentMethod !== "stripe-link" && (
                  <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
                    <p className="font-display text-xs tracking-wider text-foreground">
                      CARD AUTHORIZATION FOR UNPAID DELIVERIES
                    </p>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed">
                      In the event that cash or check payment is not collected at the
                      time of delivery, you authorize Ways Materials LLC to charge the
                      payment card associated with this order.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cardAuthAccepted}
                        onChange={(e) => setCardAuthAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-primary"
                      />
                      <span className="font-body text-xs text-foreground leading-relaxed">
                        I authorize Ways Materials LLC to charge the payment card
                        associated with this order in the amount of{" "}
                        <strong>${totalPrice.toFixed(2)}</strong> if cash or check
                        payment is not collected at the time of delivery. I understand
                        this charge will appear as 'RIVERSAND.NET' on my statement.
                        This authorization is valid for this order only.
                      </span>
                    </label>
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setDisclaimerAccepted(false); setDeliveryTermsAccepted(false); setCardAuthAccepted(false); setStep("details"); }} className="h-14 font-display tracking-wider rounded-xl text-sm px-5">
                      <ArrowLeft className="w-4 h-4 mr-1" /> BACK
                    </Button>
                    <Button
                      onClick={paymentMethod === "stripe-link" ? handleStripeLink : handleCodSubmit}
                      disabled={
                        submitting || !deliveryTermsAccepted ||
                        (paymentMethod !== "stripe-link" && (codSubOption === "cash" || codSubOption === "check") && !cardAuthAccepted)
                      }
                      className="flex-1 h-14 font-display tracking-wider text-base bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-300 disabled:opacity-40"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        paymentMethod === "stripe-link"
                          ? <><Lock className="w-4 h-4 mr-2" /> PAY {formatCurrency(totalWithProcessingFee)}</>
                          : <><CheckCircle2 className="w-4 h-4 mr-2" /> PLACE ORDER — {formatCurrency(totalPrice)}</>
                      )}
                    </Button>
                  </div>
                  <p className="font-body text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> 256-bit SSL encryption • Your data is protected
                  </p>
                </div>
              </motion.div>
            )}

            {/* SUCCESS — Full Confirmation Page */}
            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <OrderConfirmation
                  orderNumber={orderNumber}
                  address={address}
                  deliveryDateLabel={selectedDeliveryDate?.fullLabel || "—"}
                  quantity={quantity}
                  paymentMethod={paymentMethod}
                  codSubOption={codSubOption}
                  stripePaymentId={stripePaymentId}
                  customerName={form.name}
                  customerEmail={form.email}
                  customerPhone={form.phone}
                  confirmedTotals={confirmedTotals}
                  totalPrice={totalPrice}
                  totalWithProcessingFee={totalWithProcessingFee}
                  processingFee={processingFee}
                  taxAmount={taxAmount}
                  saturdaySurchargeTotal={saturdaySurchargeTotal}
                  taxInfo={taxInfo}
                  basePricePerLoad={effectivePricing.base_price}
                  distanceFee={result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0}
                  onPrint={handleDownloadInvoice}
                  onDownloadInvoice={handleDownloadInvoice}
                  downloadingInvoice={downloadingInvoice}
                  canDownload={!!confirmedOrderId}
                />
              </motion.div>
            )}
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
