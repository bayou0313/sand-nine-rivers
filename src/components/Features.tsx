import { Truck, Clock, Shield, MapPin, ThumbsUp, Ruler } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Truck, title: "FAST DELIVERY", desc: "Same-day and next-day delivery available across our service area." },
  { icon: Shield, title: "QUALITY SAND", desc: "Clean, screened river sand — consistent quality every time." },
  { icon: MapPin, title: "LOCAL SERVICE", desc: "Proudly serving the Greater New Orleans area." },
  { icon: Clock, title: "EASY ORDERING", desc: "Order online or call — no hassle, no hidden fees." },
  { icon: ThumbsUp, title: "TRUSTED", desc: "Over 1,000 loads delivered with a 4.9-star rating." },
  { icon: Ruler, title: "9 CUBIC YARDS", desc: "Full dump truck load per delivery, every time." },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Features = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="text-accent font-display text-lg tracking-widest mb-3">WHY US</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="text-3xl md:text-4xl text-foreground">Delivery Schedule & Availability</motion.h2>
        </div>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              whileHover={{ y: -6, boxShadow: "0 20px 40px -12px hsl(209 87% 12% / 0.15)" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex items-start gap-4 p-6 bg-background border border-border rounded-2xl hover:border-accent/50 transition-colors duration-300 group cursor-default"
            >
              <motion.div
                className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors duration-300"
                whileHover={{ rotate: 8, scale: 1.1 }}
              >
                <f.icon className="w-6 h-6 text-primary group-hover:text-accent transition-colors duration-300" />
              </motion.div>
              <div>
                <h3 className="font-display text-xl text-foreground mb-1">{f.title}</h3>
                <p className="font-body text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;