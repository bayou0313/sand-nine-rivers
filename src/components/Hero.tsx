import heroImage from "@/assets/hero-sand.jpg";
import { Phone, Truck, ArrowDown, ShieldCheck, Clock, Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Hero = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-16">
      <img
        src={heroImage}
        alt="River sand delivery truck unloading clean screened river sand at a New Orleans job site"
        className="absolute inset-0 w-full h-full object-cover"
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
            className="inline-flex items-center gap-2 bg-destructive/90 backdrop-blur-sm px-5 py-1.5 rounded-full"
          >
            <Clock className="w-3.5 h-3.5 text-white" />
            <p className="font-display text-white tracking-wider text-sm">SAME-DAY DELIVERY AVAILABLE</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-[4.3rem] leading-[0.9] text-primary-foreground tracking-wide">
              SAME-DAY RIVER SAND DELIVERY IN NEW ORLEANS
            </h1>
            <div className="w-32 h-1 bg-accent mt-3 rounded-full" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl font-body text-primary-foreground/75 max-w-lg leading-relaxed"
          >
            Quality river sand for landscaping, drainage, backfill, and construction projects across Greater New Orleans. Order before noon for same-day delivery.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/15 rounded-2xl p-6 inline-block"
          >
            <p className="text-3xl md:text-4xl font-display text-primary-foreground">
              9 YARDS — <span className="text-accent">$195</span>
            </p>
            <p className="text-primary-foreground/60 font-body mt-2 flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4" /> Free delivery within the Greater New Orleans area
            </p>
          </motion.div>

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
                <Link to="/order">
                  <Truck className="w-5 h-5 mr-2" />
                  ORDER ONLINE
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-10 py-6 border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-2xl backdrop-blur-sm w-full sm:w-auto" asChild>
                <a href="tel:+18554689297">
                  <Phone className="w-5 h-5 mr-2" />
                  1-855-GOT-WAYS
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Prominent phone number */}
          <motion.a
            href="tel:+18554689297"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="inline-flex items-center gap-2 text-accent font-display text-2xl md:text-3xl tracking-wider hover:text-accent/80 transition-colors"
          >
            <Phone className="w-6 h-6" />
            1-855-GOT-WAYS
          </motion.a>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap gap-6 pt-2"
          >
            {[
              { icon: ShieldCheck, text: "Same-day delivery available" },
              { icon: MapPin, text: "GPS-tracked loads" },
              { icon: Star, text: "Local New Orleans team" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-primary-foreground/50 font-body text-sm">
                <item.icon className="w-4 h-4 text-accent/80" />
                {item.text}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      <a href="#pricing" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-primary-foreground/30 hover:text-primary-foreground/60 transition-colors animate-bounce" aria-label="Scroll to pricing section">
        <ArrowDown className="w-8 h-8" />
      </a>
    </section>
  );
};

export default Hero;
