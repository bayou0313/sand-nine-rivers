import { Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const CTA = () => {
  const scrollToEstimator = () => {
    const el = document.getElementById("estimator");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        const input = el.querySelector("input") as HTMLInputElement | null;
        input?.focus({ preventScroll: true });
      }, 500);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <section className="py-24 bg-muted/50 relative overflow-hidden">
      <div className="container mx-auto px-6 text-center space-y-8 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-3xl md:text-5xl text-foreground"
        >
          Get your sand delivered today.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-xl font-body text-muted-foreground max-w-xl mx-auto"
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
              className="text-lg font-display tracking-wider px-10 py-6 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl shadow-xl transition-all duration-200"
            >
              See My Price <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
          <p className="font-body text-muted-foreground/60 text-sm mt-1">
            No account needed · Same-day available · Cash or card accepted
          </p>
          <a
            href="tel:+18554689297"
            className="font-body text-muted-foreground/50 text-sm hover:text-muted-foreground/70 transition-colors flex items-center gap-1.5"
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
