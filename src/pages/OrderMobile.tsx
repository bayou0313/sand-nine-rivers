/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { updateSession, initSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Loader2, Phone, ArrowLeft, Lock, Banknote, CreditCard, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { formatPhone, formatCurrency, getTaxRateFromAddress, getParishFromPlaceResult, getTaxRateByParish, LA_STATE_TAX_RATE } from "@/lib/format";
import EmailInput from "@/components/EmailInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { loadCart, clearCart } from "@/lib/cart";
import DeliveryDatePicker, {
  type DeliveryDate,
  type PitSchedule,
  SATURDAY_SURCHARGE,
  getEffectiveSaturdaySurcharge,
  getEffectiveSundaySurcharge,
  type PitDistanceEntry,
} from "@/components/DeliveryDatePicker";
import {
  type PitData,
  type GlobalPricing,
  type FindBestPitResult,
  findBestPitDriving,
  findAllPitDistances,
  getEffectivePrice,
  getCODPrice,
  parseGlobalSettings,
  FALLBACK_GLOBAL_PRICING,
} from "@/lib/pits";
import PlaceAutocompleteInput, { getPlaceInputValue, type PlaceSelectResult } from "@/components/PlaceAutocompleteInput";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useBrandPalette } from "@/hooks/useBrandPalette";

declare global {
  interface Window { google: any; }
}

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
  duration: string;
};

type PaymentMethodType = "stripe-link" | "cash" | "check" | null;

const LOGO_WHITE = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";

/* ── Animated Checkmark ── */
const AnimatedCheckmark = () => (
  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}>
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <motion.circle cx="40" cy="40" r="36" stroke="var(--accent)" strokeWidth="3" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }} />
      <motion.path d="M24 42 L35 53 L56 28" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.9, ease: "easeOut" }} />
    </svg>
  </motion.div>
);

/* ────────────────────── COMPONENT ────────────────────── */
const OrderMobile = () => {
  useBrandPalette();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const stripeReturnHandled = useRef(false);
  const { loaded: apiLoaded } = useGoogleMaps();
  const addressContainerRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // Step state: address → price → info → success
  const [step, setStep] = useState<"address" | "price" | "info" | "success">("address");

  // Core state
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EstimateResult | null>(null);

  // Pricing
  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL_PRICING);
  const [allPits, setAllPits] = useState<PitData[]>([]);
  const [matchedPit, setMatchedPit] = useState<PitData | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pricingMode, setPricingMode] = useState<"transparent" | "baked">("transparent");
  const [allPitDistances, setAllPitDistances] = useState<FindBestPitResult[]>([]);
  const [weekdayPit, setWeekdayPit] = useState<PitData | null>(null);
  const [weekdayResult, setWeekdayResult] = useState<EstimateResult | null>(null);
  const [weekdayPitSchedule, setWeekdayPitSchedule] = useState<PitSchedule | null>(null);
  const [matchedPitSchedule, setMatchedPitSchedule] = useState<PitSchedule | null>(null);
  const [globalSaturdaySurcharge, setGlobalSaturdaySurcharge] = useState<number>(SATURDAY_SURCHARGE);

  // Form
  const [form, setForm] = useState({ name: "", companyName: "", phone: "", email: "", notes: "" });
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<DeliveryDate | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(null);
  const [codSubOption, setCodSubOption] = useState<"cash" | "check">("cash");

  const qtyParam = parseInt(searchParams.get("quantity") || searchParams.get("qty") || "1", 10);
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(10, isNaN(qtyParam) ? 1 : qtyParam)));
  const [leadReference, setLeadReference] = useState<string | null>(null);

  // Order result
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [lookupToken, setLookupToken] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [stripePaymentId, setStripePaymentId] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [confirmedTotals, setConfirmedTotals] = useState<{
    basePrice: number;
    distanceFee: number;
    processingFee: number;
    saturdaySurcharge: number;
    sundaySurcharge: number;
    tax: number;
    total: number;
    pricingMode: string;
  } | null>(null);
  const [deliveryTermsAccepted, setDeliveryTermsAccepted] = useState(false);
  const [detectedParish, setDetectedParish] = useState<string | null>(null);
  const [showCompany, setShowCompany] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [gmbReviewUrl, setGmbReviewUrl] = useState<string | null>(null);

  // Derived pricing
  const effectivePricing = useMemo(() => {
    if (matchedPit) return getEffectivePrice(matchedPit, globalPricing);
    return { base_price: globalPricing.base_price, free_miles: globalPricing.free_miles, extra_per_mile: globalPricing.extra_per_mile, max_distance: globalPricing.max_distance, saturday_surcharge: globalPricing.saturday_surcharge };
  }, [matchedPit, globalPricing]);

  const taxInfo = useMemo(() => {
    if (detectedParish) return getTaxRateByParish(detectedParish);
    return getTaxRateFromAddress(address);
  }, [address, detectedParish]);

  const PROCESSING_FEE_RATE = globalPricing.card_processing_fee_percent / 100;
  const PROCESSING_FEE_FIXED = globalPricing.card_processing_fee_fixed;
  const effectiveSatSurcharge = getEffectiveSaturdaySurcharge(matchedPitSchedule, globalSaturdaySurcharge);
  const effectiveSunSurcharge = getEffectiveSundaySurcharge(matchedPitSchedule);
  const saturdaySurchargeTotal = selectedDeliveryDate?.isSaturday ? effectiveSatSurcharge * quantity : 0;
  const sundaySurchargeTotal = selectedDeliveryDate?.isSunday ? effectiveSunSurcharge * quantity : 0;
  const isBaked = pricingMode === "baked";
  const isCOD = paymentMethod === "cash" || paymentMethod === "check";
  const effectiveBaseForCalc = isBaked && isCOD && effectivePricing.base_price ? getCODPrice(effectivePricing.base_price) : effectivePricing.base_price;
  const subtotal = result ? (result.price * quantity) + saturdaySurchargeTotal + sundaySurchargeTotal : 0;
  const codSubtotalAdjustment = isBaked && isCOD && result ? (effectivePricing.base_price - effectiveBaseForCalc) * quantity : 0;
  const adjustedSubtotal = subtotal - codSubtotalAdjustment;
  const taxAmount = parseFloat((adjustedSubtotal * taxInfo.rate).toFixed(2));
  const totalPrice = parseFloat((adjustedSubtotal + taxAmount).toFixed(2));
  const processingFee = !isBaked && totalPrice > 0 ? parseFloat((totalPrice * PROCESSING_FEE_RATE + PROCESSING_FEE_FIXED).toFixed(2)) : 0;
  const totalWithProcessingFee = parseFloat((totalPrice + processingFee).toFixed(2));
  const isWeekendDate = selectedDeliveryDate?.isSaturday || selectedDeliveryDate?.isSunday;

  // Auto-switch to card on weekend
  useEffect(() => {
    if (isWeekendDate && paymentMethod !== "stripe-link") setPaymentMethod("stripe-link");
  }, [isWeekendDate]);

  // Scroll to top on step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  // Init
  useEffect(() => { initSession(); }, []);

  // Fetch GMB review URL
  useEffect(() => {
    supabase.from("global_settings").select("value").eq("key", "gmb_review_url").maybeSingle()
      .then(({ data }) => { if (data?.value) setGmbReviewUrl(data.value); });
  }, []);

  // Fetch settings + pits
  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, pitsRes] = await Promise.all([
        supabase.from("global_settings").select("key, value"),
        supabase.from("pits").select("id, name, address, lat, lon, status, base_price, free_miles, price_per_extra_mile, max_distance, operating_days, saturday_surcharge_override, same_day_cutoff, sunday_surcharge").eq("status", "active"),
      ]);
      if (settingsRes.data) {
        const gp = parseGlobalSettings(settingsRes.data as any);
        setGlobalPricing(gp);
        setGlobalSaturdaySurcharge(gp.saturday_surcharge);
        const modeRow = (settingsRes.data as any[]).find((r: any) => r.key === "pricing_mode");
        if (modeRow?.value === "baked") setPricingMode("baked");
      }
      if (pitsRes.data) setAllPits(pitsRes.data as any);
    };
    fetchData();
  }, []);

  // Helper: populate confirmedTotals from a DB order record
  const populateConfirmedTotals = useCallback((orderData: any) => {
    if (!orderData) return;
    const mode = pricingMode;
    const isBkd = mode === "baked";
    setConfirmedTotals({
      basePrice: Number(orderData.base_unit_price ?? 0),
      distanceFee: Number(orderData.distance_fee ?? 0),
      processingFee: isBkd ? 0 : Number(orderData.processing_fee ?? 0),
      saturdaySurcharge: Number(orderData.saturday_surcharge_amount ?? 0),
      sundaySurcharge: Number(orderData.sunday_surcharge_amount ?? 0),
      tax: Number(orderData.tax_amount ?? 0),
      total: Number(orderData.price ?? 0),
      pricingMode: mode,
    });
  }, [pricingMode]);


  const verifyStripePayment = useCallback(async (orderId: string, token: string): Promise<any | null> => {
    const MAX_ATTEMPTS = 8;
    const POLL_INTERVAL = 2500;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("get-order-status", { body: { order_id: orderId, lookup_token: token } });
        if (!error && data?.payment_status === "paid") return data;
      } catch {}
      if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
    return null;
  }, []);

  // Send email helper
  const sendOrderEmail = useCallback((orderNum: string | null, pMethod: string, pStatus: string, sPaymentId: string | null) => {
    if (!result) return;
    supabase.functions.invoke("send-email", {
      body: {
        type: "order_confirmation",
        data: {
          order_number: orderNum,
          customer_name: form.name.trim(),
          customer_email: form.email.trim() || null,
          customer_phone: form.phone.trim(),
          delivery_address: address,
          delivery_date: selectedDeliveryDate?.iso || null,
          delivery_day_of_week: selectedDeliveryDate?.dayOfWeek || null,
          delivery_window: "8:00 AM – 5:00 PM",
          quantity,
          price: pMethod === "stripe-link" ? totalWithProcessingFee : totalPrice,
          distance_miles: result.distance,
          saturday_surcharge: selectedDeliveryDate?.isSaturday || false,
          saturday_surcharge_amount: saturdaySurchargeTotal,
          same_day_requested: selectedDeliveryDate?.isSameDay || false,
          tax_rate: taxInfo.rate,
          tax_amount: taxAmount,
          tax_parish: taxInfo.parish,
          payment_method: pMethod,
          payment_status: pStatus,
          stripe_payment_id: sPaymentId,
          notes: form.notes.trim() || null,
        },
      },
    }).catch(() => {});
  }, [result, form, address, selectedDeliveryDate, quantity, totalPrice, totalWithProcessingFee, saturdaySurchargeTotal, taxInfo, taxAmount]);

  const sendOrderEmailRef = useRef(sendOrderEmail);
  useEffect(() => { sendOrderEmailRef.current = sendOrderEmail; }, [sendOrderEmail]);

  // Read URL params
  useEffect(() => {
    const paramAddress = searchParams.get("address") || sessionStorage.getItem("mobile_prefill_address");
    const paramDistance = searchParams.get("distance");
    const paramPrice = searchParams.get("price");
    const paramPitId = searchParams.get("pit_id");
    const paramPitName = searchParams.get("pit_name");
    const paramOpDays = searchParams.get("operating_days");
    const paramSatSurcharge = searchParams.get("sat_surcharge");
    const paramSameDayCutoff = searchParams.get("same_day_cutoff");
    const paramLead = searchParams.get("lead");

    if (paramLead) setLeadReference(paramLead);

    if (paramAddress && paramDistance && paramPrice) {
      setAddress(paramAddress);
      setResult({
        distance: parseFloat(paramDistance),
        price: parseFloat(paramPrice),
        address: `${paramDistance} mi away`,
        duration: "~30 min",
      });
      if (paramPitId) {
        setMatchedPitSchedule({
          operating_days: paramOpDays ? paramOpDays.split(",").map(Number) : null,
          saturday_surcharge_override: paramSatSurcharge != null ? Number(paramSatSurcharge) : null,
          sunday_surcharge: null,
          same_day_cutoff: paramSameDayCutoff || null,
        });
      }
      if (paramPitId && allPits.length > 0) {
        const pit = allPits.find(p => p.id === paramPitId);
        if (pit) setMatchedPit(pit);
      } else if (paramPitId && paramPitName) {
        setMatchedPit({
          id: paramPitId, name: decodeURIComponent(paramPitName), lat: 0, lon: 0, status: "active",
          base_price: null, free_miles: null, price_per_extra_mile: null, max_distance: null,
          operating_days: paramOpDays ? paramOpDays.split(",").map(Number) : null,
          saturday_surcharge_override: paramSatSurcharge != null ? Number(paramSatSurcharge) : null,
          same_day_cutoff: paramSameDayCutoff || null, sunday_surcharge: null,
        } as PitData);
      }
      setStep("price");
    } else if (!searchParams.get("payment")) {
      const savedCart = loadCart();
      if (savedCart) {
        setAddress(savedCart.address);
        setResult({ distance: savedCart.distance, price: savedCart.price, address: `${savedCart.distance} miles away`, duration: "~30 min" });
        setQuantity(savedCart.quantity);
        if (savedCart.operatingDays.length > 0 || savedCart.satSurcharge) {
          setMatchedPitSchedule({
            operating_days: savedCart.operatingDays.length > 0 ? savedCart.operatingDays : null,
            saturday_surcharge_override: savedCart.satSurcharge || null,
            sunday_surcharge: null,
            same_day_cutoff: savedCart.sameDayCutoff || null,
          });
        }
        if (savedCart.pitId) {
          setMatchedPit({
            id: savedCart.pitId, name: savedCart.pitName, address: "", lat: 0, lon: 0, status: "active",
            base_price: null, free_miles: null, price_per_extra_mile: null, max_distance: null,
            operating_days: savedCart.operatingDays.length > 0 ? savedCart.operatingDays : null,
            saturday_surcharge_override: savedCart.satSurcharge || null,
            same_day_cutoff: savedCart.sameDayCutoff || null, sunday_surcharge: null,
          } as PitData);
        }
        setStep("price");
      }
    }
  }, [searchParams]);

  // Resolve pit distances from URL params
  const pitDistancesResolvedRef = useRef(false);
  useEffect(() => {
    if (pitDistancesResolvedRef.current || allPits.length === 0 || !address || !result || !matchedPit || allPitDistances.length > 0) return;
    pitDistancesResolvedRef.current = true;
    setWeekdayPit(matchedPit);
    setWeekdayResult(result);
    setWeekdayPitSchedule(matchedPitSchedule);
    findAllPitDistances(allPits, address, globalPricing, supabase).then(d => setAllPitDistances(d)).catch(() => {});
  }, [allPits, address, result, matchedPit, allPitDistances]);

  // Handle Stripe return
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (!paymentStatus) return;
    if (stripeReturnHandled.current) return;
    stripeReturnHandled.current = true;

    const returnedOrderNumber = searchParams.get("order_number");
    const returnedSessionId = searchParams.get("session_id");
    const returnedOrderId = searchParams.get("order_id");
    const returnMode = searchParams.get("return_mode");

    if (returnMode === "popup") {
      localStorage.setItem("stripe_payment_signal", JSON.stringify({
        type: "stripe-payment-result", status: paymentStatus,
        order_number: returnedOrderNumber || "", order_id: returnedOrderId || "",
        session_id: returnedSessionId || "", timestamp: Date.now(),
      }));
      window.close();
      return;
    }

    if (paymentStatus === "success") {
      if (returnedOrderNumber) setOrderNumber(returnedOrderNumber);
      if (returnedSessionId) setStripePaymentId(returnedSessionId.slice(-12));

      let verifyOrderId = returnedOrderId || pendingOrderId || null;
      let verifyToken = lookupToken || null;
      if (!verifyToken || !verifyOrderId) {
        try {
          const snap = JSON.parse(sessionStorage.getItem("pending_order_snapshot") || "{}");
          if (!verifyOrderId) verifyOrderId = snap.pendingOrderId || null;
          if (!verifyToken) verifyToken = snap.lookupToken || null;
        } catch {}
      }
      if (verifyToken) setLookupToken(verifyToken);
      if (verifyOrderId) setConfirmedOrderId(verifyOrderId);

      setVerifyingPayment(true);
      setStep("success");
      clearCart();
      setSearchParams({}, { replace: true });

      if (verifyOrderId && verifyToken) {
        verifyStripePayment(verifyOrderId, verifyToken).then(orderData => {
          setVerifyingPayment(false);
          if (orderData) {
              populateConfirmedTotals(orderData);
              setConfirmedOrderId(orderData.id || verifyOrderId);
              setOrderNumber(orderData.order_number || returnedOrderNumber);
            if (orderData.delivery_date) {
              const d = new Date(orderData.delivery_date + "T12:00:00");
              const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
              setSelectedDeliveryDate({
                date: d, label: d.toLocaleDateString("en-US", { weekday: "short" }),
                dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                fullLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
                isSameDay: false, isSaturday: d.getDay() === 6, isSunday: d.getDay() === 0,
                iso: orderData.delivery_date, dayOfWeek: dayNames[d.getDay()],
              });
            }
            setAddress(orderData.delivery_address || address);
            setForm(prev => ({
              ...prev,
              name: orderData.customer_name || prev.name,
              phone: orderData.customer_phone || prev.phone,
              email: orderData.customer_email || prev.email,
            }));
          }
          toast({ title: "Payment successful", description: `Order ${returnedOrderNumber || orderNumber || ""} confirmed.` });
        });
      } else {
        setVerifyingPayment(false);
        toast({ title: "Payment successful", description: "Your order is confirmed." });
      }
    } else if (paymentStatus === "canceled") {
      try {
        const snap = JSON.parse(sessionStorage.getItem("pending_order_snapshot") || "{}");
        if (snap.address) {
          setAddress(snap.address);
          setForm(snap.form || form);
          setQuantity(snap.quantity || 1);
          if (snap.result) setResult(snap.result);
          if (snap.selectedDeliveryDate) setSelectedDeliveryDate(snap.selectedDeliveryDate);
          setStep("info");
        } else {
          setStep("address");
        }
      } catch {
        setStep("address");
      }
      toast({ title: "Payment canceled", description: "No charge was made. Try again when ready.", variant: "destructive" });
    }
  }, [searchParams, toast, verifyStripePayment]);

  // Listen for cross-tab Stripe signals
  useEffect(() => {
    if (stripeReturnHandled.current) return;
    const isSuccessStep = step === "success";

    const processSignal = (raw: string) => {
      if (isSuccessStep) return;
      try {
        const signal = JSON.parse(raw);
        if (signal.type !== "stripe-payment-result") return;
        localStorage.removeItem("stripe_payment_signal");
        setSubmitting(false);
        if (signal.status === "success") {
          if (signal.order_number) setOrderNumber(signal.order_number);
          if (signal.session_id) setStripePaymentId(signal.session_id.slice(-12));
          setVerifyingPayment(true);
          setStep("success");
          clearCart();
          const verifyOrderId = pendingOrderId || signal.order_id || null;
          const verifyTk = lookupToken || null;
          if (verifyOrderId) setConfirmedOrderId(verifyOrderId);
          if (verifyOrderId && verifyTk) {
            verifyStripePayment(verifyOrderId, verifyTk).then(() => {
              setVerifyingPayment(false);
              toast({ title: "Payment successful", description: `Order ${signal.order_number || ""} confirmed.` });
            });
          } else {
            setVerifyingPayment(false);
            sendOrderEmailRef.current(signal.order_number || null, "stripe-link", "paid", signal.session_id || null);
            toast({ title: "Payment successful" });
          }
        } else if (signal.status === "canceled") {
          setStep("info");
          toast({ title: "Payment canceled", variant: "destructive" });
        }
      } catch {}
    };

    const handleStorage = (e: StorageEvent) => {
      if (isSuccessStep) return;
      if (e.key === "stripe_payment_signal" && e.newValue) processSignal(e.newValue);
    };

    if (isSuccessStep) return;

    window.addEventListener("storage", handleStorage);
    const poll = setInterval(() => {
      const r = localStorage.getItem("stripe_payment_signal");
      if (r) processSignal(r);
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(poll);
    };
  }, [toast, verifyStripePayment, pendingOrderId, lookupToken, step]);

  // Address selection
  const handlePlaceSelect = useCallback((res: PlaceSelectResult) => {
    setAddress(res.formattedAddress);
    setCustomerCoords({ lat: res.lat, lng: res.lng });
    if (res.addressComponents) setDetectedParish(getParishFromPlaceResult(res.addressComponents));
    updateSession({ stage: "entered_address", delivery_address: res.formattedAddress, address_lat: res.lat, address_lng: res.lng });
  }, []);

  // Calculate distance
  const calculateDistance = useCallback(async () => {
    const currentAddress = address.trim() || getPlaceInputValue(addressContainerRef.current);
    if (!currentAddress) { setError("Please enter a delivery address."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      let custLat = customerCoords?.lat;
      let custLng = customerCoords?.lng;
      if (custLat == null || custLng == null) {
        if (!window.google?.maps?.Geocoder) { setError("Maps not loaded yet."); setLoading(false); return; }
        const geocoder = new window.google.maps.Geocoder();
        const geoResult = await geocoder.geocode({ address: currentAddress });
        if (geoResult.results?.[0]?.geometry?.location) {
          custLat = geoResult.results[0].geometry.location.lat();
          custLng = geoResult.results[0].geometry.location.lng();
        } else { setError("Could not locate that address."); setLoading(false); return; }
      }
      if (allPits.length === 0) { setError("No delivery locations configured."); setLoading(false); return; }
      const bestResult = await findBestPitDriving(allPits, currentAddress, globalPricing, supabase, 1);
      if (!bestResult) { setError("No delivery locations available."); setLoading(false); return; }
      if (!bestResult.serviceable) { setError("That address is outside our delivery area. Call 1-855-GOT-WAYS for options."); setLoading(false); return; }

      const schedule: PitSchedule = {
        operating_days: bestResult.pit.operating_days,
        saturday_surcharge_override: bestResult.pit.saturday_surcharge_override != null ? Number(bestResult.pit.saturday_surcharge_override) : null,
        sunday_surcharge: bestResult.pit.sunday_surcharge != null ? Number(bestResult.pit.sunday_surcharge) : null,
        same_day_cutoff: bestResult.pit.same_day_cutoff,
      };
      setMatchedPit(bestResult.pit);
      setMatchedPitSchedule(schedule);
      setWeekdayPit(bestResult.pit);
      setWeekdayPitSchedule(schedule);

      const estimateResult: EstimateResult = {
        distance: parseFloat(bestResult.distance.toFixed(1)),
        price: bestResult.price,
        address: `${bestResult.distance.toFixed(1)} mi away`,
        duration: "~30 min",
      };
      setWeekdayResult(estimateResult);
      setResult(estimateResult);

      findAllPitDistances(allPits, currentAddress, globalPricing, supabase).then(d => setAllPitDistances(d)).catch(() => {});

      setStep("price");
      trackEvent("begin_checkout", { value: bestResult.price, currency: "USD" });
      updateSession({ stage: "started_checkout", delivery_address: currentAddress, calculated_price: bestResult.price, nearest_pit_id: bestResult.pit.id, nearest_pit_name: bestResult.pit.name, serviceable: true });
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }, [address, customerCoords, allPits, globalPricing]);

  // Date selection with pit reassignment
  const handleDateSelect = useCallback((d: DeliveryDate) => {
    setSelectedDeliveryDate(d);
  }, []);

  const handlePitAssigned = useCallback((pit: PitDistanceEntry["pit"]) => {
    if (!pit || !allPitDistances.length) return;
    const entry = allPitDistances.find(pd => pd.pit.id === pit.id);
    if (!entry) return;
    setMatchedPit(entry.pit as PitData);
    setMatchedPitSchedule({
      operating_days: entry.pit.operating_days,
      saturday_surcharge_override: entry.pit.saturday_surcharge_override != null ? Number(entry.pit.saturday_surcharge_override) : null,
      sunday_surcharge: entry.pit.sunday_surcharge != null ? Number(entry.pit.sunday_surcharge) : null,
      same_day_cutoff: entry.pit.same_day_cutoff,
    });
    setResult(prev => prev ? { ...prev, price: entry.price, distance: parseFloat(entry.distance.toFixed(1)) } : prev);
  }, [allPitDistances]);

  // Build order data
  const buildOrderData = () => {
    const distFee = result && effectivePricing ? Math.max(0, Math.round((result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * 100) / 100) : 0;
    return {
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
      sunday_surcharge: selectedDeliveryDate!.isSunday,
      sunday_surcharge_amount: selectedDeliveryDate!.isSunday ? effectiveSunSurcharge * quantity : 0,
      pit_id: matchedPit?.id || null,
      delivery_window: "8:00 AM – 5:00 PM",
      same_day_requested: selectedDeliveryDate!.isSameDay,
      tax_rate: taxInfo.rate,
      tax_amount: taxAmount,
      delivery_terms_accepted: deliveryTermsAccepted,
      delivery_terms_timestamp: new Date().toISOString(),
      card_authorization_accepted: paymentMethod === "stripe-link",
      card_authorization_timestamp: paymentMethod === "stripe-link" ? new Date().toISOString() : null,
      company_name: form.companyName.trim() || null,
      base_unit_price: effectivePricing.base_price,
      distance_fee: distFee * quantity,
      processing_fee: 0,
      ...(leadReference ? { lead_reference: leadReference } : {}),
    };
  };

  // COD submit
  const handleCodSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Name and phone are required.", variant: "destructive" });
      return;
    }
    if (!result || !selectedDeliveryDate) return;
    setSubmitting(true);
    try {
      const { data: rpcResult, error: insertError } = await supabase.rpc("create_order", {
        p_data: { ...buildOrderData(), payment_method: codSubOption, payment_status: "pending" },
      });
      if (insertError) throw insertError;
      const inserted = rpcResult as any;
      setOrderNumber(inserted?.order_number || null);
      setConfirmedOrderId(inserted?.id || null);
      setLookupToken(inserted?.lookup_token || null);
      // Populate confirmedTotals from the order we just created
      if (inserted?.id) {
        const { data: orderRec } = await supabase.from("orders").select("price, base_unit_price, distance_fee, processing_fee, saturday_surcharge_amount, sunday_surcharge_amount, tax_amount").eq("id", inserted.id).maybeSingle();
        if (orderRec) populateConfirmedTotals(orderRec);
      }
      setStep("success");
      clearCart();
      trackEvent("purchase", { transaction_id: inserted?.order_number || "", value: totalPrice, currency: "USD" });
      updateSession({ stage: "completed_order", order_id: inserted?.id || null, order_number: inserted?.order_number || null });
      supabase.functions.invoke("leads-auth", { body: { action: "notify_new_order", customer_name: form.name, payment_method: codSubOption, delivery_address: address, order_id: inserted?.id } }).catch(() => {});
      sendOrderEmail(inserted?.order_number || null, codSubOption, "pending", null);
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  // Stripe submit
  const handleStripeLink = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Missing info", description: "Name and phone are required.", variant: "destructive" });
      return;
    }
    if (!result || !selectedDeliveryDate) return;
    setSubmitting(true);
    try {
      const stripeTotal = isBaked ? totalPrice : totalWithProcessingFee;
      const orderData = { ...buildOrderData(), payment_method: "stripe-link", payment_status: "pending", price: stripeTotal, processing_fee: isBaked ? 0 : processingFee };
      const { data: rpcResult, error: insertError } = await supabase.rpc("create_order", { p_data: orderData });
      if (insertError) throw insertError;
      const insertedOrder = rpcResult as any;

      const isEmbedded = window.self !== window.top;
      const description = isBaked
        ? `River Sand Delivery — ${quantity} load${quantity > 1 ? "s" : ""} × 9 cu yds`
        : `River Sand Delivery — ${quantity} load${quantity > 1 ? "s" : ""} × 9 cu yds (incl. 3.5% processing fee)`;
      const { data, error } = await supabase.functions.invoke("create-checkout-link", {
        body: {
          amount: Math.round(stripeTotal * 100), description,
          customer_name: form.name.trim(), customer_email: form.email.trim() || null,
          order_id: insertedOrder?.id, order_number: insertedOrder?.order_number,
          origin_url: window.location.origin,
          return_mode: isEmbedded ? "popup" : "redirect",
          same_day_requested: selectedDeliveryDate?.isSameDay || false,
          delivery_date: selectedDeliveryDate?.iso || null,
        },
      });
      if (error || !data?.url) throw new Error(data?.error || error?.message || "Failed to create payment link");

      supabase.functions.invoke("leads-auth", { body: { action: "notify_new_order", customer_name: form.name, payment_method: "stripe-link", delivery_address: address, order_id: insertedOrder?.id } }).catch(() => {});
      setPendingOrderId(insertedOrder?.id || null);
      setLookupToken(insertedOrder?.lookup_token || null);
      await updateSession({ stripe_link_clicked: true, stripe_link_clicked_at: new Date().toISOString() });

      try {
        sessionStorage.setItem("pending_order_snapshot", JSON.stringify({
          address, form, quantity, selectedDeliveryDate, paymentMethod: "stripe-link",
          pendingOrderId: insertedOrder?.id || null, orderNumber: insertedOrder?.order_number || null,
          lookupToken: insertedOrder?.lookup_token || null, result, totalPrice, totalWithProcessingFee, processingFee, taxAmount, subtotal, saturdaySurchargeTotal, sundaySurchargeTotal, taxInfo,
        }));
      } catch {}

      if (isEmbedded) {
        const newTab = window.open(data.url, "_blank");
        if (!newTab) window.location.assign(data.url);
        return;
      } else {
        window.location.assign(data.url);
      }
    } catch (err: any) {
      toast({ title: "Payment link failed", description: err.message || "Try another method.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  // Download invoice
  const handleDownloadInvoice = async () => {
    if (!confirmedOrderId || !lookupToken) return;
    setDownloadingInvoice(true);
    try {
      const response = await supabase.functions.invoke("generate-invoice", { body: { order_id: confirmedOrderId, lookup_token: lookupToken } });
      if (response.error) throw new Error("Failed to generate invoice");
      const blob = new Blob([response.data], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setDownloadingInvoice(false); }
  };

  const isFormValid = selectedDeliveryDate && form.name.trim() && form.phone.trim() && form.email.trim();

  // Popup return fallback
  const isPopupReturn = searchParams.get("return_mode") === "popup" && searchParams.get("payment");
  if (isPopupReturn) {
    const ps = searchParams.get("payment");
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="bg-background rounded-2xl p-8 text-center space-y-4 max-w-sm w-full">
          {ps === "success" ? <CheckCircle2 className="w-12 h-12 text-accent mx-auto" /> : <Lock className="w-12 h-12 text-destructive mx-auto" />}
          <h2 className="font-display text-2xl text-foreground">{ps === "success" ? "Payment Complete!" : "Payment Canceled"}</h2>
          <p className="font-body text-sm text-muted-foreground">{ps === "success" ? "You can close this tab." : "No charge was made."}</p>
          <Button onClick={() => window.close()} className="font-display tracking-wider">Close Tab</Button>
        </div>
      </div>
    );
  }

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence mode="wait">

        {/* ── SCREEN 1: ADDRESS ── */}
        {step === "address" && (
          <motion.div key="address" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }} className="min-h-screen flex flex-col bg-primary px-6">
            {/* Zone 1 — Logo pinned top */}
            <div className="pt-16 flex justify-center">
              <img src={LOGO_WHITE} alt="River Sand" className="h-10 opacity-90" />
            </div>

            {/* Zone 2 — Headline + Input centered */}
            <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
              <h1 className="font-display text-5xl text-primary-foreground tracking-wide text-center leading-none">WHERE DO YOU NEED SAND?</h1>
              <p className="font-body text-base text-primary-foreground/60 text-center mt-2">Get an instant delivery price — no account needed.</p>

              <div ref={addressContainerRef} className="w-full mt-8">
                {apiLoaded ? (
                  <PlaceAutocompleteInput
                    onPlaceSelect={handlePlaceSelect}
                    onInputChange={(val) => { setAddress(val); setCustomerCoords(null); }}
                    onEnterKey={calculateDistance}
                    placeholder="Enter your delivery address"
                    id="mobile-address"
                    containerClassName="place-autocomplete-embedded"
                  />
                ) : (
                  <div className="h-16 rounded-2xl border border-white/20 bg-white/10 animate-pulse" />
                )}
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-body text-sm text-destructive mt-4 text-center px-4">{error}</motion.p>
              )}
            </div>

            {/* Zone 3 — CTA pinned bottom */}
            <div className="pb-10 space-y-3 max-w-md mx-auto w-full">
              <Button
                onClick={calculateDistance}
                disabled={loading || !customerCoords}
                className="w-full h-16 rounded-2xl font-display text-xl tracking-wider bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "GET MY PRICE →"}
              </Button>
              <a href="tel:+18554689297" className="block text-center font-display text-sm tracking-wider text-accent/80 mt-3">
                📞 1-855-GOT-WAYS
              </a>
            </div>
          </motion.div>
        )}

        {/* ── SCREEN 2: PRICE + DATE ── */}
        {step === "price" && result && (
          <motion.div key="price" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1 flex flex-col bg-background">
            {/* Top bar */}
            <div className="flex items-center px-4 py-3 border-b border-border">
              <button onClick={() => setStep("address")} className="p-2 -ml-2">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <p className="flex-1 font-display text-sm text-foreground text-center tracking-wider">YOUR QUOTE</p>
              <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
              {/* Price display */}
              <div className="text-center mb-8">
                <p className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-1">Per Load Starting At</p>
                <p className="font-display text-7xl text-accent leading-none">{formatCurrency(result.price)}</p>
                <p className="font-body text-sm text-muted-foreground mt-2">per 9 cu yd load · delivered curbside</p>
              </div>

              {/* Quantity selector */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <span className="font-body text-sm text-muted-foreground">Loads:</span>
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold">−</button>
                <span className="font-display text-2xl text-foreground w-8 text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(10, q + 1))} className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold">+</button>
              </div>

              {/* Date picker */}
              <div className="mb-6">
                <h2 className="font-display text-lg text-foreground tracking-wider mb-3">SELECT DELIVERY DATE</h2>
                <DeliveryDatePicker
                  selectedDate={selectedDeliveryDate}
                  onSelect={handleDateSelect}
                  onPitAssigned={handlePitAssigned}
                  pitSchedule={matchedPitSchedule}
                  globalSaturdaySurcharge={globalSaturdaySurcharge}
                  pitId={matchedPit?.id}
                  allPitDistances={allPitDistances as any}
                />
              </div>

              {/* Price breakdown */}
              {selectedDeliveryDate && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/50 border border-border rounded-xl p-4 space-y-2 font-body text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({quantity} × {formatCurrency(result.price)})</span>
                    <span className="text-foreground">{formatCurrency(result.price * quantity)}</span>
                  </div>
                  {saturdaySurchargeTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-amber-700">Saturday surcharge</span>
                      <span className="text-amber-700">+{formatCurrency(saturdaySurchargeTotal)}</span>
                    </div>
                  )}
                  {sundaySurchargeTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-indigo-700">Sunday fee</span>
                      <span className="text-indigo-700">+{formatCurrency(sundaySurchargeTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({(taxInfo.rate * 100).toFixed(2)}%)</span>
                    <span className="text-foreground">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-display tracking-wider text-foreground">ESTIMATED TOTAL</span>
                    <span className="font-display text-lg text-foreground">{formatCurrency(totalPrice)}</span>
                  </div>
                </motion.div>
              )}
              <p className="font-body text-xs text-muted-foreground text-center mt-4 truncate">{address}</p>
            </div>

            {/* Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4 safe-area-inset-bottom">
              <Button
                onClick={() => setStep("info")}
                disabled={!selectedDeliveryDate}
                className="w-full h-16 rounded-2xl font-display text-xl tracking-wider bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg disabled:opacity-40"
              >
                CONTINUE →
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── SCREEN 3: YOUR INFO + PAYMENT ── */}
        {step === "info" && result && (
          <motion.div key="info" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1 flex flex-col bg-background">
            {/* Top bar */}
            <div className="flex items-center px-4 py-3 border-b border-border">
              <button onClick={() => setStep("price")} className="p-2 -ml-2">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <p className="flex-1 font-display text-sm tracking-wider text-foreground text-center">CHECKOUT</p>
              <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-8" style={{ paddingBottom: '320px' }}>
              {/* Order summary — single line */}
              <div className="bg-primary/10 rounded-xl px-4 py-3 mb-6">
                <p className="font-body text-sm text-foreground text-center">
                  {quantity} load{quantity > 1 ? "s" : ""} · {formatCurrency(totalPrice)} · {selectedDeliveryDate?.label} {selectedDeliveryDate?.dateStr}
                </p>
              </div>

              {/* Your Info */}
              <h2 className="font-display text-lg text-foreground tracking-wider mb-3">YOUR INFO</h2>
              <div className="space-y-3 mb-6">
                {/* Company name — collapsed toggle */}
                {!showCompany ? (
                  <button type="button" onClick={() => setShowCompany(true)} className="font-body text-sm text-primary hover:underline">+ Add company name</button>
                ) : (
                  <div>
                    <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Company Name</label>
                    <Input
                      placeholder="Company name (optional)"
                      value={form.companyName}
                      onChange={e => setForm({ ...form, companyName: e.target.value })}
                      onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150)}
                      inputMode="text"
                      className="h-16 rounded-xl text-lg placeholder:text-black/35"
                    />
                  </div>
                )}

                <div>
                  <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Full Name *</label>
                  <Input
                    ref={nameRef}
                    placeholder="Your full name"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); phoneRef.current?.focus(); } }}
                    inputMode="text"
                    enterKeyHint="next"
                    className="h-16 rounded-xl text-lg placeholder:text-black/35"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Phone *</label>
                  <Input
                    ref={phoneRef}
                    type="tel"
                    placeholder="(555) 555-5555"
                    required
                    maxLength={14}
                    value={form.phone}
                    onChange={e => {
                      const formatted = formatPhone(e.target.value);
                      setForm({ ...form, phone: formatted });
                      if (formatted.length >= 14) {
                        setTimeout(() => {
                          document.getElementById("mobile-email-input")?.querySelector("input")?.focus();
                        }, 50);
                      }
                    }}
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("mobile-email-input")?.querySelector("input")?.focus(); } }}
                    inputMode="tel"
                    enterKeyHint="next"
                    className="h-16 rounded-xl text-lg placeholder:text-black/35"
                  />
                </div>
                <div id="mobile-email-input">
                  <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Email *</label>
                  <EmailInput
                    value={form.email}
                    onChange={v => setForm({ ...form, email: v })}
                    required
                    className="h-16 rounded-xl text-lg placeholder:text-black/35"
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150)}
                  />
                </div>

                {/* Notes — collapsed toggle */}
                {!showNotes ? (
                  <button type="button" onClick={() => setShowNotes(true)} className="font-body text-sm text-primary hover:underline">+ Add delivery instructions</button>
                ) : (
                  <div>
                    <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Delivery Instructions</label>
                    <Textarea
                      placeholder="Gate code, landmark, or special instructions..."
                      maxLength={275}
                      rows={2}
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150)}
                      className="rounded-xl text-lg placeholder:text-black/35"
                    />
                  </div>
                )}
              </div>

              {/* Delivery Terms — single checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mb-8">
                <input type="checkbox" checked={deliveryTermsAccepted} onChange={e => setDeliveryTermsAccepted(e.target.checked)} className="mt-0.5 w-5 h-5 rounded accent-primary shrink-0" />
                <span className="font-body text-sm text-foreground leading-relaxed">
                  I agree to the{" "}
                  <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="underline text-primary">delivery terms</a>
                </span>
              </label>

              {/* Payment buttons — full width, stacked */}
              <div className="space-y-3 pb-4">
                <Button
                  onClick={() => {
                    if (!isFormValid) { toast({ title: "Missing fields", description: "Please fill name, phone, and email.", variant: "destructive" }); return; }
                    if (!deliveryTermsAccepted) { toast({ title: "Terms required", description: "Please accept delivery terms.", variant: "destructive" }); return; }
                    setPaymentMethod("stripe-link");
                    handleStripeLink();
                  }}
                  disabled={submitting}
                  className="w-full h-14 rounded-2xl font-display text-lg tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                >
                  {submitting && paymentMethod === "stripe-link" ? <Loader2 className="w-5 h-5 animate-spin" /> : "PAY NOW"}
                </Button>

                {!isWeekendDate && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!isFormValid) { toast({ title: "Missing fields", description: "Please fill name, phone, and email.", variant: "destructive" }); return; }
                      if (!deliveryTermsAccepted) { toast({ title: "Terms required", description: "Please accept delivery terms.", variant: "destructive" }); return; }
                      setPaymentMethod("cash");
                      setCodSubOption("cash");
                      handleCodSubmit();
                    }}
                    disabled={submitting}
                    className="w-full h-14 rounded-2xl font-display text-lg tracking-wider border-2 border-primary text-primary"
                  >
                    {submitting && paymentMethod === "cash" ? <Loader2 className="w-5 h-5 animate-spin" /> : "PAY AT DELIVERY"}
                  </Button>
                )}

                {isWeekendDate && (
                  <p className="font-body text-xs text-amber-600 text-center">Card payment required for weekend deliveries.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SCREEN 4: SUCCESS ── */}
        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col bg-primary items-center justify-center px-6 py-12 text-center">
            {verifyingPayment ? (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-accent mb-6" />
                <h2 className="font-display text-2xl text-primary-foreground tracking-wider mb-2">Confirming Payment...</h2>
                <p className="font-body text-sm text-primary-foreground/60">This usually takes a few seconds.</p>
              </>
            ) : (
              <>
                <AnimatedCheckmark />

                <h2 className="font-display text-3xl text-accent tracking-wider mt-6 mb-2">
                  {orderNumber || "ORDER CONFIRMED"}
                </h2>

                {selectedDeliveryDate && (
                  <p className="font-body text-base text-primary-foreground mb-1">
                    {selectedDeliveryDate.fullLabel}
                  </p>
                )}

                <div className="w-full rounded-2xl p-4 mt-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="font-display text-sm tracking-widest text-primary-foreground/50 mb-3">ORDER SUMMARY</p>
                  <div className="space-y-2">
                    {orderNumber && (
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-primary-foreground/70">Order</span>
                        <span className="font-body text-sm text-primary-foreground font-semibold">{orderNumber}</span>
                      </div>
                    )}
                    {selectedDeliveryDate && (
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-primary-foreground/70">Delivery</span>
                        <span className="font-body text-sm text-primary-foreground">{selectedDeliveryDate.label} {selectedDeliveryDate.dateStr}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-body text-sm text-primary-foreground/70">Quantity</span>
                      <span className="font-body text-sm text-primary-foreground">{quantity} load{quantity > 1 ? "s" : ""} × 9 cu yds</span>
                    </div>
                    {address && (
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-primary-foreground/70">Address</span>
                        <span className="font-body text-sm text-primary-foreground text-right max-w-[60%] truncate">{address}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-body text-sm text-primary-foreground/70">Payment</span>
                      <span className="font-body text-sm text-primary-foreground capitalize">{paymentMethod === "stripe-link" ? "Card — Paid" : "Pay at Delivery"}</span>
                    </div>
                    {confirmedTotals && confirmedTotals.distanceFee > 0 && (
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-primary-foreground/70">Distance Fee</span>
                        <span className="font-body text-sm text-primary-foreground">{formatCurrency(confirmedTotals.distanceFee)}</span>
                      </div>
                    )}
                    {confirmedTotals && confirmedTotals.saturdaySurcharge > 0 && (
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-primary-foreground/70">Saturday Surcharge</span>
                        <span className="font-body text-sm text-primary-foreground">{formatCurrency(confirmedTotals.saturdaySurcharge)}</span>
                      </div>
                    )}
                    {confirmedTotals && confirmedTotals.processingFee > 0 && (
                      <div className="flex justify-between">
                        <span className="font-body text-sm text-primary-foreground/70">Processing Fee</span>
                        <span className="font-body text-sm text-primary-foreground">{formatCurrency(confirmedTotals.processingFee)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', paddingTop: '8px' }} className="flex justify-between">
                      <span className="font-body text-sm font-semibold text-primary-foreground">Total</span>
                      <span className="font-display text-lg text-accent">
                        {confirmedTotals ? formatCurrency(confirmedTotals.total) : formatCurrency(paymentMethod === "stripe-link" ? totalWithProcessingFee : totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="font-body text-xs text-primary-foreground/40 mb-4">
                  Our driver will call 30 minutes before arrival.
                </p>

                {confirmedOrderId && lookupToken && (
                  <Button
                    onClick={handleDownloadInvoice}
                    disabled={downloadingInvoice}
                    variant="outline"
                    className="mb-4 font-display tracking-wider border-accent text-accent hover:bg-accent/10 rounded-xl"
                  >
                    {downloadingInvoice ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    VIEW INVOICE
                  </Button>
                )}

                {gmbReviewUrl && (
                  <div className="mt-6 p-4 rounded-2xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="font-display text-xl text-primary-foreground tracking-wide mb-1">HAPPY WITH YOUR ORDER?</p>
                    <p className="font-body text-sm text-primary-foreground/60 mb-4">Your review helps other customers find us — it only takes 30 seconds.</p>
                    <a href={gmbReviewUrl} target="_blank" rel="noopener noreferrer"
                       className="block w-full h-12 rounded-2xl font-display text-lg tracking-wider flex items-center justify-center gap-2"
                       style={{ backgroundColor: '#C07A00', color: '#0D2137' }}>
                      ⭐ Leave a Google Review
                    </a>
                    <p className="font-body text-xs text-primary-foreground/30 mt-3">Takes 30 seconds · Opens Google Maps</p>
                  </div>
                )}

                <Link to="/" className="font-display text-sm tracking-wider text-primary-foreground/50 hover:text-primary-foreground/70 transition-colors mt-4">
                  ← BACK TO HOME
                </Link>

                <a href="tel:+18554689297" className="font-display text-sm tracking-wider text-accent/80 mt-6">
                  📞 1-855-GOT-WAYS
                </a>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default OrderMobile;
