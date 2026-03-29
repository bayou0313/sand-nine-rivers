import { Clock, MapPin, Truck } from "lucide-react";
import { motion } from "framer-motion";

const trustCards = [
  {
    icon: Clock,
    title: "Same-Day Delivery",
    text: "Order before 10 AM and we deliver today, Monday through Friday.",
  },
  {
    icon: MapPin,
    title: "Local Operation",
    text: "We dispatch from Greater New Orleans — not a national broker with 2–4 day waits.",
  },
  {
    icon: Truck,
    title: "Real River Sand",
    text: "Natural, unscreened Mississippi River sand — ideal for drainage, fill, and construction projects.",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const card = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Testimonials = () => {
  return (
    <section className="py-24 bg-primary">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="text-accent font-display text-lg tracking-widest mb-3">WHY US</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="text-3xl md:text-4xl text-primary-foreground">Why Contractors and Homeowners Choose River Sand</motion.h2>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {trustCards.map((t) => (
            <motion.div
              key={t.title}
              variants={card}
              whileHover={{ y: -8, boxShadow: "0 25px 50px -12px hsl(209 87% 12% / 0.2)" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-8 space-y-5 transition-colors duration-300 hover:border-accent/40 text-center"
            >
              <div className="flex justify-center">
                <t.icon className="w-10 h-10 text-accent" />
              </div>
              <h3 className="font-display text-xl text-primary-foreground">{t.title}</h3>
              <p className="font-body text-primary-foreground/70 leading-relaxed">{t.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
