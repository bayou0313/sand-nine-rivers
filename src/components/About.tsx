import { Truck, Users, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const card = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const About = () => {
  return (
    <section id="about" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="text-accent font-display text-lg tracking-widest mb-3">ABOUT US</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }} className="text-3xl md:text-4xl text-foreground">WHY NEW ORLEANS CONTRACTORS CHOOSE RIVERSAND.NET</motion.h2>
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25, duration: 0.5 }} className="font-body text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed text-lg">
            We've been providing quality river sand to the Greater New Orleans area for over 15 years. Our commitment is simple — deliver clean, screened sand on time, at a fair price, every single time.
          </motion.p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { icon: Truck, title: "RELIABLE FLEET", desc: "Our trucks are maintained and ready to deliver on your schedule." },
            { icon: Users, title: "LOCAL TEAM", desc: "We're your neighbors — a local, family-run operation you can trust." },
            { icon: Shield, title: "QUALITY MATERIAL", desc: "Clean, screened river sand perfect for any construction or landscaping project." },
            { icon: Clock, title: "FAST TURNAROUND", desc: "Same-day and next-day delivery available throughout our service area." },
          ].map((item) => (
            <motion.div
              key={item.title}
              variants={card}
              whileHover={{ y: -8, boxShadow: "0 20px 40px -12px hsl(209 87% 12% / 0.15)" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="text-center p-8 bg-card border border-border rounded-2xl hover:border-accent/40 transition-colors duration-300 group cursor-default"
            >
              <motion.div
                className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:bg-accent/20 transition-colors duration-300"
                whileHover={{ rotate: 10, scale: 1.1 }}
              >
                <item.icon className="w-8 h-8 text-primary group-hover:text-accent transition-colors duration-300" />
              </motion.div>
              <h3 className="font-display text-2xl text-foreground mb-2">{item.title}</h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default About;