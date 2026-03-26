import { useState } from "react";
import { Truck, MapPin, Package, ShoppingCart, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const BASE_PRICE = 195;

const Pricing = () => {
  const [qty, setQty] = useState(1);
  const total = qty * BASE_PRICE;

  return (
    <section id="pricing" className="relative py-32 bg-foreground overflow-hidden">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_60%)]" />

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
            RIVER SAND DELIVERY
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="font-body text-background/60 mt-3 text-lg max-w-xl mx-auto"
          >
            9 cubic yards per load · Clean, screened material · Dumped where you need it
          </motion.p>
        </div>

        {/* Interactive pricing widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-lg mx-auto bg-background/10 backdrop-blur-md border border-background/20 rounded-3xl p-8 md:p-10"
        >
          {/* Price per load */}
          <div className="text-center mb-8">
            <p className="font-display text-background/70 tracking-widest text-sm mb-1">PER LOAD</p>
            <p className="font-display text-6xl md:text-7xl text-background">
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
              <p className="font-display text-4xl text-accent">{qty}</p>
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
              <p className="font-display text-3xl text-accent">${total}</p>
            </motion.div>
          )}

          {/* Note */}
          <p className="text-center font-body text-background/50 text-sm mb-8">
            Within 15 miles. Farther? Price adjusts automatically at checkout.
          </p>

          {/* CTAs */}
          <div className="space-y-3">
            <Button
              className="w-full h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-lg shadow-accent/20"
              asChild
            >
              <Link to={`/order?qty=${qty}`}>
                <ShoppingCart className="w-5 h-5 mr-2" /> ORDER NOW
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 font-display tracking-wider text-sm rounded-xl border-background/30 text-background hover:bg-background/10 hover:text-background"
              asChild
            >
              <a href="#estimator">GET ESTIMATE</a>
            </Button>
          </div>
        </motion.div>

        {/* Bottom badges */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-14 flex flex-wrap justify-center gap-8 text-center"
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
