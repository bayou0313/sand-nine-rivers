import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Loader2, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LOGO_WHITE =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";
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
  onPrint: () => void;
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
  customerEmail,
  confirmedTotals: dt,
  totalPrice,
  totalWithProcessingFee,
  processingFee,
  taxAmount,
  saturdaySurchargeTotal,
  taxInfo,
  basePricePerLoad,
  distanceFee: fallbackDistanceFee,
  onPrint,
  onDownloadInvoice,
  downloadingInvoice,
  canDownload,
}: OrderConfirmationProps) {
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

  return (
    <div className="print-confirmation">
      {/* ── HEADER ── */}
      <FadeIn delay={0}>
        <div
          className="flex flex-col items-center py-8 rounded-t-2xl"
          style={{ backgroundColor: "#0D2137" }}
        >
          <img
            src={LOGO_WHITE}
            alt="River Sand"
            className="w-[200px] object-contain"
          />
          <div
            className="mt-4"
            style={{
              width: 60,
              height: 2,
              backgroundColor: "#C07A00",
            }}
          />
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

          <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>
            {orderNumber ? `${orderNumber} · ` : ""}
            {orderDate}
          </p>

          {/* Status pill */}
          <div
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
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
            <p className="mt-4 text-xs" style={{ color: "#9CA3AF" }}>
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
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
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
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
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
                      <span className="text-xs" style={{ color: "#6B7280" }}>
                        Amount
                      </span>
                      <span
                        className="text-xl font-bold"
                        style={{ color: "#C07A00" }}
                      >
                        {formatCurrency(displayTotalWithFee)}
                      </span>
                    </div>
                    <Row label="Method" value="Credit Card" />
                    {stripePaymentId && (
                      <div>
                        <span className="text-xs" style={{ color: "#6B7280" }}>
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
                    <p className="text-xs" style={{ color: "#16A34A" }}>
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
                      <span className="text-xs" style={{ color: "#6B7280" }}>
                        Amount
                      </span>
                      <span
                        className="text-xl font-bold"
                        style={{ color: "#D97706" }}
                      >
                        {formatCurrency(displayTotal)}
                      </span>
                    </div>
                    <Row
                      label="Method"
                      value={codSubOption === "check" ? "Check" : "Cash"}
                    />
                    <p className="text-xs" style={{ color: "#D97706" }}>
                      Have exact amount ready
                    </p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      Driver carries no change
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── PRICING SUMMARY ── */}
      <FadeIn delay={0.4}>
        <div className="bg-white px-6 pb-8 max-w-[680px] mx-auto">
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
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
            {displayTaxAmount > 0 && (
              <PriceRow
                label={`${displayTaxInfo.parish} Tax (${(displayTaxInfo.rate * 100).toFixed(2)}%)`}
                value={formatCurrency(displayTaxAmount)}
              />
            )}
            {isStripePaid && (
              <PriceRow
                label="Processing fee (3.5%)"
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

      {/* ── DELIVERY INSTRUCTIONS ── */}
      <FadeIn delay={0.5}>
        <div className="px-6 pb-6 max-w-[680px] mx-auto">
          <div
            className="rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
            style={{ backgroundColor: "#F8F7F2" }}
          >
            <div>
              <p className="font-bold text-sm mb-3" style={{ color: "#0D2137" }}>
                What to expect
              </p>
              <ul className="space-y-2 text-sm" style={{ color: "#374151" }}>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Driver calls 30 minutes before arrival</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Ensure clear access to delivery area</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Be present or designate a representative</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />Curbside delivery — curb to sidewalk</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-sm mb-3" style={{ color: "#0D2137" }}>
                Please note
              </p>
              <ul className="space-y-2 text-sm" style={{ color: "#6B7280" }}>
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
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
              style={{ color: "#0D2137" }}
            >
              DELIVERY TERMS
            </p>
            <ol className="list-decimal list-inside space-y-3 text-sm" style={{ color: "#6B7280" }}>
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
              className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
              style={{ color: "#0D2137" }}
            >
              DELIVERY TERMS
            </p>
            <Accordion type="single" collapsible className="space-y-1">
              {DELIVERY_TERMS.map((t, i) => (
                <AccordionItem key={i} value={`term-${i}`} className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm py-3 hover:no-underline">
                    <span style={{ color: "#374151" }}>
                      {i + 1}. {t.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs pb-2" style={{ color: "#6B7280" }}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={onPrint}
              variant="outline"
              className="h-12 rounded-xl font-display tracking-wider"
            >
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button
              onClick={onDownloadInvoice}
              disabled={downloadingInvoice || !canDownload}
              variant="outline"
              className="h-12 rounded-xl font-display tracking-wider"
            >
              {downloadingInvoice ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download Invoice
            </Button>
          </div>

          <div className="text-center space-y-1 pt-2">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Questions about your order?
            </p>
            <a
              href="tel:18554689297"
              className="font-display text-lg tracking-wider"
              style={{ color: "#C07A00" }}
            >
              1-855-GOT-WAYS
            </a>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              orders@riversand.net
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ── AREAS WE SERVE ── */}
      <FadeIn delay={0.65} className="print-hide">
        <div className="px-6 py-8 text-center" style={{ backgroundColor: "#FAFAF8" }}>
          <p
            className="text-[10px] font-bold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C07A00" }}
          >
            Same-Day Delivery Available In
          </p>
          <div className="flex flex-wrap justify-center gap-x-1 gap-y-1 max-w-[600px] mx-auto">
            {SERVED_CITIES.map((city, i) => (
              <span key={city.slug}>
                <Link
                  to={`/${city.slug}/river-sand-delivery`}
                  className="text-sm hover:underline transition-colors"
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
            className="text-[9px] tracking-[0.2em] uppercase mb-2"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Powered by
          </p>
          <img
            src={WAYS_LOGO}
            alt="WAYS"
            className="w-[80px] opacity-40 mb-1"
          />
          <p
            className="text-[10px] mb-6"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            We Are Your Supply
          </p>

          <div
            style={{
              width: 40,
              height: 1,
              backgroundColor: "#C07A00",
              marginBottom: 24,
            }}
          />

          <p
            className="text-xs mb-1"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            © 2026 Ways Materials LLC
          </p>
          <p
            className="text-xs mb-1"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            orders@riversand.net · 1-855-GOT-WAYS
          </p>
          <p
            className="text-xs"
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
          className="text-sm hover:underline"
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
  icon: string;
  label: string;
  value: string;
  valuePill?: { bg: string; color: string };
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          {label}
        </p>
        {valuePill ? (
          <span
            className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5"
            style={{ backgroundColor: valuePill.bg, color: valuePill.color }}
          >
            {value}
          </span>
        ) : (
          <p className="text-sm font-medium break-words" style={{ color: "#111827" }}>
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
      <span className="text-sm" style={{ color: "#6B7280" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: "#111827" }}>
        {value}
      </span>
    </div>
  );
}
