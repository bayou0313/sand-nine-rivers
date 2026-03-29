/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { updateSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Truck, AlertCircle, CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import { supabase } from "@/integrations/supabase/client";
import { type PitData, type GlobalPricing, findBestPit, parseGlobalSettings, getEffectivePrice, FALLBACK_GLOBAL_PRICING } from "@/lib/pits";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBDjm1VJ85yJ7KX-cSRX3RCXVir4DOyQ-I";

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
} | null;

const DeliveryEstimator = (props: { prefillAddress?: string | null }) => {
  const { prefillAddress } = props;
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

  // Dynamic data from DB
  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL_PRICING);
  const [pits, setPits] = useState<PitData[]>([]);
  const [matchedEffective, setMatchedEffective] = useState<{ free_miles: number; extra_per_mile: number; saturday_surcharge: number } | null>(null);

  // Fetch PITs + global settings on mount
  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, pitsRes] = await Promise.all([
        supabase.from("global_settings").select("key, value"),
        supabase.from("pits").select("id, name, lat, lon, status, base_price, free_miles, price_per_extra_mile, max_distance, operating_days, saturday_surcharge_override, same_day_cutoff").eq("status", "active"),
      ]);
      if (settingsRes.data) {
        setGlobalPricing(parseGlobalSettings(settingsRes.data as any));
      }
      if (pitsRes.data) {
        setPits(pitsRes.data as any);
      }
    };
    fetchData();
  }, []);

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
      if (place?.formatted_address) {
        setAddress(place.formatted_address);
        updateSession({
          stage: "entered_address",
          delivery_address: place.formatted_address,
          address_lat: place.geometry?.location?.lat(),
          address_lng: place.geometry?.location?.lng(),
        });
        trackEvent("address_entered", { address: place.formatted_address });
      }
      if (place?.geometry?.location) {
        setCustomerCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });
  }, [apiLoaded]);
  // Prefill address from return visitor banner
  useEffect(() => {
    if (prefillAddress && apiLoaded) {
      setAddress(prefillAddress);
      // Trigger geocode + price calculation after setting address
      setTimeout(() => {
        const btn = document.querySelector('[data-estimator-btn]') as HTMLButtonElement;
        btn?.click();
      }, 500);
    }
  }, [prefillAddress, apiLoaded]);


  const calculateDistance = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    setLoading(true); setError(""); setResult(null); setMatchedEffective(null);

    try {
      let custLat = customerCoords?.lat;
      let custLng = customerCoords?.lng;

      // Fallback geocode if coords not captured from Places
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

      const bestResult = findBestPit(pits, custLat!, custLng!, globalPricing);

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
                  onChange={(e) => { setAddress(e.target.value); setCustomerCoords(null); }}
                  className="flex-1 h-12 text-base rounded-xl"
                  maxLength={500}
                  onKeyDown={(e) => e.key === "Enter" && calculateDistance()}
                />
                <Button data-estimator-btn onClick={calculateDistance} disabled={loading} className="h-12 font-display tracking-wider text-base px-8 rounded-xl">
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
                  9 cubic yards of river sand • {matchedEffective && result.distance > matchedEffective.free_miles
                    ? `Includes ${formatCurrency((result.distance - matchedEffective.free_miles) * matchedEffective.extra_per_mile)} extended-area surcharge`
                    : "Local delivery included"
                  } • Saturday +{formatCurrency(matchedEffective?.saturday_surcharge ?? globalPricing.saturday_surcharge)}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1 h-12 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20" asChild>
                    <Link to={`/order?address=${encodeURIComponent(address)}&distance=${result.distance}&price=${result.price}`}><ShoppingCart className="w-5 h-5 mr-2" /> ORDER ONLINE</Link>
                  </Button>
                  <Button variant="outline" className="flex-1 h-12 font-display tracking-wider text-lg rounded-xl" asChild>
                    <a href="tel:+18554689297">CALL TO ORDER</a>
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Show prompt to enter address when no result yet */}
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

      <OutOfAreaModal
        open={showOutOfAreaModal}
        onClose={() => setShowOutOfAreaModal(false)}
        address={outOfAreaAddress}
        distanceMiles={outOfAreaDistance}
        nearestPit={nearestPitInfo}
      />
    </section>
  );
};

export default DeliveryEstimator;
