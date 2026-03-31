import { useState } from "react";
import { motion } from "framer-motion";
import { Droplets, Calculator, HelpCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

const RiverSandInfo = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <section id="learn-more" className="py-24 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-8">
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
            What Is River Sand and When Should You Use It?
          </motion.h2>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Always-visible intro */}
          <div className="mb-6">
            <p className="font-body text-muted-foreground leading-relaxed text-lg">
              Not all sand is the same, and in a city like New Orleans — where drainage is everything — using the right material for the right application is the difference between a project that holds and one that fails inside two wet seasons.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed text-lg mt-4">
              The river sand RIVERSAND.NET delivers is pumped directly from the Mississippi River. It's a natural, unscreened material sourced from one of the most active waterways in North America, which gives it a distinct set of properties that make it particularly well-suited for the soil conditions and drainage challenges common across Southeast Louisiana.
            </p>

            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-4 flex items-center gap-1.5 text-sm font-display text-accent hover:text-accent/80 transition-colors tracking-wider mx-auto"
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Read more <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {expanded && (
          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
            <p className="font-body text-muted-foreground leading-relaxed text-lg">
              The rounded grain also means it compacts consistently without fully sealing, which is critical in low-lying areas where water management is the primary concern. It settles firmly underfoot or under pavers without creating an impermeable base that traps water below the surface — a problem that affects poorly chosen fill materials in flood-prone areas like the Orleans and Jefferson Parish lowlands.
            </p>
            </motion.div>

          {/* Callout: Pumped from the Mississippi */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-accent/10 border border-accent/30 rounded-2xl p-6"
          >
            <h4 className="font-display text-lg text-foreground mb-2">PUMPED FROM THE MISSISSIPPI RIVER — WHAT THAT MEANS FOR YOUR PROJECT</h4>
            <p className="font-body text-muted-foreground leading-relaxed text-sm">
              Mississippi River sand has a naturally rounded grain structure shaped by decades of water flow and sediment movement. That rounded grain allows water to pass through it easily, which is why it outperforms angular manufactured sands in drainage applications. Because we pump it directly from the river, it arrives in its natural state — no artificial additives, no chemical processing — just the same material contractors across New Orleans have relied on for generations.
            </p>
          </motion.div>

          {/* Is Unscreened Sand Right? */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background border border-border rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground">IS UNSCREENED SAND RIGHT FOR MY PROJECT?</h3>
            </div>
            <p className="font-body text-muted-foreground leading-relaxed mb-4">
              This is the question we hear most often from first-time buyers, and it's a fair one. "Unscreened" means the sand has not been run through a mechanical screen to remove oversized particles or standardize grain size. It is not a quality issue — it is a processing difference. The sand you receive from RIVERSAND.NET looks clean, performs reliably, and is the same material used daily by New Orleans landscapers, drainage contractors, and construction crews.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed mb-4">
              What unscreened does mean in practice: there may occasionally be small traces of shell fragments, organic material, or minor size variation in the load. For the vast majority of applications — French drains, yard leveling, paver base, sandbox fills, pool surrounds, and backfill — this has no meaningful impact on performance.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed mb-6">
              Where it matters is in applications that require a tightly controlled gradation. If you are mixing mortar, laying brick, producing ready-mix concrete, or working to an ASTM specification on a commercial project, you need a screened and graded product. In those cases, masonry sand or concrete sand is the correct choice — and we can point you in the right direction.
            </p>

            {/* Use / Skip Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-5">
                <h4 className="font-display text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-accent" />
                  USE RIVER SAND WHEN...
                </h4>
                <ul className="space-y-2 font-body text-muted-foreground text-sm">
                  {[
                    "French drains & drainage channels",
                    "Leveling low spots & yard grading",
                    "Paver and flagstone base layer",
                    "Pool surrounds & sandboxes",
                    "Backfill around pipes & utilities",
                    "Erosion control & slope stabilization",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-accent mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/50 border border-border rounded-xl p-5">
                <h4 className="font-display text-foreground mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                  SKIP RIVER SAND WHEN...
                </h4>
                <ul className="space-y-2 font-body text-muted-foreground text-sm">
                  {[
                    "Mortar or masonry mixing",
                    "Ready-mix or structural concrete",
                    "ASTM-spec commercial projects",
                    "Brick or block laying (use masonry sand)",
                    "Fine plaster or stucco work",
                    "High-precision gradation requirements",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="font-body text-muted-foreground leading-relaxed mt-4 text-sm">
              Not sure which material fits your project? Call{" "}
              <a href="tel:+18554689297" className="text-accent hover:underline font-display">1-855-GOT-WAYS</a>{" "}
              and describe what you are building. We will tell you honestly whether river sand is the right call or whether you should be looking at something else.
            </p>
          </motion.div>

          {/* River Sand vs Fill Dirt vs Other Materials */}
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
              <h3 className="font-display text-2xl text-foreground">RIVER SAND VS. FILL DIRT VS. OTHER MATERIALS</h3>
            </div>
            <p className="font-body text-muted-foreground leading-relaxed mb-6">
              New Orleans contractors and homeowners frequently ask us to compare river sand against fill dirt, masonry sand, and concrete sand. The short version: if drainage is involved in any form, river sand is almost always the better choice over fill dirt.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-display text-foreground">MATERIAL</th>
                    <th className="text-left py-3 px-4 font-display text-foreground">WHAT IT IS</th>
                    <th className="text-left py-3 px-4 font-display text-foreground">BEST USED FOR</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { material: "River Sand (unscreened, Mississippi)", what: "Natural rounded grain, traces of shell/organics possible", best: "Drainage, leveling, landscaping, backfill, French drains, pool surrounds" },
                    { material: "Masonry Sand (screened)", what: "Fine, uniform, mechanically graded", best: "Mortar mixing, brick laying, plaster, controlled-spec construction" },
                    { material: "Concrete Sand (screened)", what: "Coarser, angular, graded to ASTM spec", best: "Ready-mix concrete, commercial slab work, spec-driven projects" },
                    { material: "Fill Dirt", what: "Clay-heavy, no drainage benefit", best: "Bulk grade raising, void filling, foundation base (non-drainage)" },
                  ].map((row, i) => (
                    <tr key={row.material} className={`border-b border-border/50 ${i === 0 ? "bg-accent/5" : ""}`}>
                      <td className="py-3 px-4 font-display text-foreground text-xs">{row.material}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.what}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="font-body text-muted-foreground leading-relaxed mt-4 text-sm">
              Fill dirt is the most common alternative considered for large-volume projects. It is cheaper per yard, but it is clay-heavy, compacts tightly, and offers no drainage benefit. In New Orleans's flat, high-water-table environment, placing fill dirt in a drainage context is a common and costly mistake. River sand costs more per yard and it earns that difference in performance on any water-management application.
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
              Ordering the right amount on the first delivery saves you the cost and delay of a second truck. Use this formula:
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center mb-4">
              <p className="font-display text-lg text-foreground">
                Length (ft) × Width (ft) × Depth (in) ÷ 324 = Cubic Yards
              </p>
              <p className="font-body text-muted-foreground text-sm mt-2 italic">
                Example: A 20 ft × 15 ft area at 3 inches deep = (20 × 15 × 3) ÷ 324 = 2.8 yards → order 3 yards.
              </p>
            </div>
            <p className="font-body text-muted-foreground leading-relaxed mb-6 text-sm">
              Always round up by at least 10%. River sand compacts slightly when placed, and uneven surfaces consume more material than the formula anticipates. A small excess is far less disruptive than running short mid-project.
            </p>

            {/* Common estimates */}
            <h4 className="font-display text-foreground mb-3">COMMON PROJECT ESTIMATES</h4>
            <ul className="space-y-2 font-body text-muted-foreground text-sm">
              {[
                "Backyard French drain (50 ft trench, 12 in wide, 18 in deep): ~2.9 yards → order 3–4",
                "Paver base for a 400 sq ft patio (4 in deep): ~5.0 yards → order 6",
                "Sandbox (8 ft × 8 ft, 12 in deep): ~2.4 yards → order 3",
                "Leveling a 1,500 sq ft yard (2 in average fill): ~9.3 yards → order our 9-yard load",
                "Pool surround and drainage (varies widely): ~6–12 yards → call us to size correctly",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mt-6">
              <p className="font-body text-muted-foreground text-sm">
                <strong className="text-foreground">Not sure how much you need?</strong> Call{" "}
                <a href="tel:+18554689297" className="text-accent hover:underline font-display">1-855-GOT-WAYS</a>{" "}
                with your project dimensions. We calculate it for you at no charge. It takes about two minutes and we have done it thousands of times.
              </p>
            </div>
          </motion.div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RiverSandInfo;