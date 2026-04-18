/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { updateSession, initSession, getSessionToken } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Loader2, Phone, ArrowLeft, Lock, Banknote, CreditCard, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { formatPhone, formatCurrency, getTaxRateFromAddress, getParishFromPlaceResult, getTaxRateByParish, LA_STATE_TAX_RATE } from "@/lib/format";
import { formatProperName, formatProperNameFinal, formatSentence, formatEmail } from "@/lib/textFormat";

import OrderConfirmation from "@/components/OrderConfirmation";
import OutOfAreaModal from "@/components/OutOfAreaModal";
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
  parseGlobalSettings,
  FALLBACK_GLOBAL_PRICING,
} from "@/lib/pits";
import PlaceAutocompleteInput, { getPlaceInputValue, type PlaceSelectResult, type AddressMismatchData } from "@/components/PlaceAutocompleteInput";
import AddressMismatchDialog from "@/components/AddressMismatchDialog";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useBrandPalette } from "@/hooks/useBrandPalette";
import { useCountdown } from "@/hooks/use-countdown";

const LOGO_HOME = "/lovable-uploads/riversand-logo_WHITE-2.png";

declare global {
  interface Window { google: any; }
}

type EstimateResult = {
  distance: number;
  billedDistance?: number;
  price: number;
  address: string;
  duration: string;
  isNorthshore?: boolean;
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
  const navigate = useNavigate();
  const { timeLeft, label } = useCountdown();
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
  const [pitsLoaded, setPitsLoaded] = useState(false);
  const [matchedPit, setMatchedPit] = useState<PitData | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pricingMode, setPricingMode] = useState<"transparent" | "baked">("baked");
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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);
  const [outOfAreaAddress, setOutOfAreaAddress] = useState("");
  const [outOfAreaDistance, setOutOfAreaDistance] = useState(0);
  const [nearestPitInfo, setNearestPitInfo] = useState<{ id: string; name: string; distance: number } | null>(null);

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
  // In baked mode, everyone pays the same price — no COD discount
  const subtotal = result ? (result.price * quantity) + saturdaySurchargeTotal + sundaySurchargeTotal : 0;
  const taxAmount = parseFloat((subtotal * taxInfo.rate).toFixed(2));
  const totalPrice = parseFloat((subtotal + taxAmount).toFixed(2));
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

  // Visual Viewport keyboard detection — waits for keyboard to fully open before repositioning
  useEffect(() => {
    if (!window.visualViewport) return;

    let timeout: ReturnType<typeof setTimeout>;

    const handleViewportChange = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height;
        if (keyboardHeight > 100) {
          const activeEl = document.activeElement as HTMLElement;
          // Exclude address input — it handles its own positioning
          if (
            activeEl &&
            (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
            activeEl.id !== 'mobile-address' &&
            !activeEl.closest('#address-step-container')
          ) {
            const rect = activeEl.getBoundingClientRect();
            const visibleHeight = window.visualViewport!.height;
            const viewportTop = window.visualViewport!.offsetTop;
            const fieldBottom = rect.bottom - viewportTop;
            if (fieldBottom > visibleHeight - 20) {
              const scrollAmount = fieldBottom - visibleHeight + 60;
              window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            }
          }
        }
      }, 150);
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    return () => {
      clearTimeout(timeout);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // Browser back button interception
  useEffect(() => {
    // Only intercept back button when we're actually on /order
    if (window.location.pathname !== '/order') return;

    const handlePopState = () => {
      if (step === "price") {
        setStep("address");
        setResult(null);
        setSelectedDeliveryDate(null);
        setAllPitDistances([]);
        setMatchedPit(null);
        window.history.pushState(null, '', '/order');
      } else if (step === "info") {
        setStep("price");
        window.history.pushState(null, '', '/order');
      }
    };

    window.history.pushState(null, '', '/order');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [step]);

  // Fetch GMB review URL (GTM + Clarity injection lives in App.tsx top-level effect)
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
      if (pitsRes.data) { setAllPits(pitsRes.data as any); setPitsLoaded(true); }
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
        if (!error && ["paid", "authorized", "captured"].includes(data?.payment_status)) return data;
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

  // Forward-declared ref for purchase tracking helper. Real impl assigned below
  // (after `detectedZip` state is declared). Stripe success handlers in the
  // useEffect blocks above call it via this ref.
  const firePurchaseTrackingRef = useRef<(orderNum: string | null | undefined, paymentMethod: string, orderData?: any) => void>(() => {});

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
    findAllPitDistances(allPits, address, globalPricing, supabase, detectedZip).then(d => setAllPitDistances(d)).catch(() => {});
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
      // Restore snapshot state immediately (address, date, form, etc.)
      try {
        const snap = JSON.parse(sessionStorage.getItem("pending_order_snapshot") || "{}");
        if (!verifyOrderId) verifyOrderId = snap.pendingOrderId || null;
        if (!verifyToken) verifyToken = snap.lookupToken || null;
        if (snap.address && !address) setAddress(snap.address);
        if (snap.form) setForm(prev => ({ ...prev, ...snap.form }));
        if (snap.quantity) setQuantity(snap.quantity);
        if (snap.result) setResult(snap.result);
        if (snap.selectedDeliveryDate) setSelectedDeliveryDate(snap.selectedDeliveryDate);
      } catch {}
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
          // Fire GA4 purchase event for Stripe card orders (idempotent per order_number).
          firePurchaseTrackingRef.current(orderData?.order_number || returnedOrderNumber, "stripe-link", orderData);
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

    // Idempotency guard: track processed signal IDs in this session so a stale
    // payload in localStorage isn't replayed by the 1s poll loop.
    const processedSignals = new Set<string>();
    const processSignal = (raw: string) => {
      if (isSuccessStep) return;
      try {
        const signal = JSON.parse(raw);
        if (signal.type !== "stripe-payment-result") return;
        const signalId = signal.session_id || signal.order_number || signal.order_id || raw;
        if (processedSignals.has(signalId)) {
          localStorage.removeItem("stripe_payment_signal");
          console.warn("[Stripe signal] Ignoring already-processed signal:", signalId);
          return;
        }
        processedSignals.add(signalId);
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
            verifyStripePayment(verifyOrderId, verifyTk).then((orderData) => {
              setVerifyingPayment(false);
              if (orderData) {
                populateConfirmedTotals(orderData);
                setConfirmedOrderId(orderData.id || verifyOrderId);
                setOrderNumber(orderData.order_number || signal.order_number);
              }
              // Fire GA4 purchase event for Stripe card orders (idempotent per order_number).
              firePurchaseTrackingRef.current(orderData?.order_number || signal.order_number, "stripe-link", orderData);
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
  const [mismatchData, setMismatchData] = useState<AddressMismatchData | null>(null);
  const [detectedZip, setDetectedZip] = useState('');

  // Real impl of purchase tracking helper. Wired into the forward-declared ref
  // so Stripe success handlers (above, in useEffect) can call it via the ref.
  // Idempotency: sessionStorage guard ensures one purchase event per order_number.
  const firePurchaseTracking = useCallback((
    orderNum: string | null | undefined,
    paymentMethod: string,
    orderData?: any,
  ) => {
    if (!orderNum) return;
    const guardKey = `purchase_fired_${orderNum}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
    } catch {}
    const purchaseValue = orderData?.price ?? totalPrice;
    const purchaseTax = orderData?.tax_amount ?? taxAmount;
    const itemPrice = orderData?.base_unit_price ?? result?.price ?? 0;
    const itemQty = orderData?.quantity ?? quantity;
    trackEvent("purchase", {
      transaction_id: orderNum,
      value: purchaseValue,
      currency: "USD",
      tax: purchaseTax,
      items: [{ item_name: "River Sand 9 cu/yd", item_id: "river-sand-9yd", price: itemPrice, quantity: itemQty }],
      rs_session_id: getSessionToken(),
      rs_payment_method: paymentMethod,
      rs_pit: matchedPit?.name,
      rs_distance: orderData?.distance_miles ?? result?.distance,
      rs_zip: detectedZip,
      rs_parish: orderData?.tax_parish ?? taxInfo.parish,
    });
    try { sessionStorage.setItem(guardKey, "1"); } catch {}
  }, [totalPrice, taxAmount, result, quantity, matchedPit, detectedZip, taxInfo]);
  useEffect(() => { firePurchaseTrackingRef.current = firePurchaseTracking; }, [firePurchaseTracking]);

  /* ── Funnel events: begin_checkout / add_shipping_info / add_payment_info ──
   * Same idempotency model as desktop: sessionStorage guards keyed by session
   * token; add_payment_info re-fires when method switches.
   */
  useEffect(() => {
    if (step !== "price" || !result || !matchedPit) return;
    const sid = getSessionToken();
    const key = `begin_checkout_fired_${sid}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}
    trackEvent("begin_checkout", {
      value: result.price,
      currency: "USD",
      items: [{ item_name: "River Sand 9 cu/yd", item_id: "river-sand-9yd", price: result.price, quantity }],
      rs_session_id: sid,
      rs_price: result.price,
      rs_distance: result.distance,
      rs_pit: matchedPit.name,
      rs_zip: detectedZip,
      rs_parish: taxInfo.parish,
    });
    try { sessionStorage.setItem(key, "1"); } catch {}
  }, [step, result, matchedPit, quantity, detectedZip, taxInfo.parish]);

  useEffect(() => {
    if (!selectedDeliveryDate || !result || !matchedPit) return;
    const sid = getSessionToken();
    const key = `add_shipping_info_fired_${sid}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}
    trackEvent("add_shipping_info", {
      value: totalPrice,
      currency: "USD",
      items: [{ item_name: "River Sand 9 cu/yd", item_id: "river-sand-9yd", price: result.price, quantity }],
      rs_session_id: sid,
      rs_delivery_date: selectedDeliveryDate.iso,
      rs_delivery_window: "8:00 AM – 5:00 PM",
      rs_distance: result.distance,
      rs_pit: matchedPit.name,
      rs_zip: detectedZip,
      rs_parish: taxInfo.parish,
    });
    try { sessionStorage.setItem(key, "1"); } catch {}
  }, [selectedDeliveryDate, result, matchedPit, quantity, totalPrice, detectedZip, taxInfo.parish]);

  useEffect(() => {
    if (!paymentMethod || !result || !matchedPit) return;
    const paymentType = paymentMethod === "stripe-link" ? "card" : "cod";
    const sid = getSessionToken();
    const key = `add_payment_info_fired_${sid}_${paymentType}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}
    trackEvent("add_payment_info", {
      value: totalPrice,
      currency: "USD",
      payment_type: paymentType,
      items: [{ item_name: "River Sand 9 cu/yd", item_id: "river-sand-9yd", price: result.price, quantity }],
      rs_session_id: sid,
      rs_pit: matchedPit.name,
      rs_zip: detectedZip,
      rs_parish: taxInfo.parish,
    });
    try { sessionStorage.setItem(key, "1"); } catch {}
  }, [paymentMethod, result, matchedPit, quantity, totalPrice, detectedZip, taxInfo.parish]);


  // Address selection
  const handlePlaceSelect = useCallback((res: PlaceSelectResult) => {
    setAddress(res.formattedAddress);
    setCustomerCoords({ lat: res.lat, lng: res.lng });
    if (res.addressComponents) {
      setDetectedParish(getParishFromPlaceResult(res.addressComponents));
      const zipComponent = res.addressComponents.find(
        (c: any) => c.types.includes('postal_code')
      );
      setDetectedZip(zipComponent?.short_name || '');
    }
    updateSession({ stage: "entered_address", delivery_address: res.formattedAddress, address_lat: res.lat, address_lng: res.lng });
  }, []);

  const handleAddressMismatch = useCallback((data: AddressMismatchData) => {
    setMismatchData(data);
  }, []);

  const handleMismatchUseResolved = useCallback(() => {
    if (!mismatchData) return;
    handlePlaceSelect({
      formattedAddress: mismatchData.resolved,
      lat: mismatchData.lat,
      lng: mismatchData.lng,
      addressComponents: mismatchData.addressComponents,
    });
    const input = addressContainerRef.current?.querySelector("input");
    if (input) input.value = mismatchData.resolved;
    setMismatchData(null);
  }, [mismatchData, handlePlaceSelect]);

  const handleMismatchKeepTyped = useCallback(() => {
    if (!mismatchData) return;
    handlePlaceSelect({
      formattedAddress: mismatchData.typed,
      lat: mismatchData.lat,
      lng: mismatchData.lng,
      addressComponents: mismatchData.addressComponents,
    });
    setMismatchData(null);
  }, [mismatchData, handlePlaceSelect]);

  const handleMismatchChange = useCallback(() => {
    setMismatchData(null);
    setAddress("");
    setCustomerCoords(null);
    const input = addressContainerRef.current?.querySelector("input");
    if (input) { input.value = ""; input.focus(); }
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
      const bestResult = await findBestPitDriving(allPits, currentAddress, globalPricing, supabase, 1, detectedZip);
      if (!bestResult) { setError("No delivery locations available."); setLoading(false); return; }
      if (!bestResult.serviceable) {
        setOutOfAreaAddress(currentAddress);
        setOutOfAreaDistance(parseFloat(bestResult.distance.toFixed(1)));
        setNearestPitInfo({ id: bestResult.pit.id, name: bestResult.pit.name, distance: bestResult.distance });
        setShowOutOfAreaModal(true);
        setLoading(false);
        return;
      }

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
        billedDistance: bestResult.billedDistance,
        price: bestResult.price,
        address: `${bestResult.distance.toFixed(1)} mi away`,
        duration: "~30 min",
        isNorthshore: bestResult.isNorthshore,
      };
      setWeekdayResult(estimateResult);
      setResult(estimateResult);

      findAllPitDistances(allPits, currentAddress, globalPricing, supabase, detectedZip).then(d => setAllPitDistances(d)).catch(() => {});

      setStep("price");
      // begin_checkout now fires from a useEffect when step="price" with valid context.
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
      billed_distance_miles: result!.billedDistance ?? result!.distance,
      is_northshore: result!.isNorthshore ?? false,
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
      tax_parish: taxInfo.parish,
      zip_code: detectedZip,
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
      // Populate confirmedTotals from the order we just created — BEFORE setting success step
      if (inserted?.id) {
        const { data: orderRec } = await supabase.from("orders").select("price, base_unit_price, distance_fee, processing_fee, saturday_surcharge_amount, sunday_surcharge_amount, tax_amount").eq("id", inserted.id).maybeSingle();
        if (orderRec) populateConfirmedTotals(orderRec);
      }
      // Only transition to success AFTER totals are populated
      setStep("success");
      clearCart();
      firePurchaseTracking(inserted?.order_number, codSubOption);
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
    // Sync autocomplete value from DOM before validation
    const emailInputEl = document.querySelector<HTMLInputElement>('input[type="email"][autocomplete="email"]');
    const currentEmail = emailInputEl?.value || form.email;
    if (currentEmail !== form.email) {
      setForm(f => ({ ...f, email: currentEmail }));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (currentEmail.trim() && !emailRegex.test(currentEmail.trim())) {
      toast({ title: "Invalid email address", description: "Please enter a complete email address (e.g. name@domain.com)", variant: "destructive" });
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
        ? `River Sand Delivery - ${quantity} load${quantity > 1 ? "s" : ""} x 9 cu yds`
        : `River Sand Delivery - ${quantity} load${quantity > 1 ? "s" : ""} x 9 cu yds (incl. 3.5% processing fee)`;
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
      toast({
        title: "Payment could not be processed",
        description: err.message?.includes('email')
          ? "Please check your email address and try again."
          : "Something went wrong. Please try again or call 1-855-GOT-WAYS.",
        variant: "destructive",
      });
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
          <motion.div key="address" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }} id="address-step-container" className="min-h-dvh flex flex-col bg-primary"
          >
            {/* Header */}
            <header className="flex items-center justify-center px-5 pt-5 pb-2">
              <img src={LOGO_HOME} alt="River Sand" className="object-contain" style={{ width: '50%', maxWidth: '200px' }} />
            </header>

            <div className="mx-auto w-3/4 h-px bg-accent/40 my-2" />

            {/* Hero */}
            <div className="flex-1 flex flex-col justify-center px-5 pb-4">
              <div className="text-center mb-8">
                <h1 className="font-display text-5xl text-white tracking-wide leading-[1.1] mb-3">
                  SAME-DAY RIVER SAND DELIVERY
                </h1>
                <p className="font-body text-base text-center" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Get your exact price in seconds.
                </p>
                <p className="font-body text-base text-center" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  No account needed.
                </p>
                <div className="flex items-center justify-center gap-3 mt-4 font-body text-xs text-white/60">
                  <span>✓ No minimums</span>
                  <span>·</span>
                  <span>✓ Cash or card</span>
                  <span>·</span>
                  <span>✓ Gulf South</span>
                </div>
              </div>

              {/* Address input */}
              <div className="mb-6">
                <p className="font-display text-sm text-accent tracking-widest uppercase mb-2 text-center">
                  DELIVERY ADDRESS
                </p>
                <div ref={addressContainerRef} className="min-h-[4rem] text-lg [&_input]:border-2 [&_input]:border-white/20 [&_input]:focus:border-accent [&_input]:rounded-2xl [&_input]:transition-colors"
                >
                  {apiLoaded ? (
                    <PlaceAutocompleteInput
                      onPlaceSelect={handlePlaceSelect}
                      onAddressMismatch={handleAddressMismatch}
                      onInputChange={(val) => { setAddress(val); setCustomerCoords(null); }}
                      onEnterKey={calculateDistance}
                      placeholder="Enter your delivery address"
                      id="mobile-address"
                      containerClassName="place-autocomplete-embedded"
                    />
                  ) : (
                    <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />
                  )}
                </div>
                <p className="font-body text-xs text-white/40 text-center mt-2">
                  Serving New Orleans, Metairie, Chalmette &amp; surrounding areas
                </p>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-body text-sm text-destructive mt-2 mb-4 text-center px-4">{error}</motion.p>
              )}

              {/* Get My Price button */}
              <div className="mb-4 max-w-md mx-auto w-full">
                <Button
                  data-auto-calc
                  onClick={calculateDistance}
                  disabled={loading || !customerCoords || !pitsLoaded}
                  className="w-full h-16 rounded-2xl font-display text-xl tracking-wider bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : !pitsLoaded ? "Loading..." : "GET MY PRICE →"}
                </Button>
              </div>

              {/* Countdown */}
              {label && (
                <div className="text-center mb-4">
                  <p className="font-body text-sm text-accent">
                    {label} <span className="font-semibold">{timeLeft}</span>
                  </p>
                </div>
              )}

              {/* Social proof */}
              <div className="flex items-center justify-center gap-0 font-body text-xs text-white/70 text-center mb-4">
                <span>15,000+ Loads</span>
                <span className="mx-2 text-accent/50">|</span>
                <span>Same-Day Available</span>
                <span className="mx-2 text-accent/50">|</span>
                <span>⭐ 4.9 Rating</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-6 space-y-3 mt-4">
              <a
                href="tel:+18554689297"
                className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl font-display text-xl tracking-wide"
                style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))" }}
              >
                <Phone className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} /> 1-855-GOT-WAYS
              </a>
              <div className="flex flex-col items-center gap-1 mt-3">
                <span className="font-body text-xs text-white/50">Operated by</span>
                <img
                  src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/Ways_Sitewide_Logo_white.png"
                  alt="WAYS®"
                  className="h-8"
                />
              </div>
              <button
                onClick={() => { localStorage.setItem("force_desktop", "true"); navigate("/"); window.location.reload(); }}
                className="w-full text-center font-body text-xs text-white/40 py-2"
              >
                View full site →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── SCREEN 2: PRICE + DATE ── */}
        {step === "price" && result && (
          <motion.div key="price" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1 flex flex-col bg-background">
            {/* Top bar */}
            <div className="flex items-center px-4 py-3 border-b border-border">
              <button onClick={() => { setStep("address"); setResult(null); setSelectedDeliveryDate(null); setAllPitDistances([]); setMatchedPit(null); }} className="p-2 -ml-2">
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
                <p className="font-body text-sm text-muted-foreground mt-2">per 9 cu yd load - delivered curbside</p>
              </div>

              {/* Quantity selector */}
              <div className="flex items-center justify-center w-full gap-6 py-4">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))' }}
                >
                  −
                </button>
                <span 
                  className="font-display text-4xl tracking-wide" 
                  style={{ color: '#0D2137', minWidth: '48px', textAlign: 'center' as const, display: 'block' }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))' }}
                >
                  +
                </button>
              </div>
              <p className="font-body text-xs text-center mt-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
                {quantity === 1 ? '9 cu yds' : `${quantity * 9} cu yds total`}
              </p>

              {/* Date picker */}
              <div className="mb-6">
                
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
              <div className="flex items-center justify-center gap-2 mt-4">
                <p className="font-body text-xs text-muted-foreground truncate max-w-[70%]">{address}</p>
                <button
                  onClick={() => {
                    setStep("address");
                    setResult(null);
                    setSelectedDeliveryDate(null);
                    setAllPitDistances([]);
                    setMatchedPit(null);
                  }}
                  className="font-body text-xs text-accent underline shrink-0"
                >
                  Change
                </button>
              </div>
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
              <div className="text-center -mt-4 mb-6">
                <button onClick={() => setStep("price")} className="font-body text-xs text-accent underline">
                  ← Edit date or quantity
                </button>
              </div>

              {/* Your Info */}
              <h2 className="font-display text-lg text-foreground tracking-wider mb-3">YOUR INFO</h2>
              <form autoComplete="on" onSubmit={e => e.preventDefault()}>
                <div className="space-y-3 mb-6">
                {/* Company name — collapsed toggle */}
                {!showCompany ? (
                  <button type="button" onClick={() => setShowCompany(true)} className="font-body text-sm text-primary hover:underline">+ Add company name</button>
                ) : (
                  <div>
                    <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Company Name</label>
                    <Input
                      name="organization"
                      id="mobile-company"
                      autoComplete="organization"
                      placeholder="Company name (optional)"
                      value={form.companyName}
                    onBlur={e => setForm({ ...form, companyName: formatProperNameFinal(e.target.value) })}
                    onChange={e => setForm({ ...form, companyName: formatProperName(e.target.value) })}
                      onFocus={e => {
                        const el = e.target;
                        setTimeout(() => {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                      }}
                      onKeyUp={e => { if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.focus(); } }}
                      inputMode="text"
                      enterKeyHint="next"
                      className="h-16 rounded-xl text-lg placeholder:text-black/35"
                    />
                  </div>
                )}

                <div>
                  <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Full Name *</label>
                  <Input
                    ref={nameRef}
                    name="name"
                    id="mobile-name"
                    autoComplete="name"
                    placeholder="Your full name"
                    required
                    value={form.name}
                    onBlur={e => setForm({ ...form, name: formatProperNameFinal(e.target.value) })}
                    onChange={e => setForm({ ...form, name: formatProperName(e.target.value) })}
                    onFocus={e => {
                      const el = e.target;
                      setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 300);
                    }}
                    onKeyUp={e => { if (e.key === "Enter") { e.preventDefault(); phoneRef.current?.focus(); } }}
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
                    name="tel"
                    id="mobile-phone"
                    autoComplete="tel"
                    placeholder="(555) 555-5555"
                    required
                    maxLength={14}
                    value={form.phone}
                    onChange={e => {
                      const formatted = formatPhone(e.target.value);
                      setForm({ ...form, phone: formatted });
                      if (formatted.length >= 14) {
                        setTimeout(() => {
                          const emailInput = document.getElementById('mobile-email')?.querySelector('input') 
                            ?? document.getElementById('mobile-email') as HTMLInputElement;
                          emailInput?.focus();
                        }, 50);
                      }
                    }}
                    onFocus={e => {
                      const el = e.target;
                      setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 300);
                    }}
                    onKeyUp={e => { if (e.key === "Enter") { e.preventDefault(); emailRef.current?.focus(); } }}
                    inputMode="tel"
                    enterKeyHint="next"
                    className="h-16 rounded-xl text-lg placeholder:text-black/35"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Email *</label>
                  <EmailInput
                    id="mobile-email"
                    name="email"
                    value={form.email}
                    onChange={v => setForm({ ...form, email: formatEmail(v) })}
                    onBlur={v => setForm({ ...form, email: formatEmail(v) })}
                    required
                    className="h-16 rounded-xl text-lg placeholder:text-black/35"
                    onFocus={e => {
                      const el = e.target;
                      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                    }}
                  />
                </div>

                {/* Notes — collapsed toggle */}
                {!showNotes ? (
                  <button type="button" onClick={() => setShowNotes(true)} className="font-body text-sm text-primary hover:underline">+ Add delivery instructions</button>
                ) : (
                  <div>
                    <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Delivery Instructions</label>
                    <Textarea
                      name="notes"
                      id="mobile-notes"
                      autoComplete="off"
                      placeholder="Gate code, landmark, or special instructions..."
                      maxLength={275}
                      rows={2}
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: formatSentence(e.target.value) })}
                      onFocus={e => {
                        const el = e.target;
                        setTimeout(() => {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                      }}
                      className="rounded-xl text-lg placeholder:text-black/35"
                    />
                    <p className="font-body text-xs text-right mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {form.notes.length}/275
                    </p>
                  </div>
                )}
                </div>
              </form>

              {/* Disclaimer + checkbox in styled container */}
              <div className="rounded-2xl p-4 mt-3 mb-4" style={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
                <p className="font-body text-xs font-semibold mb-2" style={{ color: '#0D2137' }}>
                  BEFORE YOU ORDER
                </p>
                <p className="font-body text-xs leading-relaxed" style={{ color: '#4B5563' }}>
                  Curbside only. No private property entry. Customer must ensure clear site access. WAYS® Materials LLC not liable for damage to driveways or landscaping. Customer must be present at delivery.
                </p>
                {(paymentMethod === 'cash' || paymentMethod === 'check') && (
                  <p className="font-body text-xs leading-relaxed mt-2" style={{ color: '#4B5563' }}>
                    <strong style={{ color: '#0D2137' }}>COD Payment:</strong> Cash or check due at delivery. No partial payments. No card payments at door.
                  </p>
                )}
                <div className="flex items-start gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <input
                    type="checkbox"
                    checked={deliveryTermsAccepted}
                    onChange={e => setDeliveryTermsAccepted(e.target.checked)}
                    style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#0D2137', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <p className="font-body text-sm" style={{ color: '#0D2137' }}>
                    I agree to the{' '}
                    <button type="button" onClick={() => setShowTermsModal(true)} className="underline font-semibold" style={{ color: 'hsl(var(--accent))' }}>
                      delivery terms
                    </button>
                  </p>
                </div>
              </div>

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

        {/* ── DELIVERY TERMS MODAL ── */}
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto" style={{ backgroundColor: 'white' }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-xl" style={{ color: '#0D2137' }}>DELIVERY TERMS</h3>
                <button onClick={() => setShowTermsModal(false)} className="text-gray-400 text-xl">✕</button>
              </div>
              <div className="font-body text-sm text-gray-600 space-y-3">
                <p>• Curbside delivery only — curb to sidewalk/driveway edge. No private property entry.</p>
                <p>• Customer must ensure clear, accessible delivery area before arrival.</p>
                <p>• WAYS® Materials LLC not liable for damage to driveways, landscaping, or property.</p>
                <p>• Customer or representative must be present at delivery.</p>
                <p>• Photo proof of completion at delivery serves as final confirmation of fulfillment.</p>
                <p>• Same-day orders subject to dispatch confirmation within 30 minutes.</p>
                <p>• {paymentMethod === "stripe-link" ? "Cancel anytime before your driver is on route — you will not be charged. Once your driver is on route, your delivery is confirmed and non-refundable." : "Cancel anytime before your driver is on route. Your order will simply be removed — no payment was collected."}</p>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full h-12 rounded-2xl font-display text-lg mt-6"
                style={{ backgroundColor: '#0D2137', color: 'white' }}
              >
                CLOSE
              </button>
            </div>
          </div>
        )}

        {/* ── SCREEN 4: SUCCESS ── */}
        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            {verifyingPayment ? (
              <div className="flex-1 flex flex-col bg-primary items-center justify-center px-6 py-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-accent mb-6" />
                <h2 className="font-display text-2xl text-primary-foreground tracking-wider mb-2">Confirming Payment...</h2>
                <p className="font-body text-sm text-primary-foreground/60">This usually takes a few seconds.</p>
              </div>
            ) : (
              <OrderConfirmation
                orderNumber={orderNumber}
                address={address}
                deliveryDateLabel={selectedDeliveryDate ? `${selectedDeliveryDate.label} ${selectedDeliveryDate.dateStr}` : ""}
                quantity={quantity}
                paymentMethod={paymentMethod}
                codSubOption={codSubOption}
                stripePaymentId={stripePaymentId}
                customerName={form.name}
                customerEmail={form.email}
                customerPhone={form.phone}
                companyName={form.companyName || undefined}
                pricingMode={pricingMode}
                confirmedTotals={confirmedTotals ? {
                  totalPrice: confirmedTotals.total - (confirmedTotals.processingFee || 0),
                  totalWithProcessingFee: confirmedTotals.total,
                  processingFee: confirmedTotals.processingFee,
                  taxAmount: confirmedTotals.tax,
                  subtotal: confirmedTotals.total - confirmedTotals.tax - (confirmedTotals.processingFee || 0),
                  saturdaySurchargeTotal: confirmedTotals.saturdaySurcharge,
                  distanceFee: confirmedTotals.distanceFee,
                  taxInfo,
                } : null}
                totalPrice={totalPrice}
                totalWithProcessingFee={totalWithProcessingFee}
                processingFee={processingFee}
                taxAmount={taxAmount}
                saturdaySurchargeTotal={saturdaySurchargeTotal}
                taxInfo={taxInfo}
                basePricePerLoad={isBaked
                  ? Math.round((result?.price ?? effectivePricing.base_price) * 1.035)
                  : effectivePricing.base_price}
                distanceFee={isBaked
                  ? 0
                  : (result ? Math.max(0, Math.round((result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * 100) / 100) * quantity : 0)}
                onDownloadInvoice={handleDownloadInvoice}
                downloadingInvoice={downloadingInvoice}
                canDownload={!!confirmedOrderId}
                confirmedOrderId={confirmedOrderId}
                lookupToken={lookupToken}
              />
            )}
          </motion.div>
        )}

      </AnimatePresence>
      <OutOfAreaModal
        open={showOutOfAreaModal}
        onClose={() => setShowOutOfAreaModal(false)}
        address={outOfAreaAddress}
        distanceMiles={outOfAreaDistance}
        nearestPit={nearestPitInfo}
        calculatedPrice={null}
      />
      <AddressMismatchDialog
        data={mismatchData}
        onUseResolved={handleMismatchUseResolved}
        onKeepTyped={handleMismatchKeepTyped}
        onChangeAddress={handleMismatchChange}
      />
    </div>
  );
};

export default OrderMobile;
