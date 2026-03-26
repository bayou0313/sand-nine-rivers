import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";

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
    <section className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">TESTIMONIALS</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-5xl md:text-7xl text-foreground">WHAT CUSTOMERS SAY</motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-background border border-border rounded-2xl p-8 space-y-5 hover:shadow-xl transition-all duration-300 relative group"
            >
              <Quote className="w-10 h-10 text-primary/10 absolute top-6 right-6 group-hover:text-primary/20 transition-colors" />
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="font-body text-foreground leading-relaxed">"{t.text}"</p>
              <div className="pt-4 border-t border-border">
                <p className="font-display text-lg text-foreground">{t.name}</p>
                <p className="font-body text-sm text-muted-foreground">{t.location}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
