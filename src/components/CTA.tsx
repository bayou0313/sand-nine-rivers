import { Phone, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CTA = () => {
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
          READY TO ORDER?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-xl font-body text-primary-foreground/75 max-w-xl mx-auto"
        >
          9 yards of quality river sand delivered to your site. Schedule online Mon–Sat or call to order.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Button size="lg" className="text-lg font-display tracking-wider px-10 py-6 bg-accent hover:bg-[#C8911A] text-accent-foreground rounded-2xl shadow-xl transition-all duration-200 w-full sm:w-auto" asChild>
              <Link to="/order">
                <ShoppingCart className="w-5 h-5 mr-2" />
                ORDER ONLINE
              </Link>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
            <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-10 py-6 border-primary-foreground/40 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-2xl w-full sm:w-auto" asChild>
              <a href="tel:+18554689297">
                <Phone className="w-5 h-5 mr-2" />
                1-855-GOT-WAYS
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;