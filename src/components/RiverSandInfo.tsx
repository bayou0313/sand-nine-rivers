import { motion } from "framer-motion";
import { Droplets, Shovel, Calculator } from "lucide-react";

const RiverSandInfo = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-accent font-display text-lg tracking-widest mb-3"
          >
            LEARN MORE
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl text-foreground"
          >
            WHAT IS RIVER SAND AND WHEN SHOULD YOU USE IT?
          </motion.h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="font-body text-muted-foreground leading-relaxed text-lg">
              River sand is a naturally occurring granular material dredged or mined from riverbeds and banks. Its rounded grain structure and moderate coarseness make it one of the most versatile construction and landscaping materials available in the Greater New Orleans area. Unlike crushed stone or manufactured sand, river sand compacts well without becoming completely impermeable, which makes it particularly valuable in the low-lying, high-moisture soil conditions common throughout Southeast Louisiana.
            </p>
          </motion.div>

          {/* River Sand vs Fill Dirt */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background border border-border rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Droplets className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">RIVER SAND VS. FILL DIRT: WHICH DO YOU NEED?</h3>
            </div>
            <p className="font-body text-muted-foreground leading-relaxed mb-4">
              This is one of the most common questions we receive from both homeowners and contractors. The short answer: it depends on drainage.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">River sand</strong> is the right choice when you need drainage, a stable base layer, or a clean medium for plant growth. Use it for French drains, beneath pavers, around pool areas, in sandbox installations, and for leveling low spots in yards prone to standing water.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Fill dirt</strong>, by contrast, is better suited for bulk volume fills — raising grade levels, filling large voids after excavation, or creating foundational base under slabs. It is less expensive per yard but offers minimal drainage benefit.
            </p>
          </motion.div>

          {/* How Many Yards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background border border-border rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calculator className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">HOW MANY YARDS OF RIVER SAND DO YOU NEED?</h3>
            </div>
            <p className="font-body text-muted-foreground leading-relaxed mb-4">
              Calculating your order correctly saves you money and avoids a second delivery. Use this simple formula:
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center mb-4">
              <p className="font-display text-lg text-foreground">
                Length (ft) × Width (ft) × Depth (in) ÷ 324 = Cubic Yards
              </p>
            </div>
            <p className="font-body text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Example:</strong> A 20 ft × 15 ft area filled 3 inches deep requires (20 × 15 × 3) ÷ 324 = approximately 2.8 yards. Round up to 3 yards to account for compaction and uneven surfaces.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed">
              Not sure how much you need? Call{" "}
              <a href="tel:+18554689297" className="text-accent hover:underline font-display">
                1-855-GOT-WAYS
              </a>{" "}
              and a team member will calculate it for you based on your project dimensions.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default RiverSandInfo;
