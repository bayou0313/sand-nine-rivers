import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { updateSession, initSession, getSessionToken } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2, User, Phone, Mail, FileText, CreditCard, ArrowLeft, Lock, Banknote, CalendarDays, Clock, ExternalLink, Minus, Plus, Package, ShieldCheck } from "lucide-react";
import OrderConfirmation from "@/components/OrderConfirmation";
import { useCountdown } from "@/hooks/use-countdown";
import { formatPhone, formatCurrency, getTaxRateFromAddress, getParishFromPlaceResult, getTaxRateByParish, LA_STATE_TAX_RATE } from "@/lib/format";
import { formatProperName, formatProperNameFinal, formatSentence, formatEmail } from "@/lib/textFormat";
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
import { loadCart, clearCart } from "@/lib/cart";

import DeliveryDatePicker, { type DeliveryDate, type PitSchedule, SATURDAY_SURCHARGE, getEffectiveSaturdaySurcharge, getEffectiveSundaySurcharge } from "@/components/DeliveryDatePicker";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import RefundPolicyModal from "@/components/RefundPolicyModal";
import logoImg from "@/assets/riversand-logo.png";
import { type PitData, type GlobalPricing, type FindBestPitResult, findBestPitDriving, findAllPitDistances, getEffectivePrice, calcPitPrice, parseGlobalSettings, FALLBACK_GLOBAL_PRICING } from "@/lib/pits";
import PlaceAutocompleteInput, { getPlaceInputValue, type PlaceSelectResult, type AddressMismatchData } from "@/components/PlaceAutocompleteInput";
import AddressMismatchDialog from "@/components/AddressMismatchDialog";

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
  billedDistance?: number;
  price: number;
  address: string;
  duration: string;
  isNorthshore?: boolean;
};

type PaymentMethodType = "stripe-link" | "cash" | "check" | null;

// Legacy types kept for cart restoration compatibility
export type WeekendPitEntry = {
  pit: PitData;
  distance: number;
  price: number;
  schedule: PitSchedule;
  satSurcharge: number;
  sunSurcharge: number;
};
export type WeekendPitMap = Partial<Record<0 | 6, WeekendPitEntry>>;

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
  const [step, setStep] = useState<"address" | "details" | "success">("address");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [formAttempted, setFormAttempted] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState("");
  const { loaded: apiLoaded } = useGoogleMaps();
  const addressContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic pricing from global_settings + PITs
  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL_PRICING);
  const [allPits, setAllPits] = useState<PitData[]>([]);
  const [matchedPit, setMatchedPit] = useState<PitData | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [pricingMode, setPricingMode] = useState<"transparent" | "baked">("baked");

  // Per-date pit assignment: all pits with distances, sorted closest-first
  const [allPitDistances, setAllPitDistances] = useState<FindBestPitResult[]>([]);
  const [weekdayPit, setWeekdayPit] = useState<PitData | null>(null);
  const [weekdayResult, setWeekdayResult] = useState<EstimateResult | null>(null);
  const [weekdayPitSchedule, setWeekdayPitSchedule] = useState<PitSchedule | null>(null);

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
        supabase.from("pits").select("id, name, address, lat, lon, status, base_price, free_miles, price_per_extra_mile, max_distance, operating_days, saturday_surcharge_override, same_day_cutoff, sunday_surcharge").eq("status", "active"),
      ]);
      if (settingsRes.data) {
        const gp = parseGlobalSettings(settingsRes.data as any);
        setGlobalPricing(gp);
        setGlobalSaturdaySurcharge(gp.saturday_surcharge);
        const modeRow = (settingsRes.data as any[]).find((r: any) => r.key === "pricing_mode");
        if (modeRow?.value === "baked") setPricingMode("baked");
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
  const [showRefundPolicy, setShowRefundPolicy] = useState(false);
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
    sundaySurchargeTotal: number;
    distanceFee: number;
    taxInfo: { rate: number; parish: string };
  } | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [deliveryTermsAccepted, setDeliveryTermsAccepted] = useState(false);
  const [codPaymentConfirmed, setCodPaymentConfirmed] = useState(false);
  const [cardAuthAccepted, setCardAuthAccepted] = useState(false);

  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<DeliveryDate | null>(null);
  const [dateError, setDateError] = useState("");

  const qtyParam = parseInt(searchParams.get("quantity") || searchParams.get("qty") || "1", 10);
  const discountParam = parseFloat(searchParams.get("discount") || "0");
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(10, isNaN(qtyParam) ? 1 : qtyParam)));
  const [discountAmount] = useState(isNaN(discountParam) ? 0 : Math.max(0, discountParam));

  const [form, setForm] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [detectedParish, setDetectedParish] = useState<string | null>(null);

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
  const effectiveDiscount = result ? Math.min(discountAmount * quantity, result.price * quantity) : 0;
  const isBaked = pricingMode === "baked";
  const isCOD = paymentMethod === "cash" || paymentMethod === "check";
  // In baked mode, everyone pays the same price — no COD discount
  const subtotal = result ? (result.price * quantity) + saturdaySurchargeTotal + sundaySurchargeTotal - effectiveDiscount : 0;
  const taxAmount = parseFloat((subtotal * taxInfo.rate).toFixed(2));
  const totalPrice = parseFloat((subtotal + taxAmount).toFixed(2));
  const processingFee = !isBaked && totalPrice > 0
    ? parseFloat((totalPrice * PROCESSING_FEE_RATE + PROCESSING_FEE_FIXED).toFixed(2))
    : 0;
  const totalWithProcessingFee = parseFloat((totalPrice + processingFee).toFixed(2));

  // Auto-switch to card-only on weekend dates
  const isWeekendDate = selectedDeliveryDate?.isSaturday || selectedDeliveryDate?.isSunday;
  useEffect(() => {
    if (isWeekendDate && paymentMethod !== "stripe-link") {
      setPaymentMethod("stripe-link");
    }
  }, [isWeekendDate]);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Helper: verify Stripe payment via get-order-status before showing success
  // Returns the full order data object on success, or null on failure
  const verifyStripePayment = useCallback(async (orderId: string, token: string): Promise<any | null> => {
    const MAX_ATTEMPTS = 8;
    const POLL_INTERVAL = 2500;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        console.log(`[Order] Payment verification attempt ${i + 1}/${MAX_ATTEMPTS} for order ${orderId}`);
        const { data, error } = await supabase.functions.invoke("get-order-status", {
          body: { order_id: orderId, lookup_token: token },
        });
        console.log(`[Order] get-order-status response:`, { payment_status: data?.payment_status, has_address: !!data?.delivery_address, error });
        if (!error && ["paid", "authorized", "captured"].includes(data?.payment_status)) {
          return data; // Return the full order data
        }
        console.log(`[Order] Payment verification attempt ${i + 1}/${MAX_ATTEMPTS}: status=${data?.payment_status || "unknown"}`);
      } catch (err) {
        console.warn(`[Order] Payment verification attempt ${i + 1} error:`, err);
      }
      if (i < MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    }
    return null;
  }, []);

  // Handle lookup token (shared order link)
  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) return;

    (async () => {
      try {
        const { data: order, error } = await supabase.functions.invoke("get-order-status", {
          body: { lookup_token: tokenParam },
        });

        if (error || !order || order.error) {
          console.error("[token-lookup] Order not found:", error || order?.error);
          return;
        }

        setStep("success");
        const orderTaxRate = Number(order.tax_rate) || 0;
        const orderTaxAmount = Number(order.tax_amount) || 0;
        const orderSatSurcharge = Number(order.saturday_surcharge_amount) || 0;
        const isStripe = order.payment_method ? !["cash", "check", "cod", "COD"].includes(order.payment_method) : false;
        const orderProcessingFee = isStripe
          ? parseFloat(((Number(order.price) || 0) / 1.035 * 0.035).toFixed(2))
          : 0;
        const orderTotalWithFee = Number(order.price) || 0;
        const orderTotalWithoutFee = isStripe
          ? parseFloat((orderTotalWithFee - orderProcessingFee).toFixed(2))
          : orderTotalWithFee;
        const orderSubtotal = orderTotalWithoutFee - orderTaxAmount;
        const orderParish = order.delivery_address ? getTaxRateFromAddress(order.delivery_address).parish : "";
        setConfirmedTotals({
          totalPrice: orderTotalWithoutFee,
          totalWithProcessingFee: orderTotalWithFee,
          processingFee: orderProcessingFee,
          taxAmount: orderTaxAmount,
          subtotal: orderSubtotal,
          saturdaySurchargeTotal: orderSatSurcharge,
          sundaySurchargeTotal: Number(order.sunday_surcharge_amount) || 0,
          distanceFee: 0,
          taxInfo: { rate: orderTaxRate, parish: orderParish },
        });
        setAddress(order.delivery_address || "");
        setPendingOrderId(order.id);
        setOrderNumber(order.order_number || null);
        setLookupToken(order.lookup_token || tokenParam);
        setConfirmedOrderId(order.id);
        setPaymentMethod(order.payment_method || "stripe-link");
        if (order.delivery_date) {
          const d = new Date(order.delivery_date + "T12:00:00");
          const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
          const shortDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          setSelectedDeliveryDate({
            date: d,
            label: shortDays[d.getDay()],
            dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
            isSameDay: false,
            isSaturday: d.getDay() === 6,
            isSunday: d.getDay() === 0,
            iso: order.delivery_date,
            dayOfWeek: dayNames[d.getDay()],
          });
        }
      } catch (err) {
        console.error("[token-lookup] Error:", err);
      }
    })();
  }, []);

  // Handle Stripe return via URL params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (!paymentStatus) return;

    const returnedOrderNumber = searchParams.get("order_number");
    const returnedSessionId = searchParams.get("session_id");
    const returnedOrderId = searchParams.get("order_id");
    const returnMode = searchParams.get("return_mode");

    if (returnMode === "popup") {
      // This is the Stripe return tab — signal the original page and close
      const signal = JSON.stringify({
        type: "stripe-payment-result",
        status: paymentStatus,
        order_number: returnedOrderNumber || "",
        order_id: returnedOrderId || "",
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
      if (returnedSessionId) setStripePaymentId(returnedSessionId.slice(-12));

      // Try to get order_id and lookup_token for verification
      let verifyOrderId = returnedOrderId || pendingOrderId || null;
      let verifyToken = lookupToken || null;

      // Check sessionStorage snapshot for lookup_token if not in memory
      if (!verifyToken || !verifyOrderId) {
        try {
          const raw = sessionStorage.getItem("pending_order_snapshot");
          if (raw) {
            const snap = JSON.parse(raw);
            if (!verifyOrderId) verifyOrderId = snap.pendingOrderId || null;
            if (!verifyToken) verifyToken = snap.lookupToken || null;
          }
        } catch {}
      }
      // Restore to React state so handleDownloadInvoice can use them
      if (verifyToken) setLookupToken(verifyToken);
      if (verifyOrderId) setConfirmedOrderId(verifyOrderId);

      // Show verifying state while we confirm with backend
      setVerifyingPayment(true);
      setStep("success");
      clearCart();

      const showSuccess = (orderData?: any) => {
        setVerifyingPayment(false);
        if (orderData) {
          setAddress(orderData.delivery_address || address);
          setForm(prev => ({
            ...prev,
            name: orderData.customer_name || prev.name,
            phone: orderData.customer_phone || prev.phone,
            email: orderData.customer_email || prev.email,
            companyName: orderData.company_name || prev.companyName,
          }));
          setQuantity(orderData.quantity || 1);
          if (orderData.delivery_date) {
            const d = new Date(orderData.delivery_date + "T00:00:00");
            const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            const shortDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            setSelectedDeliveryDate({
              date: d,
              label: shortDays[d.getDay()],
              dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              fullLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
              iso: orderData.delivery_date,
              dayOfWeek: orderData.delivery_day_of_week || dayNames[d.getDay()],
              isSaturday: orderData.saturday_surcharge || false,
              isSunday: orderData.sunday_surcharge || false,
              isSameDay: orderData.same_day_requested || false,
            });
          }
          setPaymentMethod((orderData.payment_method as PaymentMethodType) || "stripe-link");
          const orderTaxRate = orderData.tax_rate || 0;
          const orderTaxAmount = orderData.tax_amount || 0;
          const orderSatSurcharge = orderData.saturday_surcharge_amount || 0;
          const isStripe = orderData.payment_method === "stripe-link";
          const orderProcessingFee = isStripe
            ? parseFloat((orderData.price / 1.035 * 0.035).toFixed(2))
            : 0;
          const orderTotalWithFee = orderData.price;
          const orderTotalWithoutFee = isStripe
            ? parseFloat((orderData.price - orderProcessingFee).toFixed(2))
            : orderData.price;
          const orderSubtotal = orderTotalWithoutFee - orderTaxAmount;
          setConfirmedTotals({
            totalPrice: orderTotalWithoutFee,
            totalWithProcessingFee: orderTotalWithFee,
            processingFee: orderProcessingFee,
            taxAmount: orderTaxAmount,
            subtotal: orderSubtotal,
            saturdaySurchargeTotal: orderSatSurcharge,
            sundaySurchargeTotal: orderData.sunday_surcharge_amount || 0,
            distanceFee: 0,
            taxInfo: { rate: orderTaxRate, parish: orderData.delivery_address ? getTaxRateFromAddress(orderData.delivery_address).parish : "" },
          });
          if (orderData.distance_miles) {
            setResult({
              distance: orderData.distance_miles,
              price: orderTotalWithoutFee / (orderData.quantity || 1),
              address: `${orderData.distance_miles.toFixed(1)} miles away`,
              duration: "",
            });
          }
      } else if (returnedOrderNumber) {
          // Live state was wiped by Stripe redirect — fetch order via edge function (bypasses RLS)
          (async () => {
            try {
              // Try to get lookup token + order_id from sessionStorage snapshot
              let fallbackLookupToken: string | null = null;
              let fallbackOrderId: string | null = null;
              try {
                const snapRaw = sessionStorage.getItem("pending_order_snapshot");
                if (snapRaw) {
                  const snap = JSON.parse(snapRaw);
                  fallbackLookupToken = snap.lookupToken || null;
                  fallbackOrderId = snap.pendingOrderId || null;
                }
              } catch {}

              console.log("[showSuccess fallback] snapshot:", { fallbackOrderId, fallbackLookupToken: !!fallbackLookupToken });

              if (fallbackLookupToken && fallbackOrderId) {
                // Use edge function with service role access
                const { data: fallbackOrder, error: fallbackErr } = await supabase.functions.invoke("get-order-status", {
                  body: { order_id: fallbackOrderId, lookup_token: fallbackLookupToken },
                });
                if (!fallbackErr && fallbackOrder && fallbackOrder.price > 0) {
                  setConfirmedOrderId(fallbackOrder.id);
                  showSuccess(fallbackOrder);
                  return;
                }
              }

              // Legacy fallback — direct query (may fail for anon users due to RLS)
              const { data: fallbackOrder } = await supabase
                .from("orders")
                .select("*")
                .eq("order_number", returnedOrderNumber)
                .single();
              if (fallbackOrder && fallbackOrder.price > 0) {
                setConfirmedOrderId(fallbackOrder.id);
                showSuccess(fallbackOrder);
                return;
              }
            } catch {}
            // Final fallback — use live state if available
            if (totalPrice > 0 && address) {
              setConfirmedTotals({
                totalPrice,
                totalWithProcessingFee,
                processingFee,
                taxAmount,
                subtotal,
                saturdaySurchargeTotal,
                sundaySurchargeTotal,
                distanceFee: result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0,
                taxInfo,
              });
            }
          })();
        }
        toast({
          title: "Payment successful",
          description: returnedOrderNumber
            ? `Order ${returnedOrderNumber} is confirmed.`
            : "Your payment was completed successfully.",
        });
        // Fire GA4 purchase event for Stripe card orders (idempotent per order_number).
        const purchaseOrderNum = orderData?.order_number || returnedOrderNumber;
        firePurchaseTrackingRef.current(purchaseOrderNum, "stripe-link", orderData);
      };

      // Verify payment with backend
      if (verifyOrderId && verifyToken) {
        verifyStripePayment(verifyOrderId, verifyToken).then(async (orderData) => {
          if (orderData) {
            // Payment confirmed — use the data returned from get-order-status
            console.log("[Order] Payment verified, got order data from edge function:", orderData.order_number);
            setConfirmedOrderId(orderData.id || verifyOrderId);
            if (orderData.stripe_payment_id) {
              setStripePaymentId(orderData.stripe_payment_id.slice(-12));
            }
            showSuccess(orderData);
          } else {
            // Verification timed out — show cautious success with warning
            console.warn("[Order] Payment verification timed out — showing success with caveat");
            showSuccess();
            toast({
              title: "Payment processing",
              description: "Your payment is being processed. You'll receive a confirmation email shortly.",
            });
          }
        });
      } else if (returnedOrderNumber) {
        // No lookup token available — fetch order directly (legacy fallback)
        (async () => {
          try {
            const { data: order } = await supabase
              .from("orders")
              .select("*")
              .eq("order_number", returnedOrderNumber)
              .single();
            if (order) {
              setConfirmedOrderId(order.id);
              showSuccess(order);
            } else {
              showSuccess();
            }
          } catch (err) {
            console.error("[Order] Failed to fetch order for confirmation:", err);
            showSuccess();
          }
        })();
      } else {
        showSuccess();
      }
      return;
    }

    if (paymentStatus === "canceled") {
      console.log("[cancel] totalPrice:", totalPrice, "address:", address);
      // If we still have in-memory state, just go back to confirm step
      if (totalPrice > 0 && address) {
        setStep("details");
      } else {
        // Page reloaded from Stripe redirect — restore from sessionStorage snapshot
        try {
          const raw = sessionStorage.getItem("pending_order_snapshot");
          console.log("[cancel] snapshot found:", !!raw);
          console.log("[cancel] snapshot content:", raw);
          if (raw) {
            const snap = JSON.parse(raw);
            setAddress(snap.address || "");
            setForm(snap.form || { name: "", phone: "", email: "", notes: "" });
            setQuantity(snap.quantity || 1);
            setPendingOrderId(snap.pendingOrderId || null);
            setOrderNumber(snap.orderNumber || null);
            setLookupToken(snap.lookupToken || null);
            setPaymentMethod(snap.paymentMethod || "stripe-link");
            if (snap.selectedDeliveryDate) {
              setSelectedDeliveryDate(snap.selectedDeliveryDate);
            }
            if (snap.result) {
              setResult(snap.result);
            }
            setStep("details");
            // Clean up after restore
            sessionStorage.removeItem("pending_order_snapshot");
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
  }, [searchParams, toast, verifyStripePayment]);

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
          if (signal.session_id) setStripePaymentId(signal.session_id.slice(-12));
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
            sundaySurchargeTotal: (snap as any).sundaySurchargeTotal || 0,
            distanceFee: snap.result ? Math.max(0, (snap.result.distance - snap.effectivePricing.free_miles) * snap.effectivePricing.extra_per_mile * snap.quantity) : 0,
            taxInfo: snap.taxInfo,
          });

          // Show verifying state, then verify payment
          setVerifyingPayment(true);
          setStep("success");
          clearCart();

          const verifyOrderId = snap.pendingOrderId || signal.order_id || null;
          const verifyToken = snap.lookupToken || null;
          // Restore to React state so handleDownloadInvoice can use them
          if (verifyToken) setLookupToken(verifyToken);
          if (verifyOrderId) setConfirmedOrderId(verifyOrderId);

          if (verifyOrderId && verifyToken) {
            verifyStripePayment(verifyOrderId, verifyToken).then((verified) => {
              setVerifyingPayment(false);
              if (verifyOrderId) setConfirmedOrderId(verifyOrderId);
              updateSession({
                stage: "completed_order",
                order_id: signal.order_number || null,
                order_number: signal.order_number || null,
              });
              // Fire GA4 purchase event for Stripe card orders (idempotent per order_number).
              const purchaseOrderNum = verified?.order_number || signal.order_number;
              firePurchaseTrackingRef.current(purchaseOrderNum, "stripe-link", verified);
              if (verified) {
                toast({
                  title: "Payment successful",
                  description: signal.order_number
                    ? `Order ${signal.order_number} is confirmed.`
                    : "Your payment was completed successfully.",
                });
              } else {
                toast({
                  title: "Payment processing",
                  description: "Your payment is being processed. You'll receive a confirmation email shortly.",
                });
              }
            });
          } else {
            // No verification possible — show success (legacy path)
            setVerifyingPayment(false);
            if (snap.pendingOrderId) setConfirmedOrderId(snap.pendingOrderId);
            updateSession({
              stage: "completed_order",
              order_id: signal.order_number || null,
              order_number: signal.order_number || null,
            });
            sendOrderEmailRef.current(signal.order_number || null, "stripe-link", "paid", signal.session_id || null);
            // Fire GA4 purchase event for Stripe card orders (idempotent per order_number).
            firePurchaseTrackingRef.current(signal.order_number, "stripe-link");
            toast({
              title: "Payment successful",
              description: signal.order_number
                ? `Order ${signal.order_number} is confirmed.`
                : "Your payment was completed successfully.",
            });
          }
        } else if (signal.status === "canceled") {
          setStep("details");
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
  }, [toast, verifyStripePayment]);

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

  // Forward-declared ref for purchase tracking helper. Real implementation is
  // assigned below (after `detectedZip` state is declared). Stripe success
  // handlers in the useEffect blocks above can call this via the ref.
  const firePurchaseTrackingRef = useRef<(orderNum: string | null | undefined, paymentMethod: string, orderData?: any) => void>(() => {});

  // Snapshot of current pricing state for cross-tab handler
  const pricingSnapshotRef = useRef({
    totalPrice, totalWithProcessingFee, processingFee, taxAmount, subtotal,
    saturdaySurchargeTotal, taxInfo, result, effectivePricing, quantity,
    address, selectedDeliveryDate, form, paymentMethod, pendingOrderId, lookupToken,
  });
  useEffect(() => {
    pricingSnapshotRef.current = {
      totalPrice, totalWithProcessingFee, processingFee, taxAmount, subtotal,
      saturdaySurchargeTotal, taxInfo, result, effectivePricing, quantity,
      address, selectedDeliveryDate, form, paymentMethod, pendingOrderId, lookupToken,
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

      // Read pit schedule params from URL (passed by estimator)
      const paramOpDays = searchParams.get("operating_days");
      const paramSatSurcharge = searchParams.get("sat_surcharge");
      const paramSameDayCutoff = searchParams.get("same_day_cutoff");
      const paramPitId = searchParams.get("pit_id");
      const paramPitName = searchParams.get("pit_name");
      if (paramOpDays || paramSatSurcharge || paramSameDayCutoff) {
        const paramSunSurcharge = searchParams.get("sun_surcharge");
        setMatchedPitSchedule({
          operating_days: paramOpDays ? paramOpDays.split(",").map(Number) : null,
          saturday_surcharge_override: paramSatSurcharge != null ? Number(paramSatSurcharge) : null,
          sunday_surcharge: paramSunSurcharge != null ? Number(paramSunSurcharge) : null,
          same_day_cutoff: paramSameDayCutoff || null,
        });
      }
      // Restore matched pit from URL params so date-based recalc works
      if (paramPitId && allPits.length > 0) {
        const pit = allPits.find(p => p.id === paramPitId);
        if (pit) setMatchedPit(pit);
      } else if (paramPitId && paramPitName) {
        // Pits not loaded yet — set a stub that will be replaced when allPits loads
        setMatchedPit({ id: paramPitId, name: decodeURIComponent(paramPitName), lat: 0, lon: 0, status: "active", base_price: null, free_miles: null, price_per_extra_mile: null, max_distance: null, operating_days: paramOpDays ? paramOpDays.split(",").map(Number) : null, saturday_surcharge_override: paramSatSurcharge != null ? Number(paramSatSurcharge) : null, same_day_cutoff: paramSameDayCutoff || null, sunday_surcharge: null } as PitData);
      }

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
    } else if (!searchParams.get("payment")) {
      // No URL params at all — try restoring from cart
      const savedCart = loadCart();
      if (savedCart) {
        setAddress(savedCart.address);
        setResult({
          distance: savedCart.distance,
          price: savedCart.price,
          address: `${savedCart.distance} miles away`,
          duration: "~30 min",
        });
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
          setMatchedPit({ id: savedCart.pitId, name: savedCart.pitName, address: "", lat: 0, lon: 0, status: "active", base_price: null, free_miles: null, price_per_extra_mile: null, max_distance: null, operating_days: savedCart.operatingDays.length > 0 ? savedCart.operatingDays : null, saturday_surcharge_override: savedCart.satSurcharge || null, same_day_cutoff: savedCart.sameDayCutoff || null, sunday_surcharge: null } as PitData);
        }
        setStep("details");
      }
    }
  }, [searchParams]);

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
   * Idempotency: each event is guarded by sessionStorage keyed by the visitor's
   * session token so refresh, back/forward, or remount won't double-fire.
   * `add_payment_info` re-fires when the user switches payment method (key
   * includes the method) — this matches GA4's expectation of one event per
   * distinct selection.
   */
  useEffect(() => {
    if (step !== "details" || !result || !matchedPit) return;
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


  const handleOrderPlaceSelect = useCallback((result: PlaceSelectResult) => {
    setAddress(result.formattedAddress);
    setCustomerCoords({ lat: result.lat, lng: result.lng });
    if (result.addressComponents) {
      const parish = getParishFromPlaceResult(result.addressComponents);
      setDetectedParish(parish);
      const zipComponent = result.addressComponents.find(
        (c: any) => c.types.includes('postal_code')
      );
      setDetectedZip(zipComponent?.short_name || '');
    }
  }, []);

  const handleAddressMismatch = useCallback((data: AddressMismatchData) => {
    setMismatchData(data);
  }, []);

  const handleMismatchUseResolved = useCallback(() => {
    if (!mismatchData) return;
    handleOrderPlaceSelect({
      formattedAddress: mismatchData.resolved,
      lat: mismatchData.lat,
      lng: mismatchData.lng,
      addressComponents: mismatchData.addressComponents,
    });
    const input = addressContainerRef.current?.querySelector("input");
    if (input) input.value = mismatchData.resolved;
    setMismatchData(null);
  }, [mismatchData, handleOrderPlaceSelect]);

  const handleMismatchKeepTyped = useCallback(() => {
    if (!mismatchData) return;
    handleOrderPlaceSelect({
      formattedAddress: mismatchData.typed,
      lat: mismatchData.lat,
      lng: mismatchData.lng,
      addressComponents: mismatchData.addressComponents,
    });
    setMismatchData(null);
  }, [mismatchData, handleOrderPlaceSelect]);

  const handleMismatchChange = useCallback(() => {
    setMismatchData(null);
    setAddress("");
    setCustomerCoords(null);
    const input = addressContainerRef.current?.querySelector("input");
    if (input) { input.value = ""; input.focus(); }
  }, []);

  // URL params flow: resolve allPitDistances when address is set via URL params
  const pitDistancesResolvedRef = useRef(false);
  useEffect(() => {
    if (pitDistancesResolvedRef.current) return;
    if (allPits.length === 0 || !address || !result || !matchedPit) return;
    if (allPitDistances.length > 0) return; // already resolved

    const resolveDistances = async (customerAddr: string) => {
      pitDistancesResolvedRef.current = true;
      setWeekdayPit(matchedPit);
      setWeekdayResult(result);
      setWeekdayPitSchedule(matchedPitSchedule);
      const distances = await findAllPitDistances(allPits, customerAddr, globalPricing, supabase, detectedZip);
      setAllPitDistances(distances);
    };

    if (customerCoords) {
      resolveDistances(address);
      return;
    }
    // URL params flow — no coords, need to geocode
    if (!window.google?.maps?.Geocoder) return;
    pitDistancesResolvedRef.current = true;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: any, status: any) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setCustomerCoords({ lat, lng });
        resolveDistances(address);
      }
    });
  }, [allPits, address, result, matchedPit, customerCoords, apiLoaded]);

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
      // Default to Monday (1) for initial price calc — excludes Saturday-only pits
      const bestResult = await findBestPitDriving(allPits, currentAddress, globalPricing, supabase, 1, detectedZip);
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
      const weekdaySchedule: PitSchedule = {
        operating_days: bestResult.pit.operating_days,
        saturday_surcharge_override: bestResult.pit.saturday_surcharge_override != null ? Number(bestResult.pit.saturday_surcharge_override) : null,
        sunday_surcharge: bestResult.pit.sunday_surcharge != null ? Number(bestResult.pit.sunday_surcharge) : null,
        same_day_cutoff: bestResult.pit.same_day_cutoff,
      };
      setMatchedPit(bestResult.pit);
      setMatchedPitSchedule(weekdaySchedule);

      // Stash weekday values for restore when switching back from weekend
      const weekdayResultObj: EstimateResult = {
        distance: parseFloat(bestResult.distance.toFixed(1)),
        billedDistance: bestResult.billedDistance,
        price: bestResult.price,
        address: `${bestResult.distance.toFixed(1)} mi away`,
        duration: "~30 min",
        isNorthshore: bestResult.isNorthshore,
      };
      setWeekdayPit(bestResult.pit);
      setWeekdayResult(weekdayResultObj);
      setWeekdayPitSchedule(weekdaySchedule);

      // Resolve all pit distances for per-date assignment
      findAllPitDistances(allPits, currentAddress, globalPricing, supabase, detectedZip)
        .then(distances => setAllPitDistances(distances))
        .catch(() => setAllPitDistances([]));

      setResult({
        distance: parseFloat(bestResult.distance.toFixed(1)),
        billedDistance: bestResult.billedDistance,
        price: bestResult.price,
        address: `${bestResult.distance.toFixed(1)} mi away`,
        duration: "~30 min",
        isNorthshore: bestResult.isNorthshore,
      });
      setStep("details");
      // begin_checkout now fires from a useEffect when the user enters the
      // details step with valid context (see effect below). This catches both
      // the address-completion path and cart-restored mounts.
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


  const buildOrderData = () => {
    const distFee = result && effectivePricing
      ? Math.max(0, Math.round((result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * 100) / 100)
      : 0;
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
      card_authorization_accepted: cardAuthAccepted,
      card_authorization_timestamp: cardAuthAccepted ? new Date().toISOString() : null,
      company_name: form.companyName.trim() || null,
      base_unit_price: effectivePricing.base_price,
      distance_fee: distFee * quantity,
      processing_fee: 0,
      ...(leadReference ? { lead_reference: leadReference } : {}),
    };
  };

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
        sundaySurchargeTotal,
        distanceFee: result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0,
        taxInfo,
      };
      setConfirmedTotals(snapshotTotals);
      setStep("success");
      clearCart();
      firePurchaseTracking(inserted?.order_number, codSubOption);
      updateSession({
        stage: "completed_order",
        order_id: inserted?.id || null,
        order_number: inserted?.order_number || null,
      });

      // Fire-and-forget new order notification
      supabase.functions.invoke("leads-auth", {
        body: {
          action: "notify_new_order",
          customer_name: form.name,
          payment_method: codSubOption,
          delivery_address: address,
          order_id: inserted?.id,
        },
      }).catch(() => {});

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
      const stripeTotal = isBaked ? totalPrice : totalWithProcessingFee;
      const orderData = {
        ...buildOrderData(),
        payment_method: "stripe-link",
        payment_status: "pending",
        price: stripeTotal,
        processing_fee: isBaked ? 0 : processingFee,
      };
      const { data: rpcResult, error: insertError } = await supabase.rpc("create_order", {
        p_data: orderData,
      });

      if (insertError) throw insertError;
      const insertedOrder = rpcResult as any;

      const isEmbedded = window.self !== window.top;
      const description = isBaked
        ? `River Sand Delivery — ${quantity} load${quantity > 1 ? "s" : ""} × 9 cu yds`
        : `River Sand Delivery — ${quantity} load${quantity > 1 ? "s" : ""} × 9 cu yds (incl. 3.5% processing fee)`;
      const { data, error } = await supabase.functions.invoke("create-checkout-link", {
        body: {
          amount: Math.round(stripeTotal * 100),
          description,
          customer_name: form.name.trim(),
          customer_email: form.email.trim() || null,
          order_id: insertedOrder?.id,
          order_number: insertedOrder?.order_number,
          origin_url: window.location.origin,
          return_mode: isEmbedded ? "popup" : "redirect",
          same_day_requested: selectedDeliveryDate?.isSameDay || false,
          delivery_date: selectedDeliveryDate?.iso || null,
        },
      });

      if (error || !data?.url) {
        throw new Error(data?.error || error?.message || "Failed to create payment link");
      }

      // Fire-and-forget new order notification
      supabase.functions.invoke("leads-auth", {
        body: {
          action: "notify_new_order",
          customer_name: form.name,
          payment_method: "stripe-link",
          delivery_address: address,
          order_id: insertedOrder?.id,
        },
      }).catch(() => {});

      // Store order ID and token for DB polling
      setPendingOrderId(insertedOrder?.id || null);
      setLookupToken(insertedOrder?.lookup_token || null);

      // Track stripe link click for hot-path abandonment emails
      await updateSession({ stripe_link_clicked: true, stripe_link_clicked_at: new Date().toISOString() });

      // Save order state to sessionStorage (survives same-tab cross-origin redirects, isolated per tab)
      try {
        sessionStorage.setItem("pending_order_snapshot", JSON.stringify({
          address,
          form,
          quantity,
          selectedDeliveryDate,
          paymentMethod: "stripe-link",
          pendingOrderId: insertedOrder?.id || null,
          orderNumber: insertedOrder?.order_number || null,
          lookupToken: insertedOrder?.lookup_token || null,
          result,
          totalPrice,
          totalWithProcessingFee,
          processingFee,
          taxAmount,
          subtotal,
          saturdaySurchargeTotal,
          sundaySurchargeTotal,
          taxInfo,
        }));
        console.log("[checkout] snapshot saved:", !!sessionStorage.getItem("pending_order_snapshot"));
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
      toast({ title: "Unable to view", description: "Order information not available.", variant: "destructive" });
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
      // Open in new tab for viewing/printing instead of triggering download
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Failed to open invoice", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const stepLabels = ["Delivery Details", "Payment"];

  const isFormValid = selectedDeliveryDate && form.name.trim() && form.phone.trim() && form.email.trim();

  useEffect(() => {
    if (isFormValid) setFormAttempted(false);
  }, [isFormValid]);

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
      <span className={`font-body ${small ? "text-sm" : "text-base"} ${destructive ? "text-destructive" : small ? "text-muted-foreground/70" : "text-muted-foreground"} leading-relaxed`}>{label}</span>
      <span className={`${bold ? "font-display text-lg" : small ? "font-body text-sm text-muted-foreground/70" : "font-display text-base"} ${destructive ? "text-destructive" : accent ? "text-primary" : bold ? "text-primary" : "text-foreground"}`}>{value}</span>
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
    <div className={`min-h-screen ${step === "success" ? "bg-[#F9FAFB]" : "bg-gradient-to-b from-background via-muted/30 to-background"}`}>
      {/* Minimal header bar — logo + phone */}
      {step !== "success" && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-16 px-6 flex items-center justify-between">
          <Link to="/">
            <img
              src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png"
              alt="RiverSand"
              className="h-12"
            />
          </Link>
          {/* Stepper — center */}
          <div className="hidden sm:flex items-center gap-3">
            {stepLabels.map((label, i) => {
              const stepIndex = ["address", "details"].indexOf(step);
              const isActive = i <= stepIndex;
              const isCurrent = i === stepIndex;
              const isCompleted = i < stepIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-display text-[10px] transition-all ${
                      isCompleted ? "bg-primary text-primary-foreground"
                      : isCurrent ? "bg-accent text-accent-foreground ring-2 ring-accent/30 ring-offset-1 ring-offset-background"
                      : "bg-muted text-muted-foreground/40 border border-border"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </motion.div>
                    <span className={`font-body text-xs whitespace-nowrap ${
                      isCurrent ? "text-foreground font-semibold" : isActive ? "text-foreground/60" : "text-muted-foreground/40"
                    }`}>{label}</span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className="w-8 h-0.5 bg-border rounded-full overflow-hidden">
                      <div className={`h-full bg-accent rounded-full transition-all duration-500 ${isActive && i < stepIndex ? "w-full" : "w-0"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <a href="tel:+18554689297" className="flex items-center gap-1.5 font-display text-sm tracking-wider text-accent hover:text-accent/80 transition-colors">
            <Phone className="w-4 h-4" />
            1-855-GOT-WAYS
          </a>
        </div>
      )}

      <div className={`container mx-auto px-4 ${step === "success" ? "pt-0 pb-0" : "pt-24 pb-8 md:pt-28 md:pb-12"}`}>
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


        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* STEP 1: Address */}
            {step === "address" && (
              <motion.div key="address" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="bg-background rounded-2xl p-6 md:p-8 border border-border/50 shadow-lg shadow-foreground/5">
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
                        onAddressMismatch={handleAddressMismatch}
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
                  <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }} whileTap={{ y: 0 }}>
                    <Button data-calc-btn onClick={calculateDistance} disabled={loading || !customerCoords} className="w-full h-14 font-display tracking-wider text-lg rounded-xl shadow-md hover:shadow-lg transition-shadow disabled:opacity-40 disabled:cursor-not-allowed">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" /> GET DELIVERY PRICE</>}
                    </Button>
                  </motion.div>
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
              <motion.div key="details" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="space-y-4">
                {/* Compact delivery confirmation banner */}
                 <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-display text-sm tracking-wider text-primary block">DELIVERY CONFIRMED</span>
                      <span className="font-body text-xs text-muted-foreground block truncate">{address.length > 45 ? address.slice(0, 42) + "…" : address}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display text-2xl text-primary">{formatCurrency(result.price)}</span>
                    <span className="text-[10px] font-body text-muted-foreground block">/load</span>
                    <span className="text-xs font-body text-muted-foreground">{quantity} load{quantity > 1 ? "s" : ""} · {formatCurrency(totalPrice)} total</span>
                  </div>
                </motion.div>
                {/* Change address link */}
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body flex items-center gap-1 mt-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Change delivery address
                </button>

                {/* Quantity selector in confirmation bar */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center gap-4 bg-primary/5 border border-primary/10 rounded-xl px-5 py-3"
                >
                  <span className="font-body text-sm text-muted-foreground">Loads:</span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/80 transition-colors font-bold text-lg"
                  >
                    −
                  </motion.button>
                  <span className="font-display text-xl text-foreground w-8 text-center">{quantity}</span>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/80 transition-colors font-bold text-lg"
                  >
                    +
                  </motion.button>
                  <span className="font-body text-sm text-muted-foreground">× 9 cu yds</span>
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
                      onPitAssigned={(pit) => {
                        // Find the full PitData from allPitDistances
                        const pitDist = allPitDistances.find(pd => pd.pit.id === pit.id);
                        const fullPit = pitDist?.pit || pit;
                        const schedule: PitSchedule = {
                          operating_days: fullPit.operating_days,
                          saturday_surcharge_override: fullPit.saturday_surcharge_override != null ? Number(fullPit.saturday_surcharge_override) : null,
                          sunday_surcharge: fullPit.sunday_surcharge != null ? Number(fullPit.sunday_surcharge) : null,
                          same_day_cutoff: fullPit.same_day_cutoff,
                        };
                        setMatchedPit(fullPit as PitData);
                        setMatchedPitSchedule(schedule);
                        if (pitDist) {
                          const effective = getEffectivePrice(fullPit as PitData, globalPricing);
                          const price = calcPitPrice(effective, pitDist.distance, 1);
                          setResult(prev => prev ? {
                            ...prev,
                            distance: parseFloat(pitDist.distance.toFixed(1)),
                            price,
                            address: `${pitDist.distance.toFixed(1)} mi away`,
                          } : prev);
                          if (weekdayPit && fullPit.id !== weekdayPit.id) {
                            toast({ title: "Price updated for this delivery date", description: `Delivering from ${fullPit.name}.` });
                          }
                        }
                      }}
                      pitSchedule={matchedPitSchedule}
                      globalSaturdaySurcharge={globalSaturdaySurcharge}
                      pitId={matchedPit?.id}
                      allPitDistances={allPitDistances}
                    />
                    {recalculating && (
                      <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <p className="font-body text-sm">Recalculating price for this date…</p>
                      </div>
                    )}
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
                    <p className="text-xs text-muted-foreground mb-3 -mt-1">Enter your delivery contact details. Our driver will call 30 minutes before arrival.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="order-name" className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Name *</label>
                        <Input id="order-name" name="name" autoComplete="name" placeholder="Your full name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: formatProperName(e.target.value) })} onBlur={(e) => setForm({ ...form, name: formatProperNameFinal(e.target.value) })} className={`h-[52px] rounded-lg text-base ${formAttempted && !form.name.trim() ? "border-destructive border-2" : ""}`} />
                      </div>
                      <div>
                        <label htmlFor="order-company" className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block">Company Name</label>
                        <Input id="order-company" name="companyName" autoComplete="organization" placeholder="Optional" maxLength={100} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: formatProperName(e.target.value) })} onBlur={(e) => setForm({ ...form, companyName: formatProperNameFinal(e.target.value) })} className="h-[52px] rounded-lg text-base" />
                      </div>
                      <div>
                        <label htmlFor="order-phone" className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone *</label>
                        <Input id="order-phone" name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" required maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className={`h-[52px] rounded-lg text-base ${formAttempted && !form.phone.trim() ? "border-destructive border-2" : ""}`} />
                      </div>
                      <div>
                        <label htmlFor="order-email" className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block">Email *</label>
                        <EmailInput id="order-email" name="email" value={form.email} onChange={(v) => setForm({ ...form, email: formatEmail(v) })} required className={`h-[52px] rounded-lg text-base ${formAttempted && !form.email.trim() ? "border-destructive border-2" : ""}`} />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="order-notes" className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block">Delivery Instructions</label>
                        <Textarea id="order-notes" name="notes" placeholder="Gate code, landmark, or special drop-off instructions for the driver..." maxLength={275} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: formatSentence(e.target.value) })} className="rounded-lg text-base" />
                        <p className="text-xs text-muted-foreground mt-1 text-right font-body">{form.notes.length}/275</p>
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
                      <ReceiptRow label={`Base delivery × ${quantity}`} value={formatCurrency((result?.price ?? effectivePricing.base_price) * quantity)} />
                      {result.distance > effectivePricing.free_miles && (
                        <>
                          <div className="border-b border-dashed border-border" />
                          <ReceiptRow label={`Extra Mile Fee (${Math.round(result.distance - effectivePricing.free_miles)} mi beyond service area) × ${quantity}`} value={`+${formatCurrency((result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity)}`} />
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
                          <ReceiptRow label={`Saturday Surcharge ($${effectiveSatSurcharge} × ${quantity})`} value={`+${formatCurrency(saturdaySurchargeTotal)}`} destructive />
                        </>
                      )}

                      {selectedDeliveryDate.isSunday && sundaySurchargeTotal > 0 && (
                        <>
                          <div className="border-b border-dashed border-border" />
                          <ReceiptRow label={`Sunday Delivery Fee ($${effectiveSunSurcharge} × ${quantity})`} value={`+${formatCurrency(sundaySurchargeTotal)}`} destructive />
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
                        {selectedDeliveryDate.isSunday && sundaySurchargeTotal > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="font-body text-muted-foreground">Sunday delivery fee</span>
                            <span className="font-display text-foreground">+{formatCurrency(sundaySurchargeTotal)}</span>
                          </div>
                        )}
                        {(() => {
                          const stateTaxAmt = Math.round((taxAmount / (taxInfo.rate || 1)) * LA_STATE_TAX_RATE * 100) / 100;
                          const parishTaxAmt = Math.round((taxAmount - stateTaxAmt) * 100) / 100;
                          const parishLocalRate = taxInfo.rate - LA_STATE_TAX_RATE;
                          return (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="font-body text-muted-foreground">Louisiana State Tax ({(LA_STATE_TAX_RATE * 100).toFixed(2)}%)</span>
                                <span className="font-display text-foreground">+{formatCurrency(stateTaxAmt)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="font-body text-muted-foreground">{taxInfo.parish} Tax ({(parishLocalRate * 100).toFixed(2)}%)</span>
                                <span className="font-display text-foreground">+{formatCurrency(parishTaxAmt)}</span>
                              </div>
                            </>
                          );
                        })()}
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
                  <div className="p-6 space-y-4">
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
                        <p className="font-display text-base text-foreground tracking-wider">PAY NOW</p>
                        <p className="font-body text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Secure Stripe Checkout
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => !isWeekendDate && setPaymentMethod("cash")}
                        disabled={!!isWeekendDate}
                        className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                          isWeekendDate
                            ? "border-border bg-muted/50 opacity-60 cursor-not-allowed"
                            : paymentMethod === "cash" || paymentMethod === "check"
                            ? "border-accent bg-accent/5 shadow-lg shadow-accent/15"
                            : "border-border bg-card hover:border-accent/40 hover:shadow-md"
                        }`}
                      >
                        {(paymentMethod === "cash" || paymentMethod === "check") && !isWeekendDate && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-accent-foreground" />
                          </motion.div>
                        )}
                        <Banknote className={`w-6 h-6 mb-2 ${!isWeekendDate && (paymentMethod === "cash" || paymentMethod === "check") ? "text-accent" : "text-muted-foreground"}`} />
                        <p className={`font-display text-base tracking-wider ${isWeekendDate ? "text-muted-foreground" : "text-foreground"}`}>PAY AT DELIVERY</p>
                        {isWeekendDate ? (
                          <p className="font-body text-xs text-amber-600 mt-1">Not available for weekend delivery</p>
                        ) : (
                          <p className="font-body text-xs text-muted-foreground mt-1">💵 Cash or Check</p>
                        )}
                      </button>
                    </div>

                    {/* Policy notice: PAY NOW — card-only info (total shown below) */}
                    <AnimatePresence mode="wait">
                    {paymentMethod === "stripe-link" && (
                      <motion.div
                        key="stripe-policy"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                          <p className="font-body text-sm text-blue-900 leading-relaxed flex items-start gap-2">
                            <CreditCard className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
                            Secure card payment via Stripe. You'll be redirected to complete payment.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Policy notice: PAY AT DELIVERY */}
                    {(paymentMethod === "cash" || paymentMethod === "check") && (
                      <motion.div
                        key="cod-policy"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
                          <p className="font-display text-xs tracking-wider text-amber-900">PAY AT DELIVERY</p>
                          <p className="font-body text-sm text-amber-800 leading-relaxed">
                            {`Cash or check accepted on arrival. If payment cannot be collected, a secure card payment link will be sent.`}
                          </p>
                        </div>
                      </motion.div>
                    )}
                    </AnimatePresence>

                    {/* Order Total Summary — always visible when payment method selected */}
                    {paymentMethod && result && (
                      <motion.div
                        key={`total-${paymentMethod}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-card border border-border rounded-xl p-4 space-y-2"
                      >
                        <div className="flex justify-between font-body text-sm">
                          <span className="text-muted-foreground">Order Total</span>
                          <span className="text-foreground font-medium">{formatCurrency(totalPrice)}</span>
                        </div>
                        {isBaked ? (
                          <>
                            <div className="border-t border-border pt-2 flex justify-between">
                              <span className="font-display tracking-wider text-foreground">TOTAL DUE</span>
                              <span className="font-display text-lg font-bold text-foreground">{formatCurrency(totalPrice)}</span>
                            </div>
                          </>
                        ) : paymentMethod === "stripe-link" ? (
                          <>
                            <div className="flex justify-between font-body text-sm">
                              <span className="text-muted-foreground">Card Processing Fee (3.5% + $0.30/txn)</span>
                              <span className="text-foreground font-medium">+{formatCurrency(processingFee)}</span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between">
                              <span className="font-display tracking-wider text-foreground">TOTAL CHARGE</span>
                              <span className="font-display text-lg font-bold text-foreground">{formatCurrency(totalWithProcessingFee)}</span>
                            </div>
                            <p style={{ fontSize: "11px", color: "#888888", marginTop: "3px", marginBottom: "0" }}>
                              ⓘ Processing fees are charged by our payment provider and are non-refundable.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between font-body text-sm">
                              <span className="text-muted-foreground">Processing Fee</span>
                              <span className="text-green-600 font-medium">$0.00 — Waived</span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between">
                              <span className="font-display tracking-wider text-foreground">TOTAL DUE</span>
                              <span className="font-display text-lg font-bold text-foreground">{formatCurrency(totalPrice)}</span>
                            </div>
                            <p className="font-body text-xs text-muted-foreground">
                              Cash or check accepted at delivery
                            </p>
                          </>
                        )}
                      </motion.div>
                    )}

                    {!paymentMethod && (
                      <p className="font-body text-xs text-muted-foreground text-center">Select a payment method to continue.</p>
                    )}

                    {/* Delivery Terms — required for ALL orders */}
                    {paymentMethod && (
                      <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
                        <p className="font-display text-xs tracking-wider text-foreground">DELIVERY TERMS</p>
                        <div className="space-y-1.5">
                          <p className="font-body text-xs text-foreground font-medium">📍 Delivering to: {address}</p>
                          <p className="font-body text-xs text-muted-foreground">• Delivery is curbside only — material will be placed between the curb and the nearest accessible driveway or sidewalk area</p>
                          <p className="font-body text-xs text-muted-foreground">• Driver will not enter private property under any circumstances</p>
                          <p className="font-body text-xs text-muted-foreground">• Customer must ensure a clear, safe, and accessible delivery area prior to arrival</p>
                          <p className="font-body text-xs text-muted-foreground">• WAYS® Materials LLC is not responsible for damage to driveways, landscaping, vehicles, or any private property during delivery</p>
                          <p className="font-body text-xs text-muted-foreground">• Customer or a designated representative is recommended to be present at the time of delivery</p>
                          <p className="font-body text-xs text-muted-foreground">• If no one is present, delivery will be completed based on instructions provided at checkout or communicated directly to the driver. By providing such instructions, the customer accepts full responsibility for the placement of materials</p>
                          <p className="font-body text-xs text-muted-foreground">• A photo will be taken at the time of delivery as proof of completion. This photo will serve as confirmation that the order was delivered according to the provided instructions</p>
                          <p className="font-body text-xs text-muted-foreground">• Same-day orders are subject to availability and dispatch confirmation</p>
                          <p className="font-body text-xs text-muted-foreground">• Cancellation Policy — {paymentMethod === "stripe-link" ? "Cancel anytime before your driver is on route — you will not be charged. Once your driver is on route, your delivery is confirmed and non-refundable." : "Cancel anytime before your driver is on route. Your order will simply be removed — no payment was collected."} <button type="button" onClick={() => setShowRefundPolicy(true)} className="text-primary underline hover:opacity-80 transition-opacity">See full refund policy</button></p>
                        </div>
                        <p className="font-display text-xs tracking-wider text-foreground pt-2">Customer Acknowledgment</p>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deliveryTermsAccepted}
                            onChange={(e) => {
                              setDeliveryTermsAccepted(e.target.checked);
                              if (paymentMethod && paymentMethod !== "stripe-link") {
                                setCodPaymentConfirmed(e.target.checked);
                              }
                            }}
                            className="mt-0.5 w-4 h-4 rounded accent-primary"
                          />
                          <span className="font-body text-xs text-foreground leading-relaxed">
                            I agree to the delivery terms and cancellation policy. {paymentMethod === "stripe-link" ? "I understand that once my driver is on route, my delivery is confirmed and non-refundable." : "I understand that I may cancel anytime before my driver is on route."}
                            {" "}I also acknowledge that if I am not present at the time of delivery, the order will be completed based on my provided instructions, and I accept full responsibility for the delivery location and outcome.
                            {" "}I understand that a photo will be taken upon delivery as proof of completion, and I accept this as confirmation that the service has been fulfilled.
                            {paymentMethod !== "stripe-link" && " I confirm that payment is due at delivery."}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* PAY / PLACE ORDER Button */}
                  {paymentMethod && (
                    <div className="px-6 pb-6 space-y-3 relative">
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
                      <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px rgba(0,0,0,0.15)" }} whileTap={{ y: 0 }}>
                        <Button
                          onClick={() => {
                            if (!isFormValid) { setFormAttempted(true); return; }
                            (paymentMethod === "stripe-link" ? handleStripeLink : handleCodSubmit)();
                          }}
                          disabled={submitting || !deliveryTermsAccepted || (paymentMethod !== "stripe-link" && !codPaymentConfirmed)}
                          className="w-full h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 rounded-2xl shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-300 disabled:opacity-40"
                        >
                          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            paymentMethod === "stripe-link"
                              ? <><Lock className="w-4 h-4 mr-2" /> PAY {formatCurrency(isBaked ? totalPrice : totalWithProcessingFee)}</>
                              : <><CheckCircle2 className="w-4 h-4 mr-2" /> PLACE ORDER — {formatCurrency(totalPrice)}</>
                          )}
                        </Button>
                      </motion.div>
                      {!isFormValid && (
                        <p className="font-body text-xs text-destructive text-center">
                          {!selectedDeliveryDate ? "Please select a delivery date above." : "Please fill in all required fields above."}
                        </p>
                      )}
                      <p className="font-body text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> 256-bit SSL encryption • Your data is protected
                      </p>
                      {paymentMethod === "stripe-link" && (
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <svg className="w-3 h-3 text-muted-foreground/60" viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-7.076-2.19L3.312 21.98C5.263 23.171 8.26 24 11.342 24c2.589 0 4.758-.631 6.299-1.828 1.667-1.301 2.487-3.155 2.487-5.516 0-4.096-2.535-5.772-6.152-7.206z"/></svg>
                          <span className="font-body text-[10px] text-muted-foreground/60">Powered by Stripe</span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

              </motion.div>
            )}

            {/* SUCCESS — Full Confirmation Page */}
            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                {verifyingPayment ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Confirming your payment...</h2>
                    <p className="text-muted-foreground text-sm text-center max-w-md">
                      We're verifying your payment with our processor. This usually takes just a few seconds.
                    </p>
                  </div>
                ) : (
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
                  companyName={form.companyName}
                  confirmedTotals={confirmedTotals}
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
                    : (result ? Math.max(0, (result.distance - effectivePricing.free_miles) * effectivePricing.extra_per_mile * quantity) : 0)}
                  onDownloadInvoice={handleDownloadInvoice}
                  downloadingInvoice={downloadingInvoice}
                  canDownload={!!confirmedOrderId}
                  confirmedOrderId={confirmedOrderId}
                  lookupToken={lookupToken}
                  pricingMode={pricingMode}
                />
                )}
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
      calculatedPrice={null}
    />
    <RefundPolicyModal open={showRefundPolicy} onClose={() => setShowRefundPolicy(false)} pricingMode={pricingMode} />
    <AddressMismatchDialog
      data={mismatchData}
      onUseResolved={handleMismatchUseResolved}
      onKeepTyped={handleMismatchKeepTyped}
      onChangeAddress={handleMismatchChange}
    />
  </>
  );
};

export default Order;
