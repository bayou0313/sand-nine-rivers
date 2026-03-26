import { Truck, Clock, Shield, MapPin, ThumbsUp, Ruler } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Truck, title: "FAST DELIVERY", desc: "Same-day and next-day delivery available across our service area." },
  { icon: Shield, title: "QUALITY SAND", desc: "Clean, screened river sand — consistent quality every time." },
  { icon: MapPin, title: "LOCAL SERVICE", desc: "Based in Bridge City, proudly serving Greater New Orleans." },
  { icon: Clock, title: "EASY ORDERING", desc: "Order online or call — no hassle, no hidden fees." },
  { icon: ThumbsUp, title: "TRUSTED", desc: "Over 1,000 loads delivered with a 4.9-star rating." },
  { icon: Ruler, title: "9 CUBIC YARDS", desc: "Full dump truck load per delivery, every time." },
];

const Features = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">WHY US</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-5xl md:text-7xl text-foreground">WHY CHOOSE RIVERSAND?</motion.h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-4 p-6 bg-background border border-border rounded-2xl hover:border-primary/40 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:scale-105 transition-all">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-xl text-foreground mb-1">{f.title}</h3>
                <p className="font-body text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
