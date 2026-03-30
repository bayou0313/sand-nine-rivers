/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { updateSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Truck, AlertCircle, CheckCircle2, Loader2, ShoppingCart, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import { supabase } from "@/integrations/supabase/client";
import { type PitData, type GlobalPricing, findBestPitDriving, parseGlobalSettings, getEffectivePrice, FALLBACK_GLOBAL_PRICING } from "@/lib/pits";

import { GOOGLE_MAPS_API_KEY, pollForGoogleMaps } from "@/lib/google-maps";

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
  sameDayCutoff?: string | null;
} | null;

interface DeliveryEstimatorProps {
  prefillAddress?: string | null;
  embedded?: boolean;
}

const DeliveryEstimator = ({ prefillAddress, embedded }: DeliveryEstimatorProps) => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult>(null);
  const [error, setError] = useState("");
  const [apiLoaded, setApiLoaded] = useState(false);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);
  const [outOfAreaAddress, setOutOfAreaAddress] = useState("");
  const [outOfAreaDistance, setOutOfAreaDistance] = useState(0);
  const [nearestPitInfo, setNearestPitInfo] = useState<{ id: string; name: string; distance: number } | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL_PRICING);
  const [pits, setPits] = useState<PitData[]>([]);
  const [matchedEffective, setMatchedEffective] = useState<{ free_miles: number; extra_per_mile: number; saturday_surcharge: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, pitsRes] = await Promise.all([
        supabase.from("global_settings").select("key, value"),
        supabase.from("pits").select("id, name, lat, lon, status, base_price, free_miles, price_per_extra_mile, max_distance, operating_days, saturday_surcharge_override, same_day_cutoff").eq("status", "active"),
      ]);
      if (settingsRes.data) setGlobalPricing(parseGlobalSettings(settingsRes.data as any));
      if (pitsRes.data) setPits(pitsRes.data as any);
    };
    fetchData();
  }, []);

  useEffect(() => {
    return pollForGoogleMaps(() => setApiLoaded(true));
  }, []);

  useEffect(() => {
    if (!apiLoaded || !inputRef.current || !window.google?.maps?.places?.PlaceAutocompleteElement) return;
    if (autocompleteRef.current) return;

    const acElement = new (window.google.maps.places as any).PlaceAutocompleteElement({
      types: ["address"],
      componentRestrictions: { country: "us" },
    });
    acElement.style.width = "100%";

    if (inputRef.current.parentNode) {
      inputRef.current.parentNode.insertBefore(acElement, inputRef.current);
      inputRef.current.style.display = "none";
    }

    acElement.addEventListener("gmp-placeselect", async (event: any) => {
      const place = event.place;
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      const lat = place.location?.lat();
      const lng = place.location?.lng();
      const addr = place.formattedAddress;

      if (addr) {
        setAddress(addr);
        updateSession({
          stage: "entered_address",
          delivery_address: addr,
          address_lat: lat,
          address_lng: lng,
        });
        trackEvent("address_entered", { address: addr });
      }
      if (lat != null && lng != null) {
        setCustomerCoords({ lat, lng });
      }
    });

    autocompleteRef.current = acElement;
    return () => { acElement.remove(); autocompleteRef.current = null; };
  }, [apiLoaded]);

  useEffect(() => {
    if (prefillAddress && apiLoaded) {
      setAddress(prefillAddress);
      setTimeout(() => {
        const btn = document.querySelector('[data-estimator-btn]') as HTMLButtonElement;
        btn?.click();
      }, 500);
    }
  }, [prefillAddress, apiLoaded]);

  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 200);
    }
  }, [result]);

  const isSameDayAvailable = (cutoff: string | null | undefined): boolean => {
    if (!cutoff) return false;
    try {
      const now = new Date();
      const [hours, minutes] = cutoff.split(":").map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(hours, minutes, 0, 0);
      const day = now.getDay();
      if (day === 0) return false;
      return now < cutoffDate;
    } catch {
      return false;
    }
  };

  const formatCutoffTime = (cutoff: string | null | undefined): string => {
    if (!cutoff) return "";
    try {
      const [hours, minutes] = cutoff.split(":").map(Number);
      const period = hours >= 12 ? "PM" : "AM";
      const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
    } catch {
      return cutoff;
    }
  };

  const calculateDistance = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    setLoading(true); setError(""); setResult(null); setMatchedEffective(null);

    try {
      let custLat = customerCoords?.lat;
      let custLng = customerCoords?.lng;

      if (custLat == null || custLng == null) {
        if (!GOOGLE_MAPS_API_KEY) {
          setError("Google Maps API key not configured.");
          setLoading(false); return;
        }
        const geocodeResp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`);
        const geocodeData = await geocodeResp.json();
        if (geocodeData.results?.[0]) {
          custLat = geocodeData.results[0].geometry.location.lat;
          custLng = geocodeData.results[0].geometry.location.lng;
        } else {
          setError("Could not locate that address. Please try again.");
          setLoading(false); return;
        }
      }

      if (pits.length === 0) {
        setError("No delivery locations configured. Please call us for pricing.");
        setLoading(false); return;
      }

      const bestResult = await findBestPitDriving(pits, custLat!, custLng!, globalPricing, GOOGLE_MAPS_API_KEY);

      if (!bestResult) {
        setError("No delivery locations available. Please call us.");
        setLoading(false); return;
      }

      if (!bestResult.serviceable) {
        setError("That address is outside our delivery area. Call us for options.");
        setOutOfAreaAddress(address);
        setOutOfAreaDistance(parseFloat(bestResult.distance.toFixed(1)));
        setNearestPitInfo({ id: bestResult.pit.id, name: bestResult.pit.name, distance: bestResult.distance });
        setShowOutOfAreaModal(true);
        trackEvent("out_of_area", {
          nearest_pit: bestResult.pit.name,
          distance_miles: parseFloat(bestResult.distance.toFixed(1)),
        });
        updateSession({
          stage: "got_out_of_area",
          delivery_address: address,
          nearest_pit_name: bestResult.pit.name,
          nearest_pit_id: bestResult.pit.id,
          serviceable: false,
        });
        setLoading(false); return;
      }

      const effective = getEffectivePrice(bestResult.pit, globalPricing);
      setMatchedEffective({
        free_miles: effective.free_miles,
        extra_per_mile: effective.extra_per_mile,
        saturday_surcharge: effective.saturday_surcharge,
      });

      setResult({
        distance: parseFloat(bestResult.distance.toFixed(1)),
        price: bestResult.price,
        address: `${bestResult.distance.toFixed(1)} mi away`,
        sameDayCutoff: (bestResult.pit as any).same_day_cutoff || null,
      });
      trackEvent("price_calculated", {
        price: bestResult.price,
        pit_name: bestResult.pit.name,
        distance_miles: parseFloat(bestResult.distance.toFixed(1)),
        currency: "USD",
      });
      updateSession({
        stage: "got_price",
        calculated_price: bestResult.price,
        nearest_pit_id: bestResult.pit.id,
        nearest_pit_name: bestResult.pit.name,
        serviceable: true,
      });
    } catch {
      setError("Something went wrong. Please try again or call us directly.");
    } finally {
      setLoading(false);
    }
  }, [address, customerCoords, pits, globalPricing]);

  const estimatorContent = (
    <>
      <div id="estimator" className={embedded
        ? "bg-foreground/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl"
        : "bg-card border border-border rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
      }>
        <div className="space-y-4">
          <label htmlFor="delivery-address" className={`font-display text-lg tracking-wider flex items-center gap-2 ${embedded ? "text-primary-foreground" : "text-foreground"}`}>
            <MapPin className="w-5 h-5 text-accent" /> DELIVERY ADDRESS
          </label>
          <p className={`text-sm font-body ${embedded ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
            Get an exact delivery price in seconds — no account needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              ref={inputRef}
              type="text"
              id="delivery-address"
              name="delivery-address"
              autoComplete="street-address"
              placeholder="Enter your delivery address..."
              value={address}
              onChange={(e) => { setAddress(e.target.value); setCustomerCoords(null); }}
              className={`flex-1 h-12 min-h-[44px] text-base rounded-xl ${embedded ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-accent/50" : ""}`}
              maxLength={500}
              onKeyDown={(e) => e.key === "Enter" && calculateDistance()}
            />
            <Button data-estimator-btn onClick={calculateDistance} disabled={loading} className="h-12 min-h-[44px] font-display tracking-wider text-base px-8 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground">
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
            ref={resultRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-6 bg-primary/10 border border-primary/20 rounded-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-display text-xl tracking-wider">DELIVERY AVAILABLE!</span>
            </div>
            <div className={`text-center p-4 rounded-xl ${embedded ? "bg-white/10" : "bg-background"}`}>
              <p className={`font-body text-xs uppercase ${embedded ? "text-primary-foreground/50" : "text-muted-foreground"}`}>Per Load Starting At</p>
              <p className="font-display text-3xl text-accent flex items-center justify-center">
                {formatCurrency(result.price)}
              </p>
            </div>

            {result.sameDayCutoff && isSameDayAvailable(result.sameDayCutoff) && (
              <div className="flex items-center gap-2 justify-center text-green-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-body font-medium">
                  ✓ Same-day delivery available — order by {formatCutoffTime(result.sameDayCutoff)}
                </span>
              </div>
            )}

            <p className={`font-body text-sm text-center ${embedded ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
              9 cubic yards of river sand • {matchedEffective && result.distance > matchedEffective.free_miles
                ? `Includes ${formatCurrency((result.distance - matchedEffective.free_miles) * matchedEffective.extra_per_mile)} extended-area surcharge`
                : "Local delivery included"
              } • Saturday +{formatCurrency(matchedEffective?.saturday_surcharge ?? globalPricing.saturday_surcharge)}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1 h-12 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20" asChild>
                <Link to={`/order?address=${encodeURIComponent(address)}&distance=${result.distance}&price=${result.price}`}><ShoppingCart className="w-5 h-5 mr-2" /> ORDER NOW</Link>
              </Button>
              <Button variant="outline" className={`flex-1 h-12 font-display tracking-wider text-lg rounded-xl ${embedded ? "border-white/20 text-white hover:bg-white/10" : ""}`} asChild>
                <a href="tel:+18554689297">CALL TO ORDER</a>
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <OutOfAreaModal
        open={showOutOfAreaModal}
        onClose={() => setShowOutOfAreaModal(false)}
        address={outOfAreaAddress}
        distanceMiles={outOfAreaDistance}
        nearestPit={nearestPitInfo}
      />
    </>
  );

  if (embedded) {
    return estimatorContent;
  }

  return (
    <section id="estimator" className="py-24 bg-background overflow-x-hidden">
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
          >
            {estimatorContent}
          </motion.div>

          {!result && !error && !loading && (
            <div className="mt-8 text-center">
              <p className="font-display text-xl text-muted-foreground tracking-wider">
                Enter your address to get your exact price
              </p>
              <p className="font-body text-sm text-muted-foreground mt-2">
                9 cubic yards of river sand per load
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DeliveryEstimator;
