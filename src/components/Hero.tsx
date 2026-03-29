import heroImage from "@/assets/hero-sand.jpg";
import { Phone, Truck, ArrowDown, ShieldCheck, Clock, MapPin, Star, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useCountdown } from "@/hooks/use-countdown";

interface HeroProps {
  h1Override?: string;
  subtitleOverride?: string;
  trustBadges?: { icon: any; text: string }[];
}

const Hero = ({ h1Override, subtitleOverride, trustBadges }: HeroProps = {}) => {
  const { timeLeft, label } = useCountdown();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section ref={sectionRef} className="relative min-h-[85vh] flex items-center overflow-hidden pt-16">
      <motion.img
        src={heroImage}
        alt="River sand delivery truck unloading clean screened river sand at a New Orleans job site"
        className="absolute inset-0 w-full h-[120%] object-cover"
        style={{ y: bgY }}
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-sand-dark/95 via-sand-dark/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-sand-dark/60 via-transparent to-sand-dark/30" />

      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-2xl space-y-5">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <div className="inline-flex items-center gap-2 bg-foreground/80 backdrop-blur-md px-5 py-2 rounded-xl shadow-lg shadow-black/20 border border-white/10">
              <Clock className="w-4 h-4 text-accent animate-pulse" />
              <div className="flex items-center gap-3">
                <p className="font-display text-white tracking-wider text-sm">{label}</p>
                <span className="font-mono text-accent font-bold text-base tracking-wide">{timeLeft}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-[4.3rem] leading-[0.9] text-primary-foreground tracking-wide">
              {h1Override || "Same-Day River Sand Delivery — See Your Price Instantly"}
            </h1>
            <div className="w-32 h-1 bg-accent mt-3 rounded-full" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl font-body text-primary-foreground/75 max-w-lg leading-relaxed"
          >
            {subtitleOverride || "Serving the Gulf South · No minimums · Cash or card accepted · Real driver, real load"}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-2"
          >
            <p className="text-[13px] font-body text-destructive font-light tracking-wide">
              Order before noon for same-day delivery
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="text-lg font-display tracking-wider px-10 py-6 bg-accent hover:bg-[#C8911A] text-accent-foreground rounded-2xl shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 animate-cta-pulse w-full sm:w-auto" asChild>
                <a href="#estimator">
                  <Truck className="w-5 h-5 mr-2" />
                  See My Price Now →
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-10 py-6 border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-2xl backdrop-blur-sm w-full sm:w-auto" asChild>
                <a href="tel:+18554689297">
                  <Phone className="w-5 h-5 mr-2" />
                  1-855-GOT-WAYS
                </a>
              </Button>
            </div>
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
              <div key={item.text} className="flex items-center gap-1.5 text-primary-foreground/50 font-body text-sm">
                <item.icon className="w-4 h-4 text-accent/80 shrink-0" />
                {item.text}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      <a href="#estimator" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-primary-foreground/30 hover:text-primary-foreground/60 transition-colors animate-bounce" aria-label="Scroll to pricing section">
        <ArrowDown className="w-8 h-8" />
      </a>
    </section>
  );
};

export default Hero;
