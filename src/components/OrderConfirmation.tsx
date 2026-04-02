import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Loader2, Download, ChevronDown, MessageCircle, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, LA_STATE_TAX_RATE } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LOGO_WHITE =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";
const LOGO_BLACK =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png";
const WAYS_LOGO =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO___-__WHITE.png.png";

const SERVED_CITIES: { name: string; slug: string }[] = [
  { name: "New Orleans", slug: "new-orleans-la" },
  { name: "Metairie", slug: "metairie-la" },
  { name: "Kenner", slug: "kenner-la" },
  { name: "Chalmette", slug: "chalmette-la" },
  { name: "Gretna", slug: "gretna-la" },
  { name: "Harvey", slug: "harvey-la" },
  { name: "Westwego", slug: "westwego-la" },
  { name: "Slidell", slug: "slidell-la" },
  { name: "Belle Chasse", slug: "belle-chasse-la" },
  { name: "Marrero", slug: "marrero-la" },
  { name: "Terrytown", slug: "terrytown-la" },
  { name: "Arabi", slug: "arabi-la" },
  { name: "Harahan", slug: "harahan-la" },
  { name: "River Ridge", slug: "river-ridge-la" },
  { name: "Elmwood", slug: "elmwood-la" },
  { name: "Avondale", slug: "avondale-la" },
];

const DELIVERY_TERMS = [
  {
    title: "Curbside Delivery Only",
    body: "All deliveries are placed curbside — between the curb and the nearest sidewalk or driveway edge. Drivers will not place material on lawns, driveways, or any private surface.",
  },
  {
    title: "Accessible Delivery Area",
    body: "Customer must ensure a clear and accessible delivery area before the driver arrives. Obstructions such as parked cars, fences, or overhanging branches may prevent delivery.",
  },
  {
    title: "Liability",
    body: "WAYS® Materials LLC is not responsible for damage to driveways, landscaping, vehicles, or any private property. By placing an order you accept full responsibility for the delivery site.",
  },
  {
    title: "Customer Presence",
    body: "Customer or a designated representative must be present at the time of delivery. If no one is available the driver may leave the material at the curbside location.",
  },
  {
    title: "Same-Day Orders",
    body: "Same-day delivery requests are subject to availability and confirmation by our dispatch team. We will call you to confirm scheduling.",
  },
  {
    title: "Cancellation Policy",
    body: "Orders canceled a day before scheduled delivery will be refunded in full. Processing fees are non-refundable.",
  },
];

/* ── Animated SVG Checkmark ── */
const AnimatedCheckmark = () => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}
  >
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <motion.circle
        cx="40"
        cy="40"
        r="36"
        stroke="#16A34A"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      />
      <motion.path
        d="M24 42 L35 53 L56 28"
        stroke="#16A34A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.9, ease: "easeOut" }}
      />
    </svg>
  </motion.div>
);

/* ── Stagger wrapper ── */
const FadeIn = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export interface OrderConfirmationProps {
  orderNumber: string | null;
  address: string;
  deliveryDateLabel: string;
  quantity: number;
  paymentMethod: string | null;
  codSubOption: "cash" | "check";
  stripePaymentId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string;
  confirmedTotals: {
    totalPrice: number;
    totalWithProcessingFee: number;
    processingFee: number;
    taxAmount: number;
    subtotal: number;
    saturdaySurchargeTotal: number;
    distanceFee: number;
    taxInfo: { rate: number; parish: string };
  } | null;
  /* fallbacks from live state */
  totalPrice: number;
  totalWithProcessingFee: number;
  processingFee: number;
  taxAmount: number;
  saturdaySurchargeTotal: number;
  taxInfo: { rate: number; parish: string };
  basePricePerLoad: number;
  distanceFee: number;
  onDownloadInvoice: () => void;
  downloadingInvoice: boolean;
  canDownload: boolean;
}

export default function OrderConfirmation({
  orderNumber,
  address,
  deliveryDateLabel,
  quantity,
  paymentMethod,
  codSubOption,
  stripePaymentId,
  customerName,
  customerEmail,
  customerPhone,
  companyName,
  confirmedTotals: dt,
  totalPrice,
  totalWithProcessingFee,
  processingFee,
  taxAmount,
  saturdaySurchargeTotal,
  taxInfo,
  basePricePerLoad,
  distanceFee: fallbackDistanceFee,
  onDownloadInvoice,
  downloadingInvoice,
  canDownload,
}: OrderConfirmationProps) {
  const { toast } = useToast();
  const [showWhatsAppChoice, setShowWhatsAppChoice] = useState(false);

  const isStripePaid =
    paymentMethod === "stripe-link" || stripePaymentId != null;

  const displayTotal = dt?.totalPrice ?? totalPrice;
  const displayTotalWithFee =
    dt?.totalWithProcessingFee ?? totalWithProcessingFee;
  const displayTaxAmount = dt?.taxAmount ?? taxAmount;
  const displaySatSurcharge =
    dt?.saturdaySurchargeTotal ?? saturdaySurchargeTotal;
  const displayProcessingFee = dt?.processingFee ?? processingFee;
  const displayTaxInfo = dt?.taxInfo ?? taxInfo;
  const displayDistanceFee = dt?.distanceFee ?? fallbackDistanceFee;

  const finalAmount = isStripePaid ? displayTotalWithFee : displayTotal;
  const orderDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const shareText = `River Sand Order ${orderNumber || ""} — ${quantity} load${quantity > 1 ? "s" : ""} to ${address}. ${deliveryDateLabel}. Total: ${formatCurrency(finalAmount)}`;

  const handleMailtoClick = () => {
    const subject = `River Sand Order ${orderNumber || ""}`;
    const body = `Order: ${orderNumber || "N/A"}\nDelivery: ${address}\nDate: ${deliveryDateLabel}\nQuantity: ${quantity} load${quantity > 1 ? "s" : ""}\nTotal: ${formatCurrency(finalAmount)}\n\nQuestions? Call 1-855-GOT-WAYS`;
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement("a");
    a.href = href;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleForwardByEmail = () => {
    const subject = `River Sand Order ${orderNumber || ""} — Order Details`;
    const body = `Here are the details for my River Sand order:\n\nOrder: ${orderNumber || "N/A"}\nCustomer: ${customerName}\nDelivery: ${address}\nDate: ${deliveryDateLabel}\nQuantity: ${quantity} load${quantity > 1 ? "s" : ""}\nTotal: ${formatCurrency(finalAmount)}\nPayment: ${isStripePaid ? "Paid by Card" : `${codSubOption === "check" ? "Check" : "Cash"} — Due at Delivery`}\n\nQuestions? Call 1-855-GOT-WAYS or email orders@riversand.net`;
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement("a");
    a.href = href;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWhatsApp = () => {
    setShowWhatsAppChoice(true);
  };

  const sendWhatsAppApp = () => {
    setShowWhatsAppChoice(false);
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    try {
      const a = document.createElement("a");
      a.href = url;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Fallback after timeout — if app didn't open, try web
      setTimeout(() => {
        // Can't reliably detect if it opened, so we don't auto-fallback here
      }, 1500);
    } catch {
      sendWhatsAppWeb();
    }
  };

  const sendWhatsAppWeb = () => {
    setShowWhatsAppChoice(false);
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    const win = window.open(url, "_blank");
    if (!win) {
      // Clipboard fallback
      navigator.clipboard.writeText(shareText).then(() => {
        toast({ title: "Copied to clipboard", description: "Order details copied — paste into WhatsApp." });
      }).catch(() => {});
    }
  };

  return (
    <div className="print-confirmation max-w-[720px] mx-auto my-6 rounded-2xl shadow-lg border border-border/40 overflow-hidden font-body" style={{ backgroundColor: "#FFFFFF" }}>
      {/* ── HEADER ── */}
      <FadeIn delay={0}>
        <div
          className="flex items-center justify-between px-6 py-5 rounded-t-2xl"
          style={{ backgroundColor: "#0D2137" }}
        >
          <Link to="/">
            <img
              src={LOGO_WHITE}
              alt="River Sand"
              className="h-10 object-contain"
            />
          </Link>
          <a
            href="tel:18554689297"
            className="font-display text-sm tracking-wider"
            style={{ color: "#C07A00" }}
          >
            1-855-GOT-WAYS
          </a>
        </div>
      </FadeIn>

      {/* ── HERO STATUS ── */}
      <FadeIn delay={0.15}>
        <div className="bg-white py-10 px-6 flex flex-col items-center text-center">
          {isStripePaid ? <AnimatedCheckmark /> : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#FEF3C7" }}
            >
              <span className="text-3xl font-bold" style={{ color: "#D97706" }}>$</span>
            </motion.div>
          )}

          <h2
            className="mt-5 font-display text-[28px] font-bold tracking-wider"
            style={{ color: "#0D2137" }}
          >
            {isStripePaid ? "Order Confirmed" : "Payment Due at Delivery"}
          </h2>

          <p className="mt-2 text-sm font-body" style={{ color: "#6B7280" }}>
            {orderNumber ? `${orderNumber} · ` : ""}
            {orderDate}
          </p>

          {/* Status pill */}
          <div
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold font-body"
            style={
              isStripePaid
                ? { backgroundColor: "#DCFCE7", color: "#166534" }
                : { backgroundColor: "#FEF3C7", color: "#92400E" }
            }
          >
            {isStripePaid
              ? `Paid in Full — ${formatCurrency(displayTotalWithFee)}`
              : `${formatCurrency(displayTotal)} Due at Delivery`}
          </div>

          {customerEmail && (
            <p className="mt-4 text-xs font-body" style={{ color: "#9CA3AF" }}>
              Confirmation sent to{" "}
              <span className="font-medium" style={{ color: "#374151" }}>
                {customerEmail}
              </span>
            </p>
          )}
        </div>
      </FadeIn>

      {/* ── MAIN CONTENT — two column ── */}
      <FadeIn delay={0.3}>
        <div className="bg-white px-6 pb-8 max-w-[680px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT — DELIVERY */}
            <div className="rounded-xl p-5" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4 font-display"
                style={{ color: "#0D2137" }}
              >
                DELIVERY
              </p>
              <div className="space-y-3">
                <Row label="Address" value={address} />
                <Row label="Date" value={deliveryDateLabel} />
                <Row label="Window" value="8:00 AM – 5:00 PM" />
                <Row
                  label="Product"
                  value={`River Sand — 9 Cubic Yard Load`}
                />
                <Row label="Quantity" value={`${quantity} load${quantity > 1 ? "s" : ""}`} />
              </div>
            </div>

            {/* RIGHT — PAYMENT */}
            <div className="rounded-xl p-5" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4 font-display"
                style={{ color: "#0D2137" }}
              >
                PAYMENT
              </p>
              <div className="space-y-3">
                {isStripePaid ? (
                  <>
                    <Row
                      label="Status"
                      value="Paid in Full"
                      valuePill={{ bg: "#DCFCE7", color: "#166534" }}
                    />
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-body" style={{ color: "#6B7280" }}>
                        Amount
                      </span>
                      <span
                        className="text-xl font-bold font-display"
                        style={{ color: "#C07A00" }}
                      >
                        {formatCurrency(displayTotalWithFee)}
                      </span>
                    </div>
                    <Row label="Method" value="Credit Card" />
                    {stripePaymentId && (
                      <div>
                        <span className="text-xs font-body" style={{ color: "#6B7280" }}>
                          Reference
                        </span>
                        <p
                          className="text-xs font-mono mt-0.5 break-all"
                          style={{ color: "#9CA3AF" }}
                        >
                          {stripePaymentId}
                        </p>
                      </div>
                    )}
                    <p className="text-xs font-body" style={{ color: "#16A34A" }}>
                      Nothing due at delivery
                    </p>
                  </>
                ) : (
                  <>
                    <Row
                      label="Status"
                      value="Due at Delivery"
                      valuePill={{ bg: "#FEF3C7", color: "#92400E" }}
                    />
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-body" style={{ color: "#6B7280" }}>
                        Amount
                      </span>
                      <span
                        className="text-xl font-bold font-display"
                        style={{ color: "#D97706" }}
                      >
                        {formatCurrency(displayTotal)}
                      </span>
                    </div>
                    <Row
                      label="Method"
                      value={codSubOption === "check" ? "Check" : "Cash"}
                    />
                    <p className="text-xs font-body" style={{ color: "#9CA3AF" }}>
                      Please have the exact amount ready — driver carries no change.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── CUSTOMER INFO ── */}
      {(companyName || customerName) && (
        <FadeIn delay={0.35}>
          <div className="bg-white px-6 pb-4 max-w-[680px] mx-auto">
            <div className="rounded-xl p-5" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4 font-display"
                style={{ color: "#0D2137" }}
              >
                CUSTOMER
              </p>
              <div className="space-y-1">
                {companyName && (
                  <p className="text-sm font-bold font-body" style={{ color: "#111827" }}>
                    {companyName}
                  </p>
                )}
                <p
                  className="text-sm font-body"
                  style={{ color: companyName ? "#6B7280" : "#111827" }}
                >
                  {customerName}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── PRICING SUMMARY ── */}
      <FadeIn delay={0.4}>
        <div className="bg-white px-6 pb-8 max-w-[680px] mx-auto">
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3 font-display"
            style={{ color: "#0D2137" }}
          >
            PRICING SUMMARY
          </p>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            <PriceRow
              label={`River Sand (×${quantity} load${quantity > 1 ? "s" : ""})`}
              value={formatCurrency(basePricePerLoad * quantity)}
            />
            {displayDistanceFee > 0 && (
              <PriceRow
                label="Distance fee"
                value={formatCurrency(displayDistanceFee)}
              />
            )}
            {displaySatSurcharge > 0 && (
              <PriceRow
                label="Saturday surcharge"
                value={formatCurrency(displaySatSurcharge)}
              />
            )}
            {displayTaxAmount > 0 && (() => {
              const stateTaxAmt = Math.round((displayTaxAmount / (displayTaxInfo.rate || 1)) * LA_STATE_TAX_RATE * 100) / 100;
              const parishTaxAmt = Math.round((displayTaxAmount - stateTaxAmt) * 100) / 100;
              const parishLocalRate = displayTaxInfo.rate - LA_STATE_TAX_RATE;
              return (
                <>
                  <PriceRow
                    label={`Louisiana State Tax (${(LA_STATE_TAX_RATE * 100).toFixed(2)}%)`}
                    value={formatCurrency(stateTaxAmt)}
                  />
                  <PriceRow
                    label={`${displayTaxInfo.parish} Tax (${(parishLocalRate * 100).toFixed(2)}%)`}
                    value={formatCurrency(parishTaxAmt)}
                  />
                </>
              );
            })()}
            {isStripePaid && (
              <PriceRow
                label="Processing fee"
                value={formatCurrency(displayProcessingFee)}
              />
            )}
          </div>
          <div
            className="flex justify-between items-center pt-4 mt-2"
            style={{ borderTop: "2px solid #E5E7EB" }}
          >
            <span
              className="font-display text-base tracking-wider"
              style={{ color: "#0D2137" }}
            >
              TOTAL
            </span>
            <span
              className="font-display text-2xl font-bold"
              style={{ color: "#C07A00" }}
            >
              {formatCurrency(finalAmount)}
            </span>
          </div>
        </div>
      </FadeIn>

      {/* ── COD PAYMENT POLICY ── */}
      {!isStripePaid && (
        <FadeIn delay={0.45}>
          <div className="px-6 pb-6 max-w-[680px] mx-auto">
            <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: "8px", padding: "20px 24px", marginTop: "8px", marginBottom: "8px" }}>
              <p className="font-display" style={{ fontSize: "11px", fontWeight: "bold", color: "#92400E", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                Payment Due at Delivery
              </p>
              <p className="font-body" style={{ fontSize: "13px", color: "#78350F", lineHeight: "1.6", margin: 0 }}>
                Cash or check payment is due at the time of delivery. If payment cannot be collected at delivery, we will contact you to arrange card payment.
              </p>
              <p className="font-body" style={{ fontSize: "12px", color: "#92400E", marginTop: "8px", marginBottom: 0 }}>
                Note: Card payments include a 3.5% processing fee.
                <br />
                Cash/Check total: <strong>{formatCurrency(displayTotal)}</strong> · Card total if needed: <strong>{formatCurrency(displayTotal * 1.035)}</strong>
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── DELIVERY INSTRUCTIONS ── */}
      <FadeIn delay={0.5}>
        <div className="px-6 pb-6 max-w-[680px] mx-auto">
          <div
            className="rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
            style={{ backgroundColor: "#F8F7F2" }}
          >
            <div>
              <p className="font-bold text-sm mb-3 font-display" style={{ color: "#0D2137" }}>
                What to expect
              </p>
              <ul className="space-y-2 text-sm font-body" style={{ color: "#374151" }}>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Driver calls 30 minutes before arrival</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Ensure clear access to delivery area</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Be present or designate a representative</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Curbside delivery — curb to sidewalk</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-sm mb-3 font-display" style={{ color: "#0D2137" }}>
                Please note
              </p>
              <ul className="space-y-2 text-sm font-body" style={{ color: "#6B7280" }}>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />Driver will not enter private property</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />No delivery into backyards or gated areas</li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />WAYS® Materials LLC not responsible for property damage
                </li>
              </ul>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── DELIVERY TERMS ── */}
      <FadeIn delay={0.55}>
        <div className="px-6 pb-6 max-w-[680px] mx-auto">
          {/* Desktop: always visible */}
          <div className="hidden md:block">
            <p
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3 font-display"
              style={{ color: "#0D2137" }}
            >
              DELIVERY TERMS
            </p>
            <ol className="list-decimal list-inside space-y-3 text-sm font-body" style={{ color: "#6B7280" }}>
              {DELIVERY_TERMS.map((t) => (
                <li key={t.title}>
                  <span className="font-semibold" style={{ color: "#374151" }}>
                    {t.title}
                  </span>{" "}
                  — {t.body}
                </li>
              ))}
            </ol>
          </div>

          {/* Mobile: accordion */}
          <div className="md:hidden">
            <p
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3 font-display"
              style={{ color: "#0D2137" }}
            >
              DELIVERY TERMS
            </p>
            <Accordion type="single" collapsible className="space-y-1">
              {DELIVERY_TERMS.map((t, i) => (
                <AccordionItem key={i} value={`term-${i}`} className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm py-3 hover:no-underline font-body">
                    <span style={{ color: "#374151" }}>
                      {i + 1}. {t.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs pb-2 font-body" style={{ color: "#6B7280" }}>
                      {t.body}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </FadeIn>

      {/* ── ACTION BUTTONS ── */}
      <FadeIn delay={0.6} className="print-hide">
        <div className="px-6 pb-6 max-w-[680px] mx-auto space-y-4">
          <Button
            onClick={onDownloadInvoice}
            disabled={downloadingInvoice || !canDownload}
            variant="outline"
            className="w-full h-12 rounded-xl font-display tracking-wider"
          >
            {downloadingInvoice ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            View Order Details
          </Button>

          {/* WhatsApp share */}
          <div className="relative">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl font-display tracking-wider text-sm"
              onClick={handleWhatsApp}
            >
              <Share2 className="w-4 h-4 mr-2" /> WhatsApp
            </Button>

            {/* WhatsApp choice modal */}
            {showWhatsAppChoice && (
              <div className="absolute bottom-full mb-2 right-0 bg-white rounded-xl shadow-xl border border-border p-3 z-50 w-56">
                <p className="text-xs font-semibold font-display mb-2" style={{ color: "#0D2137" }}>
                  Open with:
                </p>
                <button
                  onClick={sendWhatsAppApp}
                  className="w-full text-left text-sm font-body px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  📱 WhatsApp App
                </button>
                <button
                  onClick={sendWhatsAppWeb}
                  className="w-full text-left text-sm font-body px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  💻 WhatsApp Web
                </button>
                <button
                  onClick={() => setShowWhatsAppChoice(false)}
                  className="w-full text-center text-xs font-body text-muted-foreground mt-1 py-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="text-center space-y-1 pt-2">
            <p className="text-sm font-body" style={{ color: "#6B7280" }}>
              Questions about your order?
            </p>
            <a
              href="tel:18554689297"
              className="font-display text-lg tracking-wider"
              style={{ color: "#C07A00" }}
            >
              1-855-GOT-WAYS
            </a>
            <p className="text-xs font-body" style={{ color: "#9CA3AF" }}>
              orders@riversand.net
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ── AREAS WE SERVE ── */}
      <FadeIn delay={0.65} className="print-hide">
        <div className="px-6 py-8 text-center" style={{ backgroundColor: "#FAFAF8" }}>
          <p
            className="text-[10px] font-bold tracking-[0.25em] uppercase mb-4 font-display"
            style={{ color: "#C07A00" }}
          >
            Same-Day Delivery Available In
          </p>
          <div className="flex flex-wrap justify-center gap-x-1 gap-y-1 max-w-[600px] mx-auto">
            {SERVED_CITIES.map((city, i) => (
              <span key={city.slug}>
                <Link
                  to={`/${city.slug}/river-sand-delivery`}
                  className="text-sm font-body hover:underline transition-colors"
                  style={{ color: "#6B7280" }}
                >
                  {city.name}
                </Link>
                {i < SERVED_CITIES.length - 1 && (
                  <span className="mx-1" style={{ color: "#D1D5DB" }}>
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ── FOOTER ── */}
      <FadeIn delay={0.7} className="print-hide">
        <div
          className="py-10 px-6 flex flex-col items-center text-center rounded-b-2xl"
          style={{ backgroundColor: "#0D2137" }}
        >
          <p
            className="text-[9px] tracking-[0.2em] uppercase mb-2 font-display"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Powered by
          </p>
          <img
            src={WAYS_LOGO}
            alt="WAYS"
            className="w-[80px] opacity-40 mb-4"
          />

          <div
            style={{
              width: 40,
              height: 1,
              backgroundColor: "#C07A00",
              marginBottom: 24,
            }}
          />

          <p
            className="text-xs mb-1 font-body"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            © 2026 Ways Materials LLC
          </p>
          <p
            className="text-xs mb-1 font-body"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            orders@riversand.net · 1-855-GOT-WAYS
          </p>
          <p
            className="text-xs font-body"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            River Sand — Real Sand. Real People.
          </p>
        </div>
      </FadeIn>

      {/* Back to Home — below footer */}
      <div className="text-center py-6 print-hide">
        <Link
          to="/"
          className="text-sm font-body hover:underline"
          style={{ color: "#6B7280" }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

/* ── Helper: detail row ── */
function Row({
  icon,
  label,
  value,
  valuePill,
}: {
  icon?: string;
  label: string;
  value: string;
  valuePill?: { bg: string; color: string };
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-sm shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-body" style={{ color: "#9CA3AF" }}>
          {label}
        </p>
        {valuePill ? (
          <span
            className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 font-body"
            style={{ backgroundColor: valuePill.bg, color: valuePill.color }}
          >
            {value}
          </span>
        ) : (
          <p className="text-sm font-medium break-words font-body" style={{ color: "#111827" }}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Helper: price row ── */
function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3">
      <span className="text-sm font-body" style={{ color: "#6B7280" }}>
        {label}
      </span>
      <span className="text-sm font-medium font-body" style={{ color: "#111827" }}>
        {value}
      </span>
    </div>
  );
}
