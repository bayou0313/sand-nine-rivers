import { Truck, MapPin, Package, DollarSign, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

// Route follows roads: east → south → east → south → east
const forwardPath = "M 55,155 L 195,155 A 8,8 0 0 1 203,147 L 203,95 A 8,8 0 0 1 211,87 L 395,87 A 8,8 0 0 0 403,95 L 403,135 A 8,8 0 0 0 411,143 L 540,143";
const returnPath = "M 540,143 L 411,143 A 8,8 0 0 1 403,135 L 403,95 A 8,8 0 0 1 395,87 L 211,87 A 8,8 0 0 0 203,95 L 203,147 A 8,8 0 0 0 195,155 L 55,155";

// Alt route (different path through the grid)
const altForwardPath = "M 55,155 L 95,155 A 8,8 0 0 1 103,147 L 103,95 A 8,8 0 0 1 111,87 L 295,87 A 8,8 0 0 0 303,95 L 303,143 A 8,8 0 0 0 311,151 L 495,151 A 8,8 0 0 1 503,143 L 540,143";

const FWD_DUR = 5;
const PAUSE_DEST = 2;
const RET_DUR = 4;
const PAUSE_ORIGIN = 1.5;
const TOTAL = FWD_DUR + PAUSE_DEST + RET_DUR + PAUSE_ORIGIN;

// Truck facing right (cab on right side)
const TruckIcon = () => (
  <g transform="rotate(180) translate(-1, 0)">
    <rect x="-14" y="-14" width="28" height="28" rx="7" className="fill-accent" />
    <g transform="translate(-7,-7) scale(0.58)" className="text-accent-foreground">
      <path d="M1 3h15v13H1z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M16 8h4l3 3v5h-7V8z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="5.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>
  </g>
);

const Pricing = () => {
  const t1 = FWD_DUR / TOTAL;
  const t2 = (FWD_DUR + PAUSE_DEST) / TOTAL;
  const t3 = (FWD_DUR + PAUSE_DEST + RET_DUR) / TOTAL;

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
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-foreground" opacity="0.06" />
                </pattern>
                <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(200 55% 72%)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="hsl(200 55% 60%)" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Base */}
              <rect width="600" height="260" className="fill-background" />
              <rect width="600" height="260" fill="url(#mapGrid)" />

              {/* River */}
              <path d="M -10,28 C 60,42 130,15 200,35 C 270,55 340,22 420,18 C 490,14 560,30 620,20" fill="none" stroke="url(#waterGrad)" strokeWidth="20" strokeLinecap="round" />
              <path d="M -10,28 C 60,42 130,15 200,35 C 270,55 340,22 420,18 C 490,14 560,30 620,20" fill="none" stroke="hsl(200 50% 60%)" strokeWidth="0.8" opacity="0.15" />

              {/* === ROAD NETWORK === */}
              {/* Highway horizontal */}
              <line x1="0" y1="87" x2="600" y2="87" className="stroke-border" strokeWidth="12" opacity="0.08" />
              <line x1="0" y1="87" x2="600" y2="87" className="stroke-border" strokeWidth="1" opacity="0.2" />

              {/* Secondary horizontals */}
              <line x1="0" y1="155" x2="600" y2="155" className="stroke-border" strokeWidth="8" opacity="0.06" />
              <line x1="0" y1="155" x2="600" y2="155" className="stroke-border" strokeWidth="0.8" opacity="0.15" />
              <line x1="0" y1="210" x2="600" y2="210" className="stroke-border" strokeWidth="6" opacity="0.05" />
              <line x1="0" y1="55" x2="600" y2="55" className="stroke-border" strokeWidth="5" opacity="0.04" />
              <line x1="0" y1="143" x2="600" y2="143" className="stroke-border" strokeWidth="5" opacity="0.04" />
              <line x1="0" y1="120" x2="600" y2="120" className="stroke-border" strokeWidth="3" opacity="0.03" />
              <line x1="0" y1="180" x2="600" y2="180" className="stroke-border" strokeWidth="3" opacity="0.03" />

              {/* Major verticals */}
              <line x1="100" y1="0" x2="100" y2="260" className="stroke-border" strokeWidth="7" opacity="0.06" />
              <line x1="103" y1="0" x2="103" y2="260" className="stroke-border" strokeWidth="7" opacity="0.06" />
              <line x1="203" y1="0" x2="203" y2="260" className="stroke-border" strokeWidth="10" opacity="0.07" />
              <line x1="300" y1="0" x2="300" y2="260" className="stroke-border" strokeWidth="7" opacity="0.06" />
              <line x1="303" y1="0" x2="303" y2="260" className="stroke-border" strokeWidth="7" opacity="0.06" />
              <line x1="403" y1="0" x2="403" y2="260" className="stroke-border" strokeWidth="10" opacity="0.07" />
              <line x1="500" y1="0" x2="500" y2="260" className="stroke-border" strokeWidth="7" opacity="0.06" />
              <line x1="503" y1="0" x2="503" y2="260" className="stroke-border" strokeWidth="7" opacity="0.06" />

              {/* Minor verticals */}
              <line x1="150" y1="55" x2="150" y2="210" className="stroke-border" strokeWidth="3" opacity="0.04" />
              <line x1="250" y1="55" x2="250" y2="210" className="stroke-border" strokeWidth="3" opacity="0.04" />
              <line x1="350" y1="55" x2="350" y2="210" className="stroke-border" strokeWidth="3" opacity="0.04" />
              <line x1="450" y1="55" x2="450" y2="210" className="stroke-border" strokeWidth="3" opacity="0.04" />
              <line x1="550" y1="55" x2="550" y2="210" className="stroke-border" strokeWidth="3" opacity="0.04" />

              {/* === BUILDINGS === */}
              <rect x="210" y="58" width="22" height="14" rx="2" className="fill-muted-foreground" opacity="0.07" />
              <rect x="238" y="58" width="16" height="18" rx="2" className="fill-muted-foreground" opacity="0.06" />
              <rect x="260" y="60" width="30" height="12" rx="2" className="fill-muted-foreground" opacity="0.05" />
              <rect x="210" y="95" width="25" height="18" rx="2" className="fill-muted-foreground" opacity="0.06" />
              <rect x="240" y="98" width="18" height="14" rx="2" className="fill-muted-foreground" opacity="0.05" />
              <rect x="265" y="95" width="28" height="18" rx="2" className="fill-muted-foreground" opacity="0.06" />
              <rect x="108" y="95" width="14" height="10" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="128" y="93" width="16" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="108" y="125" width="18" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="108" y="160" width="14" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="155" y="160" width="20" height="10" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="410" y="58" width="18" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="435" y="60" width="12" height="18" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="455" y="58" width="20" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="410" y="95" width="30" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="450" y="95" width="16" height="16" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="505" y="95" width="22" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="505" y="148" width="18" height="16" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="310" y="95" width="22" height="16" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="310" y="160" width="26" height="14" rx="1.5" className="fill-muted-foreground" opacity="0.05" />
              <rect x="210" y="160" width="20" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.04" />
              <rect x="410" y="160" width="24" height="12" rx="1.5" className="fill-muted-foreground" opacity="0.04" />

              {/* Parks */}
              <ellipse cx="470" cy="190" rx="16" ry="12" className="fill-green-600" opacity="0.06" />
              <circle cx="466" cy="186" r="2.5" className="fill-green-600" opacity="0.1" />
              <circle cx="474" cy="193" r="2" className="fill-green-600" opacity="0.08" />
              <ellipse cx="155" cy="195" rx="12" ry="9" className="fill-green-600" opacity="0.05" />

              {/* Road labels */}
              <text x="50" y="84" fontSize="5.5" className="fill-muted-foreground" opacity="0.3" fontFamily="sans-serif" fontWeight="600">HWY 90</text>
              <text x="50" y="152" fontSize="5" className="fill-muted-foreground" opacity="0.25" fontFamily="sans-serif">RIVER RD</text>
              <text x="206" y="50" fontSize="5" className="fill-muted-foreground" opacity="0.25" fontFamily="sans-serif" transform="rotate(-90 206 50)">CAUSEWAY</text>
              <text x="406" y="50" fontSize="5" className="fill-muted-foreground" opacity="0.25" fontFamily="sans-serif" transform="rotate(-90 406 50)">VETERANS</text>
              <text x="50" y="140" fontSize="4.5" className="fill-muted-foreground" opacity="0.2" fontFamily="sans-serif">AIRLINE</text>
              <text x="106" y="50" fontSize="4.5" className="fill-muted-foreground" opacity="0.2" fontFamily="sans-serif" transform="rotate(-90 106 50)">WILLIAMS</text>
              <text x="306" y="50" fontSize="4.5" className="fill-muted-foreground" opacity="0.2" fontFamily="sans-serif" transform="rotate(-90 306 50)">CLEARY</text>

              {/* === ALTERNATE ROUTE (faint) === */}
              <path d={altForwardPath} fill="none" className="stroke-muted-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.06" strokeDasharray="4 6" />

              {/* === PRIMARY ROUTE === */}
              <path d={forwardPath} fill="none" className="stroke-foreground" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.03" />
              <path d={forwardPath} fill="none" className="stroke-accent" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
              <path d={forwardPath} fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="5 7" strokeLinecap="round" opacity="0.2" />

              {/* Animated route highlight */}
              <motion.path
                d={forwardPath}
                fill="none"
                className="stroke-accent"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: [0, 1, 1, 1, 0],
                  opacity: [0.7, 0.7, 0.7, 0.7, 0],
                }}
                transition={{
                  duration: TOTAL,
                  times: [0, t1, t2, t3, 1],
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* === MARKERS === */}
              {/* Origin */}
              <g>
                <motion.circle cx="55" cy="155" r="20" className="fill-accent" opacity="0.08"
                  animate={{ r: [20, 26, 20] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <circle cx="55" cy="155" r="14" className="fill-background stroke-accent" strokeWidth="2" />
                <circle cx="55" cy="155" r="4.5" className="fill-accent" />
                <text x="55" y="180" textAnchor="middle" className="fill-foreground" fontSize="9" fontWeight="700" fontFamily="sans-serif">Our Pit</text>
              </g>

              {/* Destination */}
              <g>
                <motion.circle cx="540" cy="143" r="20" className="fill-primary" opacity="0.06"
                  animate={{ r: [20, 26, 20] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
                <circle cx="540" cy="143" r="14" className="fill-background stroke-primary" strokeWidth="2" />
                <path d="M533,147 L540,138 L547,147 L547,152 L533,152 Z" className="fill-primary/40 stroke-primary" strokeWidth="1.2" strokeLinejoin="round" />
                <rect x="537" y="148" width="6" height="4" rx="0.5" className="fill-primary/60" />
                <text x="540" y="172" textAnchor="middle" className="fill-foreground" fontSize="9" fontWeight="700" fontFamily="sans-serif">Your Place</text>
              </g>

              {/* === TRUCK FORWARD === */}
              <motion.g
                animate={{ opacity: [1, 1, 0, 0, 0, 1] }}
                transition={{
                  duration: TOTAL,
                  times: [0, t1, t1 + 0.005, t2, t2 + 0.005, 1],
                  repeat: Infinity,
                }}
              >
                <motion.g
                  style={{
                    offsetPath: `path("${forwardPath}")`,
                    offsetRotate: "auto" as any,
                  }}
                  animate={{ offsetDistance: ["0%", "100%", "100%"] }}
                  transition={{
                    duration: TOTAL,
                    times: [0, t1, 1],
                    repeat: Infinity,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  <TruckIcon />
                </motion.g>
              </motion.g>

              {/* === TRUCK RETURN === */}
              <motion.g
                animate={{ opacity: [0, 0, 1, 1, 1, 0] }}
                transition={{
                  duration: TOTAL,
                  times: [0, t2 - 0.005, t2, t3, t3 + 0.005, 1],
                  repeat: Infinity,
                }}
              >
                <motion.g
                  style={{
                    offsetPath: `path("${returnPath}")`,
                    offsetRotate: "auto" as any,
                  }}
                  animate={{ offsetDistance: ["0%", "0%", "0%", "100%", "100%"] }}
                  transition={{
                    duration: TOTAL,
                    times: [0, t2, t2 + 0.001, t3, 1],
                    repeat: Infinity,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  <TruckIcon />
                </motion.g>
              </motion.g>
            </svg>

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
