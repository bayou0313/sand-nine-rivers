import { Phone, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CTA = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-accent via-accent/95 to-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07]">
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary-foreground rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary-foreground rounded-full translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="container mx-auto px-6 text-center space-y-8 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-8xl text-accent-foreground"
        >
          READY TO ORDER?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl font-body text-accent-foreground/75 max-w-xl mx-auto"
        >
          9 yards of quality river sand delivered to your site. Schedule online Mon–Sat or call to order.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button size="lg" className="text-lg font-display tracking-wider px-8 bg-background text-foreground hover:bg-background/90 rounded-xl shadow-xl" asChild>
            <Link to="/order">
              <ShoppingCart className="w-5 h-5 mr-2" />
              ORDER ONLINE
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-8 border-accent-foreground/25 text-accent-foreground hover:bg-accent-foreground/10 rounded-xl" asChild>
            <a href="tel:+18554689297">
              <Phone className="w-5 h-5 mr-2" />
              1-855-GOT-WAYS
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
