import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
const LOGO_WHITE =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png";
const WAYS_LOGO =
  "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO___-__WHITE.png.png";

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

interface BrandedConfirmationProps {
  title: string;
  subtitle?: string;
  detail?: string;
  children?: React.ReactNode;
}

export default function BrandedConfirmation({
  title,
  subtitle,
  detail,
  children,
}: BrandedConfirmationProps) {
  return (
    <div className="min-h-screen flex flex-col font-body" style={{ backgroundColor: "#F9FAFB" }}>
      {/* ── HEADER ── */}
      <FadeIn delay={0}>
        <Link
          to="/"
          className="flex flex-col items-center py-8 cursor-pointer"
          style={{ backgroundColor: "#0D2137" }}
        >
          <img
            src={LOGO_WHITE}
            alt="River Sand"
            className="w-[200px] object-contain"
          />
          <div
            className="mt-4"
            style={{ width: 60, height: 2, backgroundColor: "#C07A00" }}
          />
        </Link>
      </FadeIn>

      {/* ── HERO ── */}
      <FadeIn delay={0.15}>
        <div className="bg-white py-10 px-6 flex flex-col items-center text-center">
          <AnimatedCheckmark />

          <h2
            className="mt-5 font-display text-[28px] font-bold tracking-wider"
            style={{ color: "#0D2137" }}
          >
            {title}
          </h2>

          {subtitle && (
            <p className="mt-3 text-base max-w-md" style={{ color: "#6B7280" }}>
              {subtitle}
            </p>
          )}

          {detail && (
            <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>
              {detail}
            </p>
          )}
        </div>
      </FadeIn>

      {/* ── CUSTOM CONTENT ── */}
      {children && (
        <FadeIn delay={0.3}>
          <div className="bg-white px-6 pb-8 max-w-[680px] mx-auto w-full">
            {children}
          </div>
        </FadeIn>
      )}

      {/* ── CTA ── */}
      <FadeIn delay={0.45} className="flex-1 flex flex-col justify-end">
        <div className="px-6 py-8 max-w-[680px] mx-auto w-full text-center space-y-3">
          <p className="text-sm" style={{ color: "#6B7280" }}>
            Questions? We're here to help.
          </p>
          <a
            href="tel:18554689297"
            className="font-display text-lg tracking-wider block"
            style={{ color: "#C07A00" }}
          >
            1-855-GOT-WAYS
          </a>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            orders@riversand.net
          </p>
        </div>

        {/* ── FOOTER ── */}
        <div
          className="py-10 px-6 flex flex-col items-center text-center"
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
            className="w-[80px] opacity-40 mb-4"
          />

          <div
            style={{ width: 40, height: 1, backgroundColor: "#C07A00", marginBottom: 24 }}
          />

          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2026 Ways Materials LLC
          </p>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>
            orders@riversand.net · 1-855-GOT-WAYS
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            River Sand — Real Sand. Real People.
          </p>
        </div>

        <div className="text-center py-6">
          <Link
            to="/"
            className="text-sm hover:underline"
            style={{ color: "#6B7280" }}
          >
            Back to Home
          </Link>
        </div>
      </FadeIn>
    </div>
  );
}
