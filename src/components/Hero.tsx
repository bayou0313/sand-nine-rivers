import heroImage from "@/assets/hero-sand.jpg";
import heroImageWebp from "@/assets/hero-sand.webp";
import { Clock, Star, Truck, CheckCircle, ShieldCheck } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, lazy, Suspense } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { Link } from "react-router-dom";

const DeliveryEstimator = lazy(() => import("@/components/DeliveryEstimator"));

interface HeroProps {
  h1Override?: string;
  subtitleOverride?: string;
  prefillAddress?: string | null;
  showEstimator?: boolean;
  ctaCityName?: string;
}

const Hero = ({ h1Override, subtitleOverride, prefillAddress, showEstimator = true, ctaCityName }: HeroProps) => {
  const { timeLeft, label } = useCountdown();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section ref={sectionRef} className="relative min-h-[90vh] flex items-center overflow-hidden pt-24 md:pt-28">
      <motion.div className="absolute inset-0 h-[120%]" style={{ y: bgY }}>
        <picture>
          <source srcSet={heroImageWebp} type="image/webp" />
          <img
            src={heroImage}
            alt="River sand delivery truck unloading clean screened river sand at a New Orleans job site"
            title="River Sand Delivery — Same-Day Service in the Greater New Orleans Area"
            className="w-full h-full object-cover"
            width={1920}
            height={1080}
            fetchPriority="high"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-sand-dark/50 via-sand-dark/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-sand-dark/30 via-transparent to-transparent" />
      </motion.div>

      <div className="relative z-10 container mx-auto px-6 pt-[25px] my-px py-[37px] pb-[34px] mt-[3px]">
        <div className="max-w-2xl space-y-5">
          {/* Content container with semi-transparent background */}
          <div className="bg-primary/60 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 space-y-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 bg-primary/80 backdrop-blur-sm border border-accent/40 px-5 py-2 rounded-full">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <p className="font-display tracking-wider text-accent text-lg">{label}</p>
                <span className="font-mono text-primary-foreground font-bold tracking-wide text-lg">{timeLeft}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-primary-foreground tracking-wide">
                {h1Override || "Same-Day River Sand Delivery"}
              </h1>
              <div className="w-20 h-0.5 bg-accent mt-4" />
            </motion.div>

            {subtitleOverride && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-base md:text-lg font-body text-primary-foreground/80 max-w-xl leading-relaxed"
              >
                {subtitleOverride}
              </motion.p>
            )}

            {!subtitleOverride && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-lg md:text-xl font-body text-primary-foreground/85 max-w-lg leading-relaxed"
              >
                See your exact price in seconds — no account needed
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-body text-primary-foreground/60"
            >
              {["Serving the Gulf South", "No minimums", "Cash or card accepted"].map((item, i) => (
                <span key={item} className="flex items-center gap-1">
                  {i > 0 && <span className="text-primary-foreground/30">·</span>}
                  {item}
                </span>
              ))}
            </motion.div>

            {/* Trust bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="flex flex-nowrap gap-3 pt-2"
            >
              {[
                { icon: Star, text: "4.9-star rated", hideOnMobile: false },
                { icon: Truck, text: "Pit Direct Delivery", hideOnMobile: false },
                { icon: CheckCircle, text: "Same-day available", hideOnMobile: false },
                { icon: ShieldCheck, text: "9 Cu Yds Per Load", hideOnMobile: true },
              ].map((item) => (
                <div key={item.text} className={`flex items-center gap-1 text-primary-foreground/70 font-body text-xs ${item.hideOnMobile ? "hidden sm:flex" : ""}`}>
                  <item.icon className="w-3 h-3 text-accent shrink-0" />
                  {item.text}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Estimator stays outside the container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            {showEstimator ? (
              <Suspense fallback={<div className="h-24 rounded-xl bg-white/5 animate-pulse" />}>
                <DeliveryEstimator prefillAddress={prefillAddress} embedded />
              </Suspense>
            ) : (
              <Link
                to={`/?address=${encodeURIComponent(ctaCityName ? `${ctaCityName}, LA` : "")}`}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-display tracking-wider text-base hover:brightness-110 transition-all"
              >
                Check Delivery to {ctaCityName || "Your Area"} →
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
