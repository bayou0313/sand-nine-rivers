import { useState, useEffect } from "react";
import { Truck, MapPin, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useCountdown } from "@/hooks/use-countdown";
import { supabase } from "@/integrations/supabase/client";
import { findBestPit, type PitData, type GlobalPricing } from "@/lib/pits";
import { formatCurrency } from "@/lib/format";
import OutOfAreaModal from "@/components/OutOfAreaModal";

const FALLBACK_GLOBAL: GlobalPricing = {
  base_price: 195,
  free_miles: 3,
  extra_per_mile: 15,
  max_distance: 30,
  saturday_surcharge: 35,
};

const Pricing = () => {
  const { timeLeft, label } = useCountdown();
  const [address, setAddress] = useState("");
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [pits, setPits] = useState<PitData[]>([]);
  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoded, setGeocoded] = useState(false);
  const [showOutOfArea, setShowOutOfArea] = useState(false);
  const [nearestPitInfo, setNearestPitInfo] = useState<{ name: string; distance: number; id: string } | null>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // Load Google Maps
  useEffect(() => {
    if (window.google?.maps?.places) {
      setGoogleLoaded(true);
      return;
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { console.warn("Google Maps API key not found"); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => setGoogleLoaded(true));
      if (window.google?.maps?.places) setGoogleLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init autocomplete
  useEffect(() => {
    if (!googleLoaded || !window.google?.maps?.places) return;
    const input = document.getElementById("pricing-address-input") as HTMLInputElement;
    if (!input) return;
    const ac = new window.google.maps.places.Autocomplete(input, {
      types: ["address"],
      componentRestrictions: { country: "us" },
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place?.geometry?.location) {
        setAddress(place.formatted_address || "");
        setCustomerCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
        setGeocoded(true);
      }
    });
  }, [googleLoaded]);

  // Fetch pits + global settings
  useEffect(() => {
    const load = async () => {
      const [pitsRes, settingsRes] = await Promise.all([
        supabase.from("pits").select("*").eq("status", "active"),
        supabase.from("global_settings").select("*"),
      ]);
      if (pitsRes.data) setPits(pitsRes.data as unknown as PitData[]);
      if (settingsRes.data) {
        const s = Object.fromEntries(settingsRes.data.map((r) => [r.key, r.value]));
        setGlobalPricing({
          base_price: Number(s.base_price) || FALLBACK_GLOBAL.base_price,
          free_miles: Number(s.free_miles) || FALLBACK_GLOBAL.free_miles,
          extra_per_mile: Number(s.price_per_extra_mile) || FALLBACK_GLOBAL.extra_per_mile,
          max_distance: Number(s.max_distance) || FALLBACK_GLOBAL.max_distance,
          saturday_surcharge: Number(s.saturday_surcharge) || FALLBACK_GLOBAL.saturday_surcharge,
        });
      }
    };
    load();
  }, []);

  const handleGetPrice = () => {
    if (!customerCoords || !geocoded) return;
    setCalculating(true);
    const result = findBestPit(pits, customerCoords.lat, customerCoords.lng, globalPricing);
    if (!result || !result.serviceable) {
      setNearestPitInfo(result ? { name: result.pit.name, distance: result.distance, id: result.pit.id } : null);
      setShowOutOfArea(true);
      setCalculatedPrice(null);
    } else {
      setCalculatedPrice(result.price);
    }
    setCalculating(false);
  };

  return (
    <section id="pricing" className="relative py-32 bg-foreground overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--accent)/0.08),transparent_60%)]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">
            SIMPLE PRICING
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-5xl text-background font-display">
            Delivery Area & Pricing
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="font-body text-background/60 mt-3 text-lg max-w-xl mx-auto">
            9 cubic yards per load · Clean, unscreened river sand · Dumped where you need it
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-lg mx-auto bg-background/10 backdrop-blur-md border-2 border-accent/50 rounded-3xl p-8 md:p-10 relative"
        >
          {calculatedPrice !== null ? (
            <>
              <div className="text-center mb-8 mt-2">
                <p className="font-display text-background/70 tracking-widest text-sm mb-1">YOUR PRICE</p>
                <p className="font-display text-7xl md:text-8xl text-accent font-bold">
                  {formatCurrency(calculatedPrice)}
                </p>
                <p className="font-body text-background/50 text-sm mt-1">9 cubic yards of river sand · delivered</p>
              </div>

              <p className="text-center font-body text-background/50 text-sm mb-8">
                Price calculated based on your delivery location.<br />
                Saturday delivery surcharge may apply at checkout.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-4 py-2.5">
                  <Clock className="w-4 h-4 text-accent animate-pulse" />
                  <span className="font-display text-accent text-xs tracking-wider">{label}</span>
                  <span className="font-mono text-accent font-bold text-sm">{timeLeft}</span>
                </div>
                <Button
                  className="w-full h-16 font-display tracking-wider text-lg bg-accent hover:bg-[#C8911A] text-accent-foreground rounded-2xl shadow-lg shadow-accent/20 transition-all duration-200"
                  asChild
                >
                  <a href="/order">ORDER NOW</a>
                </Button>
                <button
                  onClick={() => { setCalculatedPrice(null); setAddress(""); setGeocoded(false); setCustomerCoords(null); }}
                  className="w-full text-center font-body text-background/40 text-sm hover:text-background/60 transition-colors"
                >
                  Check a different address
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8 mt-2">
                <p className="font-display text-3xl md:text-4xl text-background leading-tight">
                  Enter your address to get your exact delivery price
                </p>
                <p className="font-body text-background/50 text-sm mt-3">
                  Price calculated instantly based on your location
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    id="pricing-address-input"
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setGeocoded(false); }}
                    placeholder="Enter your delivery address"
                    className="w-full h-14 px-4 rounded-xl bg-background/15 border border-background/20 text-background placeholder:text-background/30 font-body focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                  />
                  {geocoded && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 text-lg">✓</span>
                  )}
                </div>
                <Button
                  onClick={handleGetPrice}
                  disabled={!geocoded || calculating}
                  className="w-full h-16 font-display tracking-wider text-lg bg-accent hover:bg-[#C8911A] text-accent-foreground rounded-2xl shadow-lg shadow-accent/20 transition-all duration-200 disabled:opacity-50"
                >
                  GET MY PRICE
                </Button>
              </div>
            </>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center text-background/50 text-sm font-body max-w-xl mx-auto"
        >
          ⚠️ All deliveries are curbside only. Due to liability, we cannot deliver inside backyards or enclosed areas.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 flex flex-wrap justify-center gap-8 text-center"
        >
          {[
            { icon: Truck, text: "Mon–Sat delivery" },
            { icon: MapPin, text: "Greater New Orleans" },
            { icon: Package, text: "No hidden fees" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-background/60 font-body">
              <item.icon className="w-5 h-5 text-accent" /> {item.text}
            </div>
          ))}
        </motion.div>
      </div>

      <OutOfAreaModal
        open={showOutOfArea}
        onOpenChange={setShowOutOfArea}
        address={address}
        nearestPit={nearestPitInfo}
      />
    </section>
  );
};

export default Pricing;
