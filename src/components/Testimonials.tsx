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

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const card = {
  hidden: { opacity: 0, y: 40, rotateX: 8 },
  visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Testimonials = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="text-accent font-display text-lg tracking-widest mb-3">TESTIMONIALS</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="text-3xl md:text-4xl text-foreground">WHAT NEW ORLEANS CUSTOMERS SAY</motion.h2>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={card}
              whileHover={{ y: -8, boxShadow: "0 25px 50px -12px hsl(209 87% 12% / 0.2)" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-background border border-border rounded-2xl p-8 space-y-5 transition-colors duration-300 relative group cursor-default hover:border-accent/40"
            >
              <motion.div
                initial={{ opacity: 0.1 }}
                whileHover={{ opacity: 0.25, rotate: 12 }}
                className="absolute top-6 right-6"
              >
                <Quote className="w-10 h-10 text-primary transition-colors duration-300 group-hover:text-accent" />
              </motion.div>
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <motion.div key={j} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 + j * 0.08, type: "spring", stiffness: 400 }}>
                    <Star className="w-4 h-4 fill-accent text-accent" />
                  </motion.div>
                ))}
              </div>
              <p className="font-body text-foreground leading-relaxed">"{t.text}"</p>
              <div className="pt-4 border-t border-border">
                <p className="font-display text-lg text-foreground">{t.name}</p>
                <p className="font-body text-sm text-muted-foreground">{t.location}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;