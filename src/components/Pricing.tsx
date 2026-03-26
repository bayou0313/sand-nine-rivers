import { Check, Truck, MapPin, Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">SIMPLE PRICING</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl text-foreground">RIVER SAND — 9 CUBIC YARD LOAD DELIVERY</motion.h2>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Standard */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-background border-2 border-primary rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow relative"
          >
            <div className="absolute top-4 right-4 z-10 bg-accent text-accent-foreground font-display text-xs tracking-wider px-3 py-1 rounded-full">MOST POPULAR</div>
            <div className="bg-gradient-to-br from-primary to-primary/80 p-8 text-center">
              <p className="font-display text-xl text-primary-foreground tracking-widest">STANDARD DELIVERY</p>
              <p className="font-display text-4xl md:text-5xl text-primary-foreground mt-3">$195</p>
              <p className="font-body text-primary-foreground/70 mt-2">9 cubic yards of river sand</p>
            </div>
            <div className="p-8 space-y-4">
              {[
                "9 cubic yards of quality river sand",
                "Delivery within 15 miles included",
                "Same-day & next-day available",
                "Clean, screened material",
                "Dumped where you need it",
                "Saturday delivery available (+$35)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-body text-foreground text-sm">{item}</span>
                </div>
              ))}
              <Button className="w-full h-12 mt-4 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20" asChild>
                <Link to="/order"><ShoppingCart className="w-5 h-5 mr-2" /> ORDER NOW</Link>
              </Button>
            </div>
          </motion.div>

          {/* Extended */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-background border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-shadow"
          >
            <div className="bg-gradient-to-br from-sand-dark to-foreground p-8 text-center">
              <p className="font-display text-xl text-primary-foreground tracking-widest">EXTENDED DELIVERY</p>
              <p className="font-display text-4xl md:text-5xl text-primary-foreground mt-3">$195<span className="text-2xl">+</span></p>
              <p className="font-body text-primary-foreground/70 mt-2">15–25 miles from our yard</p>
            </div>
            <div className="p-8 space-y-4">
              {[
                "Same 9 cubic yards of river sand",
                "Delivery 15–25 miles from yard",
                "+$3.49 per mile beyond 15 miles",
                "Example: 20 miles = $212.45",
                "Use our estimator for exact price",
                "Saturday delivery available (+$35)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-body text-foreground text-sm">{item}</span>
                </div>
              ))}
              <Button variant="outline" className="w-full h-12 mt-4 font-display tracking-wider text-lg rounded-xl" asChild>
                <a href="#estimator">GET ESTIMATE</a>
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-14 flex flex-wrap justify-center gap-8 text-center"
        >
          {[
            { icon: Truck, text: "Mon–Sat delivery" },
            { icon: MapPin, text: "From Bridge City, LA" },
            { icon: Package, text: "No hidden fees" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-muted-foreground font-body">
              <item.icon className="w-5 h-5 text-primary" /> {item.text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
