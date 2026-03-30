import { Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const CTA = () => {
  const scrollToEstimator = () => {
    const el = document.getElementById("estimator");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="py-24 bg-gradient-to-br from-primary via-primary/95 to-primary/85 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07]">
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary-foreground rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary-foreground rounded-full translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="container mx-auto px-6 text-center space-y-8 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-3xl md:text-5xl text-primary-foreground"
        >
          Get your sand delivered today.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-xl font-body text-primary-foreground/75 max-w-xl mx-auto"
        >
          Check your address for an instant price. Same-day delivery available in most areas.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Button
              size="lg"
              onClick={scrollToEstimator}
              className="text-lg font-display tracking-wider px-10 py-6 bg-accent hover:bg-[#C8911A] text-accent-foreground rounded-2xl shadow-xl transition-all duration-200"
            >
              See My Price <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
          <a
            href="tel:+18554689297"
            className="font-body text-primary-foreground/50 text-sm hover:text-primary-foreground/70 transition-colors flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" />
            or call us: 1-855-GOT-WAYS
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
