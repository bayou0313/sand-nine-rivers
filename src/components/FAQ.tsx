import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "How quickly can you deliver river sand in New Orleans?",
    a: "WAYS offers same-day delivery across Greater New Orleans for orders placed before noon Monday through Saturday. Our GPS-tracked trucks operate throughout Orleans, Jefferson, St. Bernard, and St. Tammany parishes. For large commercial orders or specific delivery windows, call 1-855-GOT-WAYS to confirm availability.",
  },
  {
    q: "What type of river sand do you deliver?",
    a: "We deliver natural river sand sourced from local suppliers — the same coarse, rounded-grain material used by New Orleans contractors for drainage projects, landscaping, and construction base layers. It is not beach sand or manufactured sand. If you have specific gradation requirements for a commercial project, contact us and we will confirm the specification.",
  },
  {
    q: "How much does river sand delivery cost in New Orleans?",
    a: "WAYS prices river sand by the yard based on delivery distance and load size. A standard 9-yard load starts at $195. Larger loads of 14–20 yards or 21+ yards are priced separately. Pricing includes delivery to your address — there are no hidden fuel surcharges. Use the pricing calculator on this page for an instant estimate based on your location.",
  },
  {
    q: "Where do you deliver river sand?",
    a: "We serve Greater New Orleans including Orleans Parish, Jefferson Parish, Metairie, Kenner, Chalmette, Slidell, and surrounding areas. Service availability and pricing may vary based on distance. Enter your address in the delivery calculator above to confirm coverage and get your instant quote.",
  },
  {
    q: "What if I need more or less than 9 yards?",
    a: "9 yards is our minimum load size. We also offer 14–20 yard loads and 21+ yard loads for larger projects. If your project requires less than 9 yards, the 9-yard load is still your most cost-effective option as there is no smaller delivery tier. Call us if you're unsure — we're happy to help you size your order correctly.",
  },
  {
    q: "Do you deliver on Saturdays?",
    a: "Yes. WAYS delivers Monday through Saturday. We do not currently offer Sunday delivery. Same-day Saturday orders must be placed before noon. For urgent or large Saturday deliveries, we recommend calling ahead to confirm truck availability.",
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
