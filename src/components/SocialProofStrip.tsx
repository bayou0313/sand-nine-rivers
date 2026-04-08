import { motion } from "framer-motion";
import { Truck, Clock, Award } from "lucide-react";

const stats = [
  { icon: Truck, number: "15,000+", label: "Loads Delivered" },
  { icon: Clock, number: "Same-Day", label: "Service Available" },
  { icon: Award, number: "\u200BSince 2015", label: "Serving New Orleans " },
];

const SocialProofStrip = () => {
  return (
    <section className="py-6 bg-muted border-y border-border overflow-x-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12"
        >
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-3 text-center sm:text-left">
              <stat.icon className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="font-display text-lg text-foreground tracking-wider leading-tight">{stat.number}</p>
                <p className="font-body text-xs text-muted-foreground">{stat.label}</p>
              </div>
              {i < stats.length - 1 && (
                <span className="hidden sm:inline text-muted-foreground/30 ml-6">·</span>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default SocialProofStrip;
