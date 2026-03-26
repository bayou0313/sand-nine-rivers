import { Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="py-20 bg-accent">
      <div className="container mx-auto px-6 text-center space-y-8">
        <h2 className="text-5xl md:text-7xl text-primary-foreground">
          PROFESSIONAL DELIVERY,<br />EVERY TIME
        </h2>
        <p className="text-xl font-body text-primary-foreground/80 max-w-xl mx-auto">
          9 yards of quality river sand delivered to your site. Call today to schedule your delivery or get an instant price estimate.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-lg font-display tracking-wider px-8 bg-background text-foreground hover:bg-background/90" asChild>
            <a href="tel:+15551234567">
              <Phone className="w-5 h-5 mr-2" />
              CALL (555) 123-4567
            </a>
          </Button>
          <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
            <a href="#estimator">
              <ArrowRight className="w-5 h-5 mr-2" />
              GET ESTIMATE
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
