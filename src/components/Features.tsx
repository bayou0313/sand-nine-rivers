import { Truck, Clock, Shield, MapPin, ThumbsUp, Ruler } from "lucide-react";

const features = [
  { icon: Truck, title: "FAST DELIVERY", desc: "Same-day and next-day delivery available." },
  { icon: Shield, title: "QUALITY SAND", desc: "Clean, screened river sand every time." },
  { icon: MapPin, title: "LOCAL SERVICE", desc: "Based in Bridge City, serving GNO." },
  { icon: Clock, title: "EASY ORDERING", desc: "Call to schedule — no hassle, no hidden fees." },
  { icon: ThumbsUp, title: "TRUSTED", desc: "Hundreds of satisfied customers." },
  { icon: Ruler, title: "9 CUBIC YARDS", desc: "Full dump truck load per delivery." },
];

const Features = () => {
  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">WHY US</p>
          <h2 className="text-5xl md:text-6xl text-foreground">
            WHY CHOOSE RIVERSAND?
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4 p-6 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors">
              <f.icon className="w-8 h-8 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-display text-xl text-foreground mb-1">{f.title}</h3>
                <p className="font-body text-muted-foreground text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
