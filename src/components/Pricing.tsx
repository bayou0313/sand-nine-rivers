import { useState, useEffect } from "react";
import { Truck, MapPin, Package } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { GlobalPricing } from "@/lib/pits";

const FALLBACK_GLOBAL: GlobalPricing = {
  base_price: 195,
  free_miles: 3,
  extra_per_mile: 15,
  max_distance: 30,
  saturday_surcharge: 35,
};

const Pricing = () => {
  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("global_settings").select("*");
      if (data) {
        const s = Object.fromEntries(data.map((r) => [r.key, r.value]));
        setGlobalPricing({
          base_price: Number(s.base_price) || FALLBACK_GLOBAL.base_price,
          free_miles: Number(s.free_miles) || FALLBACK_GLOBAL.free_miles,
          extra_per_mile: Number(s.price_per_extra_mile) || FALLBACK_GLOBAL.extra_per_mile,
          max_distance: Number(s.max_distance) || FALLBACK_GLOBAL.max_distance,
          saturday_surcharge: Number(s.saturday_surcharge) || FALLBACK_GLOBAL.saturday_surcharge,
        });
      }
    };
    load();
  }, []);

  return (
    <section id="pricing" className="relative py-24 bg-foreground overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--accent)/0.08),transparent_60%)]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">
            SIMPLE PRICING
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-5xl text-background font-display">
            Pricing
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="font-body text-background/60 mt-3 text-lg max-w-xl mx-auto">
            9 cubic yards per load · Clean, unscreened river sand · Dumped where you need it
          </motion.p>
        </div>

        {/* Example pricing breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-lg mx-auto bg-background/10 backdrop-blur-md border border-background/20 rounded-3xl p-8 md:p-10 text-center"
        >
          <p className="font-body text-background/70 text-base leading-relaxed mb-4">
            A delivery <strong className="text-background/90">5 miles</strong> from our pit starts at{" "}
            <strong className="text-accent">{formatCurrency(globalPricing.base_price)}</strong>.
          </p>
          <p className="font-body text-background/70 text-base leading-relaxed mb-4">
            15 miles out? You'll pay{" "}
            <strong className="text-accent">
              {formatCurrency(globalPricing.base_price + (15 - globalPricing.free_miles) * globalPricing.extra_per_mile)}
            </strong>.
          </p>
          <p className="font-body text-background/50 text-sm">
            Enter your address above for your exact price — takes 10 seconds.
          </p>
        </motion.div>

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

        <div className="mt-6 text-center">
          <a href="#estimator" className="text-accent hover:text-accent/80 font-display tracking-wider text-sm transition-colors">
            → Check my exact delivery price
          </a>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
