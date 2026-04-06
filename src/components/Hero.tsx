import heroImage from "@/assets/hero-sand.jpg";
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

const Hero = ({ h1Override, subtitleOverride, prefillAddress }: HeroProps) => {
  const { timeLeft, label } = useCountdown();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section ref={sectionRef} className="relative min-h-[90vh] flex items-center overflow-hidden pt-24 md:pt-28">
      <motion.div className="absolute inset-0 h-[120%]" style={{ y: bgY }}>
        <img
          src={heroImage}
          alt="River sand delivery truck unloading clean screened river sand at a New Orleans job site"
          className="w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sand-dark/95 via-sand-dark/85 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-sand-dark/60 via-transparent to-transparent" />
      </motion.div>

      <div className="relative z-10 container mx-auto px-6 pt-[25px] my-px py-[37px] pb-[34px] mt-[3px]">
        <div className="max-w-2xl space-y-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-foreground/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <p className="font-display tracking-wider text-accent text-lg">{label}</p>
              <span className="font-mono text-primary-foreground/90 font-medium tracking-wide text-lg pt-0 pb-[4px]">{timeLeft}</span>
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

          {/* Embedded DeliveryEstimator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <DeliveryEstimator prefillAddress={prefillAddress} embedded />
          </motion.div>

          {/* Trust bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-2 pt-2"
          >
            {[
              { icon: Star, text: "4.9-star rated" },
              { icon: Truck, text: "500+ loads delivered" },
              { icon: CheckCircle, text: "Same-day available" },
              { icon: ShieldCheck, text: "Licensed & insured" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5 text-primary-foreground/70 font-body text-sm">
                <item.icon className="w-4 h-4 text-accent shrink-0" />
                {item.text}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
