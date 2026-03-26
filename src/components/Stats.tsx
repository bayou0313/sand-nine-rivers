import { motion } from "framer-motion";

const stats = [
  { value: "1,000+", label: "Loads Delivered" },
  { value: "15+", label: "Years Experience" },
  { value: "4.9★", label: "Customer Rating" },
  { value: "25", label: "Mile Delivery Radius" },
];

const Stats = () => {
  return (
    <section className="py-16 bg-primary">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="font-display text-5xl md:text-6xl text-primary-foreground">{stat.value}</p>
              <p className="font-body text-primary-foreground/70 mt-1 text-sm uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
