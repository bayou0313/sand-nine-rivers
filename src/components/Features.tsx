import { Truck, Clock, Shield, MapPin } from "lucide-react";

const features = [
  {
    icon: Truck,
    title: "FAST DELIVERY",
    description: "Same-day and next-day delivery available throughout the Greater New Orleans metro area.",
  },
  {
    icon: Shield,
    title: "QUALITY SAND",
    description: "Clean, screened river sand perfect for construction, landscaping, fill, and drainage projects.",
  },
  {
    icon: MapPin,
    title: "LOCAL SERVICE",
    description: "Proudly serving a 15-mile radius from zip code 70123 — Jefferson Parish and surrounding areas.",
  },
  {
    icon: Clock,
    title: "EASY ORDERING",
    description: "Call us to schedule your delivery. No hassle, no hidden fees — just $195 for 9 yards delivered.",
  },
];

const Features = () => {
  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <h2 className="text-5xl md:text-6xl text-center text-foreground mb-16">
          WHY CHOOSE RIVERSAND?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-background rounded-lg p-8 border border-border hover:border-primary/50 transition-colors"
            >
              <feature.icon className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-2xl text-foreground mb-3">{feature.title}</h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
