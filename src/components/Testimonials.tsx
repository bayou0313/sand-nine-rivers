import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Marcus T.",
    location: "Marrero, LA",
    text: "Had 9 yards delivered for a backyard project. Sand was clean and the driver placed it exactly where I needed. Will order again.",
    rating: 5,
  },
  {
    name: "Jennifer D.",
    location: "Westwego, LA",
    text: "Called in the morning, had delivery that afternoon. Price was exactly what they quoted — no surprises. Great experience all around.",
    rating: 5,
  },
  {
    name: "Robert S.",
    location: "Harvey, LA",
    text: "We use RiverSand for all our job sites. Consistent quality, fair pricing, and they always show up on time. Highly recommend.",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">TESTIMONIALS</p>
          <h2 className="text-5xl md:text-6xl text-foreground">
            WHAT OUR CUSTOMERS SAY
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-background border border-border rounded-lg p-6 space-y-4">
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                ))}
              </div>
              <p className="font-body text-foreground leading-relaxed italic">"{t.text}"</p>
              <div>
                <p className="font-display text-lg text-foreground">{t.name}</p>
                <p className="font-body text-sm text-muted-foreground">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
