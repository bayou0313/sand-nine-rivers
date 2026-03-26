import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "How much sand is 9 cubic yards?",
    a: "9 cubic yards covers approximately 1,300 square feet at 2 inches deep, or about 975 square feet at 3 inches deep. It's roughly equivalent to a standard dump truck load.",
  },
  {
    q: "What type of sand do you deliver?",
    a: "We deliver clean, screened river sand that's ideal for construction fill, landscaping, drainage, and general grading projects.",
  },
  {
    q: "How quickly can you deliver?",
    a: "We offer same-day delivery for orders placed before 10:00 AM Central Time on weekdays. Next-day delivery is always available. Saturday delivery is available with a $35 surcharge.",
  },
  {
    q: "Where do you deliver?",
    a: "We deliver across the Greater New Orleans area. Deliveries within 15 miles are $195 flat. Beyond 15 miles, a small per-mile charge applies.",
  },
  {
    q: "What if I need more or less than 9 yards?",
    a: "Our standard load is 9 cubic yards. For larger projects needing multiple loads, call us for volume pricing. We're happy to work with you on custom orders.",
  },
  {
    q: "How do I pay?",
    a: "We accept credit/debit cards online (secured by Stripe) and Cash on Delivery (COD) — cash or check accepted at the time of delivery.",
  },
  {
    q: "Do you deliver on Saturdays?",
    a: "Yes! Saturday delivery is available with a $35 surcharge. Limited spots are available, so we recommend booking early.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">FAQ</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl text-foreground">FREQUENTLY ASKED QUESTIONS ABOUT RIVER SAND DELIVERY</motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-card border border-border rounded-2xl px-6 hover:border-primary/30 transition-colors data-[state=open]:shadow-lg"
              >
                <AccordionTrigger className="font-display text-lg text-foreground tracking-wider hover:no-underline">
                  {faq.q.toUpperCase()}
                </AccordionTrigger>
                <AccordionContent className="font-body text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
