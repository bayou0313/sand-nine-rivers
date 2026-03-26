import { motion } from "framer-motion";

const stats = [
  { value: "1,000+", label: "Loads Delivered" },
  { value: "15+", label: "Years Experience" },
  { value: "4.9★", label: "Customer Rating" },
  { value: "25", label: "Mile Radius" },
];

const Stats = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-primary via-primary/90 to-accent/80 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary-foreground rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary-foreground rounded-full" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="font-display text-4xl md:text-5xl text-primary-foreground">{stat.value}</p>
              <p className="font-body text-primary-foreground/60 mt-2 text-sm uppercase tracking-widest">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
