import heroImage from "@/assets/hero-sand.jpg";
import { Phone, Truck, ArrowDown, ShieldCheck, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      <img
        src={heroImage}
        alt="River sand supply yard"
        className="absolute inset-0 w-full h-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-sand-dark/95 via-sand-dark/80 to-sand-dark/40" />
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-2xl space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-block bg-accent px-4 py-1 rounded-sm"
          >
            <p className="font-display text-primary-foreground tracking-wider text-sm">SAME DAY DELIVERY AVAILABLE</p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-6xl md:text-8xl leading-none text-primary-foreground tracking-wide"
          >
            BULK SAND<br />DELIVERED TO<br />YOUR DOOR
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xl md:text-2xl font-body text-primary-foreground/80 max-w-lg"
          >
            Quality river sand for construction, landscaping, and fill projects across the Greater New Orleans area.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-background/10 backdrop-blur-md border border-primary-foreground/20 rounded-lg p-6 inline-block"
          >
            <p className="text-5xl md:text-6xl font-display text-primary-foreground">
              9 YARDS — $195
            </p>
            <p className="text-primary-foreground/70 font-body mt-2 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Free delivery within 15 miles of Bridge City, LA
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button size="lg" className="text-lg font-display tracking-wider px-8 bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
              <Link to="/order">
                <Truck className="w-5 h-5 mr-2" />
                ORDER ONLINE
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <a href="tel:+15551234567">
                <Phone className="w-5 h-5 mr-2" />
                CALL TO ORDER
              </a>
            </Button>
          </motion.div>

          {/* Trust signals */}
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
              <div key={item.text} className="flex items-center gap-2 text-primary-foreground/60 font-body text-sm">
                <item.icon className="w-4 h-4 text-accent" />
                {item.text}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      <a href="#pricing" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-primary-foreground/50 hover:text-primary-foreground transition-colors animate-bounce">
        <ArrowDown className="w-8 h-8" />
      </a>
    </section>
  );
};

export default Hero;
