import { motion } from "framer-motion";

const Stats = () => {
  return (
    <section className="py-12 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary-foreground rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary-foreground rounded-full" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center font-body text-accent text-lg md:text-xl italic max-w-2xl mx-auto"
        >
          Local. Same-day. Real river sand direct from the Mississippi.
        </motion.p>
      </div>
    </section>
  );
};

export default Stats;
