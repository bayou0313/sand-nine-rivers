/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Truck, AlertCircle, CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OutOfAreaModal from "@/components/OutOfAreaModal";

declare global {
  interface Window {
    google: any;
  }
}

const ORIGIN = "1215 River Rd, Bridge City, LA 70094";
const BASE_PRICE = 195;
const BASE_MILES = 15;
const MAX_MILES = 30;
const PER_MILE_EXTRA = 3.49;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBDjm1VJ85yJ7KX-cSRX3RCXVir4DOyQ-I";

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
  duration: string;
} | null;

const DeliveryEstimator = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult>(null);
  const [error, setError] = useState("");
  const [apiLoaded, setApiLoaded] = useState(false);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);
  const [outOfAreaAddress, setOutOfAreaAddress] = useState("");
  const [outOfAreaDistance, setOutOfAreaDistance] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    if (window.google?.maps?.places) { setApiLoaded(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setApiLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!apiLoaded || !inputRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      types: ["address"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) setAddress(place.formatted_address);
    });
  }, [apiLoaded]);

  const calculateDistance = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    setLoading(true); setError(""); setResult(null);

    if (!apiLoaded) {
      setError("Google Maps API is not loaded.");
      setLoading(false); return;
    }

    try {
      const service = new window.google.maps.DistanceMatrixService();
      const response = await service.getDistanceMatrix({
        origins: [ORIGIN],
        destinations: [address],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      });

      const element = response.rows[0]?.elements[0];
      if (!element || element.status !== "OK") {
        setError("Could not calculate distance. Please check the address.");
        setLoading(false); return;
      }

      const distanceMiles = element.distance.value / 1609.34;
      if (distanceMiles > MAX_MILES) {
        setError("That address is outside our delivery area. Call us for options.");
        setOutOfAreaAddress(address);
        setOutOfAreaDistance(parseFloat(distanceMiles.toFixed(1)));
        setShowOutOfAreaModal(true);
        setLoading(false); return;
      }

      let price = BASE_PRICE;
      if (distanceMiles > BASE_MILES) price += (distanceMiles - BASE_MILES) * PER_MILE_EXTRA;

      setResult({
        distance: parseFloat(distanceMiles.toFixed(1)),
        price: parseFloat(price.toFixed(2)),
        address: element.distance.text + " away",
        duration: element.duration.text,
      });
    } catch {
      setError("Something went wrong. Please try again or call us directly.");
    } finally {
      setLoading(false);
    }
  }, [address, apiLoaded]);

  return (
    <section id="estimator" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-accent font-display text-lg tracking-widest mb-3">INSTANT ESTIMATE</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl text-foreground">Delivery Area & Pricing</motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="font-body text-muted-foreground mt-6 max-w-xl mx-auto text-lg">
            Enter your delivery address and we'll instantly calculate your price.
          </motion.p>
        </div>

        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="space-y-4">
              <label className="font-display text-lg text-foreground tracking-wider flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> DELIVERY ADDRESS
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter your delivery address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 h-12 text-base rounded-xl"
                  maxLength={500}
                  onKeyDown={(e) => e.key === "Enter" && calculateDistance()}
                />
                <Button onClick={calculateDistance} disabled={loading} className="h-12 font-display tracking-wider text-base px-8 rounded-xl">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" /> GET PRICE</>}
                </Button>
              </div>

              {!GOOGLE_MAPS_API_KEY && (
                <p className="text-sm text-muted-foreground font-body flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  Google Maps API key not configured.
                </p>
              )}
            </div>

            {error && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <p className="font-body text-sm text-destructive">{error}</p>
              </div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-6 bg-primary/5 border border-primary/20 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-display text-xl tracking-wider">DELIVERY AVAILABLE!</span>
                </div>
                <div className="text-center p-4 bg-background rounded-xl">
                  <p className="font-body text-xs text-muted-foreground uppercase">Per Load Starting At</p>
                  <p className="font-display text-3xl text-primary flex items-center justify-center">
                    {formatCurrency(result.price)}
                  </p>
                </div>
                <p className="font-body text-sm text-muted-foreground text-center">
                  9 cubic yards of river sand • {result.distance <= BASE_MILES ? "Local delivery included" : `Includes ${formatCurrency((result.distance - BASE_MILES) * PER_MILE_EXTRA)} extended-area surcharge`} • Saturday +$35
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1 h-12 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20" asChild>
                    <Link to={`/order?address=${encodeURIComponent(address)}&distance=${result.distance}&price=${result.price}&duration=${encodeURIComponent(result.duration)}`}><ShoppingCart className="w-5 h-5 mr-2" /> ORDER ONLINE</Link>
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 font-display tracking-wider text-lg rounded-xl" asChild>
                    <a href="tel:+18554689297">CALL TO ORDER</a>
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { label: "LOCAL AREA", sub: "Starting at $195 per load" },
              { label: "EXTENDED AREA", sub: "Additional surcharge applies" },
              { label: "9 YDS", sub: "Per load delivered" },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-card border border-border rounded-2xl hover:border-primary/30 transition-colors">
                <p className="font-display text-2xl text-primary">{item.label}</p>
                <p className="font-body text-sm text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeliveryEstimator;
