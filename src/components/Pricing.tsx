import { Check, Truck, MapPin, Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Pricing = () => {
  return (
    <section id="pricing" className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">SIMPLE PRICING</p>
          <h2 className="text-5xl md:text-6xl text-foreground">SPECIAL PRICING FOR YOUR AREA</h2>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Standard */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-background border-2 border-primary rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="bg-primary p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground font-display text-xs tracking-wider px-3 py-1 rounded-bl-lg">MOST POPULAR</div>
              <p className="font-display text-xl text-primary-foreground tracking-wider">STANDARD DELIVERY</p>
              <p className="font-display text-6xl text-primary-foreground mt-2">$195</p>
              <p className="font-body text-primary-foreground/80 mt-1">9 cubic yards of river sand</p>
            </div>
            <div className="p-6 space-y-4">
              {[
                "9 cubic yards of quality river sand",
                "Delivery within 15 miles included",
                "Same-day & next-day available",
                "Clean, screened material",
                "Dumped where you need it",
                "Cash on Delivery (COD)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-body text-foreground">{item}</span>
                </div>
              ))}
              <Button className="w-full h-12 mt-4 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link to="/order"><ShoppingCart className="w-5 h-5 mr-2" /> ORDER NOW</Link>
              </Button>
            </div>
          </motion.div>

          {/* Extended */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-background border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="bg-sand-dark p-6 text-center">
              <p className="font-display text-xl text-primary-foreground tracking-wider">EXTENDED DELIVERY</p>
              <p className="font-display text-6xl text-primary-foreground mt-2">$195<span className="text-3xl">+</span></p>
              <p className="font-body text-primary-foreground/80 mt-1">15–25 miles from our yard</p>
            </div>
            <div className="p-6 space-y-4">
              {[
                "Same 9 cubic yards of river sand",
                "Delivery 15–25 miles from yard",
                "+$3.49 per mile beyond 15 miles",
                "Example: 20 miles = $212.45",
                "Use our estimator for exact price",
                "Cash on Delivery (COD)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-body text-foreground">{item}</span>
                </div>
              ))}
              <Button variant="outline" className="w-full h-12 mt-4 font-display tracking-wider text-lg" asChild>
                <a href="#estimator">GET ESTIMATE</a>
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-8 text-center">
          <div className="flex items-center gap-2 text-muted-foreground font-body">
            <Truck className="w-5 h-5 text-primary" /> Fast delivery
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-body">
            <MapPin className="w-5 h-5 text-primary" /> From Bridge City, LA
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-body">
            <Package className="w-5 h-5 text-primary" /> No hidden fees
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
