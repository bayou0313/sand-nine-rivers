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
    a: "We offer same-day delivery for orders placed before noon, and next-day delivery is available for all orders. Call us to confirm availability for your area.",
  },
  {
    q: "Where do you deliver?",
    a: "We deliver within a 25-mile radius of our yard at 1215 River Rd, Bridge City, LA 70094. Deliveries within 15 miles are $195 flat. Beyond 15 miles, a small per-mile charge applies.",
  },
  {
    q: "What if I need more or less than 9 yards?",
    a: "Our standard load is 9 cubic yards. For larger projects needing multiple loads, call us for volume pricing. We're happy to work with you on custom orders.",
  },
  {
    q: "How do I pay?",
    a: "We accept Cash on Delivery (COD). Payment is due at the time of delivery — cash or check accepted. You can place your order online and pay when the sand arrives.",
  },
  {
    q: "Can I order online?",
    a: "Yes! Use our Order Now page to enter your delivery address, get an instant price, and place your order. Payment is COD — you pay when we deliver.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">FAQ</p>
          <h2 className="text-5xl md:text-6xl text-foreground">ASK US ANYTHING</h2>
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
                className="bg-card border border-border rounded-lg px-6 hover:border-primary/30 transition-colors"
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
