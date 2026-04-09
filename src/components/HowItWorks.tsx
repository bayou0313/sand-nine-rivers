import { MapPin, DollarSign, Truck } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { icon: MapPin, step: "1", title: "Enter Your Address", desc: "Type your delivery address and get an instant price quote — no phone call needed." },
  { icon: DollarSign, step: "2", title: "Choose & Pay", desc: "Pick your delivery date, pay online or choose cash on delivery." },
  { icon: Truck, step: "3", title: "We Deliver", desc: "A local driver brings 9 cubic yards of real river sand straight to your site." },
];

const HowItWorks = () => (
  <section id="how-it-works" className="py-20 bg-background">
    <div className="container mx-auto px-6">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-display text-foreground tracking-wide text-center mb-4 pt-[24px]"
      >
        HOW IT WORKS
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-center text-muted-foreground font-body mb-14 max-w-md mx-auto"
      >
        Three simple steps from quote to delivery.
      </motion.p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {steps.map((s, i) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-4 relative">
              <s.icon className="w-7 h-7 text-accent" />
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-display flex items-center justify-center">
                {s.step}
              </span>
            </div>
            <h3 className="font-display text-foreground text-lg tracking-wide mb-2">{s.title}</h3>
            <p className="font-body text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
