import { Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="py-20 bg-sand-dark">
      <div className="container mx-auto px-6 text-center space-y-8">
        <h2 className="text-5xl md:text-6xl text-primary-foreground">
          READY TO ORDER?
        </h2>
        <p className="text-xl font-body text-primary-foreground/70 max-w-xl mx-auto">
          9 yards of quality river sand delivered to your site for just $195. Call today to schedule your delivery.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-lg font-display tracking-wider px-8" asChild>
            <a href="tel:+15551234567">
              <Phone className="w-5 h-5 mr-2" />
              CALL TO ORDER
            </a>
          </Button>
          <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
            <a href="mailto:info@riversand.net">
              <Mail className="w-5 h-5 mr-2" />
              EMAIL US
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
