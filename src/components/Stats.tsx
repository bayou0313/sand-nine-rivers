import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 1000, suffix: "+", label: "Loads Delivered" },
  { value: 15, suffix: "+", label: "Years Experience" },
  { value: 4.9, suffix: "★", label: "Customer Rating", decimal: true },
  { value: 25, suffix: "", label: "Mile Radius" },
];

const CountUp = ({ target, suffix, decimal }: { target: number; suffix: string; decimal?: boolean }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLParagraphElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(eased * target);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  const display = decimal ? count.toFixed(1) : Math.floor(count).toLocaleString();

  return (
    <p ref={ref} className="font-display text-5xl md:text-6xl text-accent font-bold">
      {display}{suffix}
    </p>
  );
};

const Stats = () => {
  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary-foreground rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-primary-foreground rounded-full" />
      </div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ scale: 1.08 }}
              className="cursor-default"
            >
              <CountUp target={stat.value} suffix={stat.suffix} decimal={stat.decimal} />
              <p className="font-body text-primary-foreground/80 mt-2 text-sm uppercase tracking-widest font-semibold">{stat.label}</p>
            </motion.div>
          ))}
        </div>
        <p className="text-center font-body text-primary-foreground/70 mt-8 text-sm max-w-xl mx-auto">
          Family-owned and operated in New Orleans since 2009. Licensed, insured, and GPS-tracked on every delivery.
        </p>
      </div>
    </section>
  );
};

export default Stats;