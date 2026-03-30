import { Truck, MapPin, Package, DollarSign, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const LOOP_DURATION = 3.5;
const PAUSE = 1.8;
const TOTAL = LOOP_DURATION + PAUSE;

const Pricing = () => {
  const routePath = "M 60,140 C 120,60 200,180 300,100 C 380,40 440,120 540,130";
  // Reversed path for return trip
  const returnPath = "M 540,130 C 440,120 380,40 300,100 C 200,180 120,60 60,140";

  return (
    <section id="pricing" className="relative py-20 md:py-28 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">
            HOW IT WORKS
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-5xl text-foreground font-display">
            From Our Pit to Your Property
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="font-body text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
            9 cubic yards of clean river sand, delivered curbside. Price based on distance — enter your address to see yours.
          </motion.p>
        </div>

        {/* Map illustration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="relative bg-background border border-border rounded-3xl overflow-hidden shadow-sm">
            <svg viewBox="0 0 600 260" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.4" className="text-foreground" opacity="0.05" />
                </pattern>
                <pattern id="grassPattern" width="8" height="8" patternUnits="userSpaceOnUse">
                  <circle cx="4" cy="4" r="0.6" fill="currentColor" className="text-green-600" opacity="0.08" />
                </pattern>
                <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(200 60% 70%)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="hsl(200 60% 60%)" stopOpacity="0.18" />
                </linearGradient>
              </defs>

              {/* Base */}
              <rect width="600" height="260" fill="url(#mapGrid)" />
              <rect width="600" height="260" fill="url(#grassPattern)" />

              {/* Water feature - river/bayou */}
              <path d="M -10,20 C 80,35 140,10 200,30 C 260,50 300,25 370,15 C 430,5 500,25 610,10" fill="none" stroke="url(#waterGrad)" strokeWidth="18" strokeLinecap="round" />
              <path d="M -10,20 C 80,35 140,10 200,30 C 260,50 300,25 370,15 C 430,5 500,25 610,10" fill="none" stroke="hsl(200 50% 65%)" strokeWidth="1" strokeLinecap="round" opacity="0.15" />

              {/* Major roads (horizontal) */}
              <line x1="0" y1="80" x2="600" y2="80" className="stroke-border" strokeWidth="3" opacity="0.15" />
              <line x1="0" y1="180" x2="600" y2="180" className="stroke-border" strokeWidth="2" opacity="0.1" />
              <line x1="0" y1="220" x2="600" y2="220" className="stroke-border" strokeWidth="2" opacity="0.08" />

              {/* Major roads (vertical) */}
              <line x1="100" y1="40" x2="100" y2="260" className="stroke-border" strokeWidth="2" opacity="0.12" />
              <line x1="200" y1="0" x2="200" y2="260" className="stroke-border" strokeWidth="3" opacity="0.15" />
              <line x1="300" y1="40" x2="300" y2="260" className="stroke-border" strokeWidth="2" opacity="0.1" />
              <line x1="400" y1="0" x2="400" y2="260" className="stroke-border" strokeWidth="3" opacity="0.15" />
              <line x1="500" y1="40" x2="500" y2="260" className="stroke-border" strokeWidth="2" opacity="0.12" />

              {/* Minor streets */}
              <line x1="150" y1="60" x2="150" y2="200" className="stroke-border" strokeWidth="1" opacity="0.06" />
              <line x1="250" y1="50" x2="250" y2="240" className="stroke-border" strokeWidth="1" opacity="0.06" />
              <line x1="350" y1="40" x2="350" y2="220" className="stroke-border" strokeWidth="1" opacity="0.06" />
              <line x1="450" y1="50" x2="450" y2="240" className="stroke-border" strokeWidth="1" opacity="0.06" />
              <line x1="0" y1="130" x2="600" y2="130" className="stroke-border" strokeWidth="1" opacity="0.06" />

              {/* City blocks / buildings */}
              {/* Downtown cluster */}
              <rect x="205" y="85" width="28" height="18" rx="2" className="fill-muted-foreground" opacity="0.08" />
              <rect x="240" y="85" width="20" height="24" rx="2" className="fill-muted-foreground" opacity="0.06" />
              <rect x="205" y="108" width="15" height="15" rx="2" className="fill-muted-foreground" opacity="0.07" />
              <rect x="225" y="112" width="35" height="12" rx="2" className="fill-muted-foreground" opacity="0.05" />

              {/* Residential blocks left */}
              <rect x="105" y="85" width="18" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.06" />
              <rect x="128" y="85" width="14" height="16" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="105" y="135" width="22" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.06" />
              <rect x="132" y="138" width="12" height="10" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="105" y="185" width="16" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.04" />

              {/* Residential blocks right */}
              <rect x="405" y="55" width="20" height="15" rx="1.5" className="fill-muted-foreground" opacity="0.06" />
              <rect x="430" y="58" width="14" height="18" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="405" y="85" width="35" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="455" y="85" width="18" height="15" rx="1.5" className="fill-muted-foreground" opacity="0.06" />
              <rect x="505" y="85" width="24" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="505" y="135" width="20" height="18" rx="1.5" className="fill-muted-foreground" opacity="0.06" />
              <rect x="530" y="138" width="14" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.04" />

              {/* Mid blocks */}
              <rect x="305" y="135" width="25" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.06" />
              <rect x="335" y="138" width="14" height="20" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="305" y="185" width="30" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="270" y="185" width="20" height="16" rx="1.5" className="fill-muted-foreground" opacity="0.04" />

              {/* Bottom area blocks */}
              <rect x="155" y="222" width="18" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="405" y="185" width="22" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="455" y="222" width="16" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.04" />

              {/* Park / green space */}
              <ellipse cx="480" cy="200" rx="18" ry="14" className="fill-green-600" opacity="0.06" />
              <ellipse cx="160" cy="200" rx="12" ry="10" className="fill-green-600" opacity="0.05" />

              {/* Small tree dots */}
              <circle cx="475" cy="195" r="3" className="fill-green-600" opacity="0.1" />
              <circle cx="485" cy="205" r="2.5" className="fill-green-600" opacity="0.08" />
              <circle cx="478" cy="203" r="2" className="fill-green-600" opacity="0.09" />
              <circle cx="158" cy="197" r="2.5" className="fill-green-600" opacity="0.08" />
              <circle cx="163" cy="203" r="2" className="fill-green-600" opacity="0.07" />

              {/* Route road shadow */}
              <path d={routePath} fill="none" className="stroke-foreground" strokeWidth="10" strokeLinecap="round" opacity="0.04" />

              {/* Route road fill */}
              <path d={routePath} fill="none" className="stroke-border" strokeWidth="7" strokeLinecap="round" />

              {/* Route animated highlight */}
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
                  times: [0, LOOP_DURATION / TOTAL, (LOOP_DURATION + 0.3) / TOTAL, 1],
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeInOut",
                }}
              />

              {/* Route dashed center line */}
              <path d={routePath} fill="none" stroke="white" strokeWidth="1" strokeDasharray="6 8" strokeLinecap="round" opacity="0.25" />

              {/* Origin marker */}
              <g>
                <motion.circle cx="60" cy="140" r="22" className="fill-accent" opacity="0.1"
                  animate={{ r: [22, 28, 22] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <circle cx="60" cy="140" r="16" className="fill-background stroke-accent" strokeWidth="2.5" />
                <circle cx="60" cy="140" r="5" className="fill-accent" />
                <text x="60" y="172" textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="700" fontFamily="sans-serif">Our Pit</text>
              </g>

              {/* Destination marker */}
              <g>
                <motion.circle cx="540" cy="130" r="22" className="fill-primary" opacity="0.08"
                  animate={{ r: [22, 28, 22] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
                <circle cx="540" cy="130" r="16" className="fill-background stroke-primary" strokeWidth="2.5" />
                {/* House */}
                <path d="M533,134 L540,125 L547,134 L547,139 L533,139 Z" className="fill-primary/40 stroke-primary" strokeWidth="1.5" strokeLinejoin="round" />
                <rect x="537" y="135" width="6" height="4" rx="0.5" className="fill-primary/60" />
                <text x="540" y="162" textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="700" fontFamily="sans-serif">Your Place</text>
              </g>

              {/* Truck going forward */}
              <motion.g
                animate={{ opacity: [1, 1, 0, 0, 0, 1] }}
                transition={{
                  duration: TOTAL + 0.5,
                  times: [0, LOOP_DURATION / (TOTAL + 0.5), (LOOP_DURATION + 0.01) / (TOTAL + 0.5), (LOOP_DURATION + 0.02) / (TOTAL + 0.5), TOTAL / (TOTAL + 0.5), 1],
                  repeat: Infinity,
                  repeatDelay: 0,
                }}
              >
                <motion.g
                  style={{ offsetPath: `path("${routePath}")`, offsetRotate: "auto" }}
                  animate={{ offsetDistance: ["0%", "88%"] }}
                  transition={{
                    duration: LOOP_DURATION,
                    repeat: Infinity,
                    repeatDelay: PAUSE + 0.5,
                    ease: "easeInOut",
                  }}
                >
                  <rect x="-15" y="-15" width="30" height="30" rx="8" className="fill-accent" />
                  <rect x="-15" y="-15" width="30" height="30" rx="8" fill="black" opacity="0.15" transform="translate(0,2)" />
                  <g transform="translate(-8,-8) scale(0.67)" className="text-accent-foreground">
                    <path d="M1 3h15v13H1z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <path d="M16 8h4l3 3v5h-7V8z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <circle cx="5.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="18.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </g>
                </motion.g>
              </motion.g>

              {/* Truck going back (turned around) */}
              <motion.g
                animate={{ opacity: [0, 0, 1, 1, 1, 0] }}
                transition={{
                  duration: TOTAL + 0.5,
                  times: [0, LOOP_DURATION / (TOTAL + 0.5), (LOOP_DURATION + 0.01) / (TOTAL + 0.5), (LOOP_DURATION + 0.02) / (TOTAL + 0.5), TOTAL / (TOTAL + 0.5), 1],
                  repeat: Infinity,
                  repeatDelay: 0,
                }}
              >
                <motion.g
                  style={{ offsetPath: `path("${returnPath}")`, offsetRotate: "auto" }}
                  animate={{ offsetDistance: ["0%", "88%"] }}
                  transition={{
                    duration: PAUSE - 0.1,
                    delay: LOOP_DURATION + 0.2,
                    repeat: Infinity,
                    repeatDelay: LOOP_DURATION + 0.6,
                    ease: "easeInOut",
                  }}
                >
                  <rect x="-15" y="-15" width="30" height="30" rx="8" className="fill-accent" />
                  <rect x="-15" y="-15" width="30" height="30" rx="8" fill="black" opacity="0.15" transform="translate(0,2)" />
                  <g transform="translate(-8,-8) scale(0.67)" className="text-accent-foreground">
                    <path d="M1 3h15v13H1z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <path d="M16 8h4l3 3v5h-7V8z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <circle cx="5.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="18.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </g>
                </motion.g>
              </motion.g>
            </svg>

            {/* Label */}
            <div className="px-6 py-4 text-center border-t border-border">
              <p className="text-sm text-muted-foreground font-body">
                Price calculated by distance — <a href="#estimator" className="text-accent font-medium hover:text-accent/80 transition-colors">enter your address to see yours</a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Included strip */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-center mb-8">
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

        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-muted-foreground/60 text-xs font-body max-w-lg mx-auto mb-8">
          All deliveries are curbside only. Due to liability, we cannot deliver inside backyards or enclosed areas.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
          <a href="#estimator" className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-display tracking-wider text-sm px-6 py-3 rounded-full hover:bg-accent/90 transition-colors">
            Check my exact price <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
