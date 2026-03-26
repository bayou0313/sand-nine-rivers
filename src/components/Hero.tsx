import heroImage from "@/assets/hero-sand.jpg";
import { Phone, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <img
        src={heroImage}
        alt="River sand supply yard"
        className="absolute inset-0 w-full h-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-sand-dark/90 via-sand-dark/70 to-sand-dark/30" />
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-2xl space-y-8">
          <h1 className="text-6xl md:text-8xl leading-none text-primary-foreground tracking-wide">
            RIVER SAND<br />DELIVERED
          </h1>
          <p className="text-xl md:text-2xl font-body text-primary-foreground/80 max-w-lg">
            Quality river sand for construction, landscaping, and fill projects across the Greater New Orleans area.
          </p>
          <div className="bg-primary/90 backdrop-blur-sm rounded-lg p-6 inline-block">
            <p className="text-4xl md:text-5xl font-display text-primary-foreground">
              9 YARDS — $195
            </p>
            <p className="text-primary-foreground/80 font-body mt-1 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Free delivery within 15 miles of 70123
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" variant="secondary" className="text-lg font-display tracking-wider px-8" asChild>
              <a href="tel:+15551234567">
                <Phone className="w-5 h-5 mr-2" />
                CALL NOW
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
