import { Check, Truck, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const Pricing = () => {
  return (
    <section id="pricing" className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">SIMPLE PRICING</p>
          <h2 className="text-5xl md:text-6xl text-foreground">
            SPECIAL PRICING FOR YOUR AREA
          </h2>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Standard */}
          <div className="bg-background border-2 border-primary rounded-lg overflow-hidden">
            <div className="bg-primary p-6 text-center">
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
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-body text-foreground">{item}</span>
                </div>
              ))}
              <Button className="w-full h-12 mt-4 font-display tracking-wider text-lg" asChild>
                <a href="tel:+15551234567">ORDER NOW</a>
              </Button>
            </div>
          </div>

          {/* Extended */}
          <div className="bg-background border border-border rounded-lg overflow-hidden">
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
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-8 text-center">
          <div className="flex items-center gap-2 text-muted-foreground font-body">
            <Truck className="w-5 h-5 text-primary" />
            Fast delivery
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-body">
            <MapPin className="w-5 h-5 text-primary" />
            From Bridge City, LA
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-body">
            <Package className="w-5 h-5 text-primary" />
            No hidden fees
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
