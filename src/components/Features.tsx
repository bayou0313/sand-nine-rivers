import { Truck, Clock, MapPin, Zap } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Truck, title: "SAME-DAY DELIVERY", desc: "Order by midday and get your sand delivered before end of day." },
  { icon: Zap, title: "INSTANT PRICE QUOTE", desc: "Enter your address and get a real price in seconds — no phone calls needed." },
  { icon: Clock, title: "CASH ON DELIVERY", desc: "No card required. Pay the driver in cash when the load arrives." },
  { icon: MapPin, title: "LOCAL & RELIABLE", desc: "Gulf South drivers who know the area and show up on time." },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Features = ({ cityName = "New Orleans" }: { cityName?: string }) => {
  return (
    <section id="why-us" className="py-24 bg-card overflow-x-hidden scroll-mt-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="text-accent font-display text-lg tracking-widest mb-3">WHY US</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="text-3xl md:text-4xl text-foreground">Why {cityName} Customers Choose River Sand</motion.h2>
        </div>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto"
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
              className="flex flex-col items-center text-center gap-3 p-5 md:p-6 bg-background border border-border rounded-2xl hover:border-accent/50 transition-colors duration-300 group cursor-default"
            >
              <motion.div
                className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors duration-300"
                whileHover={{ rotate: 8, scale: 1.1 }}
              >
                <f.icon className="w-6 h-6 text-primary group-hover:text-accent transition-colors duration-300" />
              </motion.div>
              <div>
                <h3 className="font-display text-sm md:text-base text-foreground mb-1">{f.title}</h3>
                <p className="font-body text-muted-foreground text-xs md:text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
