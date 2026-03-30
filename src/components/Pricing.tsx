import { useState, useEffect } from "react";
import { Truck, MapPin, Package, DollarSign, ArrowRight } from "lucide-react";
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

  const price15mi = globalPricing.base_price + (15 - globalPricing.free_miles) * globalPricing.extra_per_mile;

  const tiers = [
    {
      label: "Nearby",
      distance: `0–${globalPricing.free_miles} mi`,
      price: globalPricing.base_price,
      note: "Base rate — no mileage fee",
    },
    {
      label: "Mid-range",
      distance: `${globalPricing.free_miles}–15 mi`,
      price: price15mi,
      note: `+${formatCurrency(globalPricing.extra_per_mile)}/mi after ${globalPricing.free_miles} mi`,
    },
    {
      label: "Extended",
      distance: `15–${globalPricing.max_distance} mi`,
      price: globalPricing.base_price + (globalPricing.max_distance - globalPricing.free_miles) * globalPricing.extra_per_mile,
      note: "Exact price depends on distance",
    },
  ];

  return (
    <section id="pricing" className="relative py-20 md:py-28 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
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
            className="text-3xl md:text-5xl text-foreground font-display"
          >
            One Load. One Price. No Surprises.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="font-body text-muted-foreground mt-4 text-lg max-w-2xl mx-auto"
          >
            Every load is 9 cubic yards of clean, unscreened river sand — dumped curbside where you need it.
            Your price is based on distance from our nearest pit.
          </motion.p>
        </div>

        {/* Pricing tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i }}
              className={`relative rounded-2xl border p-6 md:p-8 text-center transition-shadow hover:shadow-md ${
                i === 0
                  ? "bg-accent/10 border-accent/30 shadow-sm"
                  : "bg-background border-border"
              }`}
            >
              {i === 0 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-display tracking-wider px-3 py-1 rounded-full">
                  MOST COMMON
                </span>
              )}
              <p className="text-sm font-display tracking-wider text-muted-foreground mb-1 uppercase">
                {tier.label}
              </p>
              <p className="text-xs text-muted-foreground/70 font-body mb-4">{tier.distance}</p>
              <p className="text-4xl md:text-5xl font-display text-foreground mb-1">
                {formatCurrency(tier.price)}
              </p>
              <p className="text-xs text-muted-foreground/60 font-body">{tier.note}</p>
            </motion.div>
          ))}
        </div>

        {/* What's included strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-center mb-8"
        >
          {[
            { icon: Package, text: "9 cu yd per load" },
            { icon: Truck, text: "Mon–Sat delivery" },
            { icon: MapPin, text: "Greater New Orleans" },
            { icon: DollarSign, text: "No hidden fees" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-muted-foreground font-body text-sm">
              <item.icon className="w-4 h-4 text-accent" /> {item.text}
            </div>
          ))}
        </motion.div>

        {/* Curbside notice */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground/60 text-xs font-body max-w-lg mx-auto mb-8"
        >
          All deliveries are curbside only. Due to liability, we cannot deliver inside backyards or enclosed areas.
        </motion.p>

        {/* CTA link */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <a
            href="#estimator"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-display tracking-wider text-sm px-6 py-3 rounded-full hover:bg-accent/90 transition-colors"
          >
            Check my exact price <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
