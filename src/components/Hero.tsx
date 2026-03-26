import heroImage from "@/assets/hero-sand.jpg";
import { Phone, Truck, ArrowDown, ShieldCheck, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Hero = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-16">
      <img
        src={heroImage}
        alt="River sand delivery truck unloading 9 cubic yards of clean screened river sand at a New Orleans job site"
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
            className="inline-flex items-center gap-2 bg-accent/90 backdrop-blur-sm px-5 py-1.5 rounded-full"
          >
            <Clock className="w-3.5 h-3.5 text-accent-foreground" />
            <p className="font-display text-accent-foreground tracking-wider text-sm">SAME DAY DELIVERY AVAILABLE</p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl md:text-5xl lg:text-6xl leading-[0.9] text-primary-foreground tracking-wide"
          >
            SAME-DAY RIVER SAND DELIVERY IN NEW ORLEANS
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl font-body text-primary-foreground/75 max-w-lg leading-relaxed"
          >
            Quality river sand for construction, landscaping, and fill projects across the Greater New Orleans area.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-primary-foreground/5 backdrop-blur-xl border border-primary-foreground/15 rounded-2xl p-6 inline-block"
          >
            <p className="text-3xl md:text-4xl font-display text-primary-foreground">
              9 YARDS — $195
            </p>
            <p className="text-primary-foreground/60 font-body mt-2 flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4" /> Free delivery within 15 miles of Bridge City, LA
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Button size="lg" className="text-lg font-display tracking-wider px-8 bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 transition-all" asChild>
              <Link to="/order">
                <Truck className="w-5 h-5 mr-2" />
                ORDER ONLINE
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-8 border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-xl backdrop-blur-sm" asChild>
              <a href="tel:+18554689297">
                <Phone className="w-5 h-5 mr-2" />
                1-855-GOT-WAYS
              </a>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap gap-6 pt-4"
          >
            {[
              { icon: ShieldCheck, text: "Licensed & Insured" },
              { icon: Clock, text: "Same Day Delivery" },
              { icon: Star, text: "4.9★ Rating" },
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
