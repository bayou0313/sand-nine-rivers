import { Truck, MapPin, Package, DollarSign, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const LOOP_DURATION = 3;
const PAUSE = 1.5;
const TOTAL = LOOP_DURATION + PAUSE;

const Pricing = () => {
  // Curved path for the truck to follow
  const routePath = "M 60,140 C 120,60 200,180 300,100 C 380,40 440,120 540,130";

  return (
    <section id="pricing" className="relative py-20 md:py-28 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-accent font-display text-lg tracking-widest mb-3"
          >
            HOW IT WORKS
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl text-foreground font-display"
          >
            From Our Pit to Your Property
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="font-body text-muted-foreground mt-4 text-lg max-w-2xl mx-auto"
          >
            9 cubic yards of clean river sand, delivered curbside. Price based on distance — enter your address to see yours.
          </motion.p>
        </div>

        {/* Map route illustration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="relative bg-background border border-border rounded-3xl overflow-hidden shadow-sm">
            <svg
              viewBox="0 0 600 240"
              className="w-full h-auto"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Map background grid */}
              <defs>
                <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-foreground" opacity="0.06" />
                </pattern>
                {/* Road dash pattern */}
                <filter id="roadShadow" x="-5%" y="-5%" width="110%" height="110%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
                </filter>
              </defs>
              <rect width="600" height="240" fill="url(#mapGrid)" />

              {/* Decorative map elements - subtle blocks */}
              <rect x="130" y="30" width="40" height="25" rx="3" className="fill-muted" opacity="0.3" />
              <rect x="250" y="160" width="55" height="30" rx="3" className="fill-muted" opacity="0.25" />
              <rect x="400" y="50" width="45" height="20" rx="3" className="fill-muted" opacity="0.2" />
              <rect x="180" y="170" width="30" height="20" rx="3" className="fill-muted" opacity="0.2" />
              <rect x="450" y="170" width="35" height="25" rx="3" className="fill-muted" opacity="0.25" />
              
              {/* Decorative cross streets */}
              <line x1="150" y1="20" x2="150" y2="240" className="stroke-border" strokeWidth="1" opacity="0.3" />
              <line x1="300" y1="20" x2="300" y2="240" className="stroke-border" strokeWidth="1" opacity="0.2" />
              <line x1="450" y1="20" x2="450" y2="240" className="stroke-border" strokeWidth="1" opacity="0.3" />
              <line x1="20" y1="80" x2="580" y2="80" className="stroke-border" strokeWidth="1" opacity="0.15" />
              <line x1="20" y1="180" x2="580" y2="180" className="stroke-border" strokeWidth="1" opacity="0.15" />

              {/* Route shadow */}
              <path
                d={routePath}
                fill="none"
                className="stroke-border"
                strokeWidth="8"
                strokeLinecap="round"
                filter="url(#roadShadow)"
              />

              {/* Route background */}
              <path
                d={routePath}
                fill="none"
                className="stroke-border"
                strokeWidth="6"
                strokeLinecap="round"
              />

              {/* Route animated fill */}
              <motion.path
                d={routePath}
                fill="none"
                className="stroke-accent"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.6 }}
                animate={{ pathLength: [0, 1, 1, 0], opacity: [0.6, 0.6, 0.6, 0] }}
                transition={{
                  duration: TOTAL,
                  times: [0, LOOP_DURATION / TOTAL, (LOOP_DURATION + 0.2) / TOTAL, 1],
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeInOut",
                }}
              />

              {/* Route dashed center */}
              <path
                d={routePath}
                fill="none"
                stroke="white"
                strokeWidth="1"
                strokeDasharray="6 8"
                strokeLinecap="round"
                opacity="0.3"
              />

              {/* Origin marker - Our Pit */}
              <g>
                <circle cx="60" cy="140" r="18" className="fill-accent/15 stroke-accent" strokeWidth="2" />
                <circle cx="60" cy="140" r="6" className="fill-accent" />
                <text x="60" y="175" textAnchor="middle" className="fill-foreground font-display" fontSize="11" fontWeight="600">Our Pit</text>
              </g>

              {/* Destination marker - Your Place */}
              <g>
                <circle cx="540" cy="130" r="18" className="fill-primary/10 stroke-primary" strokeWidth="2" />
                {/* House icon */}
                <path d="M533,134 L540,126 L547,134 L547,140 L533,140 Z" className="fill-primary/30 stroke-primary" strokeWidth="1.5" strokeLinejoin="round" />
                <rect x="537" y="135" width="6" height="5" className="fill-primary/50" rx="0.5" />
                <text x="540" y="165" textAnchor="middle" className="fill-foreground font-display" fontSize="11" fontWeight="600">Your Place</text>
              </g>

              {/* Truck moving along the curve */}
              <motion.g
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: ["0%", "85%", "85%", "0%"] }}
                transition={{
                  duration: TOTAL,
                  times: [0, LOOP_DURATION / TOTAL, (LOOP_DURATION + 0.2) / TOTAL, 1],
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeInOut",
                }}
                style={{
                  offsetPath: `path("${routePath}")`,
                  offsetRotate: "auto",
                }}
              >
                <rect x="-14" y="-14" width="28" height="28" rx="7" className="fill-accent" />
                <g transform="translate(-8,-8) scale(0.67)" className="text-accent-foreground">
                  <path d="M1 3h15v13H1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M16 8h4l3 3v5h-7V8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="5.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="18.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                </g>
              </motion.g>
            </svg>

            {/* Label overlay */}
            <div className="px-6 py-4 text-center border-t border-border">
              <p className="text-sm text-muted-foreground font-body">
                Price calculated by distance — <a href="#estimator" className="text-accent font-medium hover:text-accent/80 transition-colors">enter your address to see yours</a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* What's included strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-center mb-8"
        >
          {[
            { icon: Package, text: "9 cu yd per load" },
            { icon: Truck, text: "Mon–Sat delivery" },
            { icon: MapPin, text: "Greater New Orleans" },
            { icon: DollarSign, text: "No hidden fees" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-muted-foreground font-body text-sm">
              <item.icon className="w-4 h-4 text-accent" /> {item.text}
            </div>
          ))}
        </motion.div>

        {/* Curbside notice */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground/60 text-xs font-body max-w-lg mx-auto mb-8"
        >
          All deliveries are curbside only. Due to liability, we cannot deliver inside backyards or enclosed areas.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <a
            href="#estimator"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-display tracking-wider text-sm px-6 py-3 rounded-full hover:bg-accent/90 transition-colors"
          >
            Check my exact price <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
