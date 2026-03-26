import { useState } from "react";
import { Truck, MapPin, Package, ShoppingCart, Minus, Plus, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCountdown } from "@/hooks/use-countdown";

const BASE_PRICE = 195;

const Pricing = () => {
  const [qty, setQty] = useState(1);
  const total = qty * BASE_PRICE;
  const { timeLeft, label } = useCountdown();

  return (
    <section id="pricing" className="relative py-32 bg-foreground overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--accent)/0.08),transparent_60%)]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-accent font-display text-lg tracking-widest mb-3"
          >
            SIMPLE PRICING
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl text-background font-display"
          >
            DELIVERY AREA & PRICING
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="font-body text-background/60 mt-3 text-lg max-w-xl mx-auto"
          >
            9 cubic yards per load · Clean, unscreened river sand · Dumped where you need it
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-lg mx-auto bg-background/10 backdrop-blur-md border-2 border-accent/50 rounded-3xl p-8 md:p-10 relative"
        >
          {/* Best Value badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground font-display tracking-wider text-sm px-6 py-1.5 rounded-full shadow-lg">
            BEST VALUE
          </div>

          {/* Price per load */}
          <div className="text-center mb-8 mt-2">
            <p className="font-display text-background/70 tracking-widest text-sm mb-1">PER LOAD</p>
            <p className="font-display text-7xl md:text-8xl text-accent font-bold">
              $195
            </p>
            <p className="font-body text-background/50 text-sm mt-1">9 cubic yards of river sand</p>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-12 h-12 rounded-full bg-background/15 hover:bg-background/25 transition-colors flex items-center justify-center text-background border border-background/20"
              aria-label="Decrease quantity"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[100px]">
              <p className="font-display text-5xl text-accent font-bold">{qty}</p>
              <p className="font-body text-background/50 text-xs tracking-wider">
                {qty === 1 ? "LOAD" : "LOADS"}
              </p>
            </div>
            <button
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              className="w-12 h-12 rounded-full bg-background/15 hover:bg-background/25 transition-colors flex items-center justify-center text-background border border-background/20"
              aria-label="Increase quantity"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Total */}
          {qty > 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-center mb-6"
            >
              <p className="font-body text-background/60 text-sm">
                {qty} loads × $195 =
              </p>
              <p className="font-display text-4xl text-accent font-bold">{formatCurrency(total)}</p>
            </motion.div>
          )}

          {/* Note */}
          <p className="text-center font-body text-background/50 text-sm mb-8">
            Price adjusts automatically at checkout based on delivery location.<br />
            Saturday delivery: +$35 per load.
          </p>

          {/* Countdown + CTAs */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-4 py-2.5">
              <Clock className="w-4 h-4 text-accent animate-pulse" />
              <span className="font-display text-accent text-xs tracking-wider">{label}</span>
              <span className="font-mono text-accent font-bold text-sm">{timeLeft}</span>
            </div>
            <Button
              className="w-full h-16 font-display tracking-wider text-lg bg-accent hover:bg-[#C8911A] text-accent-foreground rounded-2xl shadow-lg shadow-accent/20 transition-all duration-200"
              asChild
            >
              <Link to={`/order?qty=${qty}`}>
                <ShoppingCart className="w-5 h-5 mr-2" /> ORDER NOW
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 font-display tracking-wider text-sm rounded-2xl border-accent/50 text-accent hover:bg-accent/10 hover:text-accent"
              asChild
            >
              <a href="#estimator">GET ESTIMATE</a>
            </Button>
          </div>
        </motion.div>

        {/* Bottom badges */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center text-background/50 text-sm font-body max-w-xl mx-auto"
        >
          ⚠️ All deliveries are curbside only. Due to liability, we cannot deliver inside backyards or enclosed areas.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 flex flex-wrap justify-center gap-8 text-center"
        >
          {[
            { icon: Truck, text: "Mon–Sat delivery" },
            { icon: MapPin, text: "Greater New Orleans" },
            { icon: Package, text: "No hidden fees" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-background/60 font-body">
              <item.icon className="w-5 h-5 text-accent" /> {item.text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
