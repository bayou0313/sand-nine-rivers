import { useEffect, useState } from "react";
import { Truck, MapPin, Package, DollarSign, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const Pricing = () => {
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
            HOW IT WORKS
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl text-foreground font-display"
          >
            From Our Pit to Your Property
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="font-body text-muted-foreground mt-4 text-lg max-w-2xl mx-auto"
          >
            9 cubic yards of clean river sand, delivered curbside. Price based on distance — enter your address to see yours.
          </motion.p>
        </div>

        {/* Route illustration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="relative bg-background border border-border rounded-3xl p-8 md:p-12 overflow-hidden">
            {/* Map-like background pattern */}
            <div className="absolute inset-0 opacity-[0.04]">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Route visualization */}
            <div className="relative flex items-center justify-between gap-4 py-6">
              {/* PIT origin */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center gap-2 z-10 shrink-0"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-accent/15 border-2 border-accent flex items-center justify-center">
                  <MapPin className="w-6 h-6 md:w-7 md:h-7 text-accent" />
                </div>
                <span className="text-xs md:text-sm font-display tracking-wide text-foreground">Our Pit</span>
              </motion.div>

              {/* Animated route line + truck */}
              <div className="flex-1 relative h-20 flex items-center">
                {/* Road */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-border rounded-full" />
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] overflow-hidden rounded-full">
                  <motion.div
                    initial={{ width: "0%" }}
                    whileInView={{ width: "100%" }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5, duration: 1.5, ease: "easeInOut" }}
                    className="h-full bg-accent/50"
                  />
                </div>

                {/* Dashed center line */}
                <div className="absolute top-1/2 -translate-y-[0.5px] left-2 right-2 border-t-2 border-dashed border-accent/20" />

                {/* Truck sliding across */}
                <motion.div
                  initial={{ left: "5%" }}
                  whileInView={{ left: "75%" }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 1.8, ease: "easeInOut" }}
                  className="absolute top-1/2 -translate-y-1/2 z-10"
                >
                  <div className="relative">
                    <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/30">
                      <Truck className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    {/* Dust trail */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: [0, 0.4, 0] }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.8, duration: 1.5, repeat: 0 }}
                      className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/10 blur-sm"
                    />
                  </div>
                </motion.div>
              </div>

              {/* Destination */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center gap-2 z-10 shrink-0"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 md:w-7 md:h-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <span className="text-xs md:text-sm font-display tracking-wide text-foreground">Your Place</span>
              </motion.div>
            </div>

            {/* Distance label */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.8 }}
              className="text-center mt-2"
            >
              <p className="text-sm text-muted-foreground font-body">
                Price calculated by distance — <span className="text-accent font-medium">enter your address to see yours</span>
              </p>
            </motion.div>
          </div>
        </motion.div>

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

        {/* CTA */}
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
