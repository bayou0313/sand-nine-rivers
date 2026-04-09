// Force redeploy: 2026-03-31
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { updateSession } from "@/lib/session";
import { trackEvent } from "@/lib/analytics";
import { MapPin, Truck, AlertCircle, Loader2, ShoppingCart, Clock, Minus, Plus, HardHat } from "lucide-react";
import { formatCurrency, getTaxRateFromAddress, formatPhone, stripPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OutOfAreaModal from "@/components/OutOfAreaModal";
import { supabase } from "@/integrations/supabase/client";
import { type PitData, type GlobalPricing, findBestPitDriving, parseGlobalSettings, getEffectivePrice, FALLBACK_GLOBAL_PRICING } from "@/lib/pits";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import PlaceAutocompleteInput, { getPlaceInputValue, type PlaceSelectResult } from "@/components/PlaceAutocompleteInput";

type EstimateResult = {
  distance: number;
  price: number;
  address: string;
  sameDayCutoff?: string | null;
} | null;

interface DeliveryEstimatorProps {
  prefillAddress?: string | null; // kept for Index.tsx return-visitor flow
  embedded?: boolean;
}

const DeliveryEstimator = ({ prefillAddress, embedded }: DeliveryEstimatorProps) => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult>(null);
  const [error, setError] = useState("");
  const { loaded: apiLoaded } = useGoogleMaps();
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);
  const [outOfAreaAddress, setOutOfAreaAddress] = useState("");
  const [outOfAreaDistance, setOutOfAreaDistance] = useState(0);
  const [nearestPitInfo, setNearestPitInfo] = useState<{ id: string; name: string; distance: number } | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [globalPricing, setGlobalPricing] = useState<GlobalPricing>(FALLBACK_GLOBAL_PRICING);
  const [pits, setPits] = useState<PitData[]>([]);
  const [matchedEffective, setMatchedEffective] = useState<{ free_miles: number; extra_per_mile: number; saturday_surcharge: number } | null>(null);
  const [matchedPit, setMatchedPit] = useState<PitData | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [volumeName, setVolumeName] = useState("");
  const [volumePhone, setVolumePhone] = useState("");
  const [volumeEmail, setVolumeEmail] = useState("");
  const [volumeSubmitting, setVolumeSubmitting] = useState(false);
  const [volumeSuccess, setVolumeSuccess] = useState(false);
  const [volumeError, setVolumeError] = useState("");

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
    if (prefillAddress && apiLoaded) {
      setAddress(prefillAddress);
      // Auto-calculate will trigger via customerCoords useEffect
      // if the prefill comes with geocoded coords; otherwise user picks from dropdown
    }
  }, [prefillAddress, apiLoaded]);

  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 200);
    }
  }, [result]);

  // Save session state on page exit (captures exit intent)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (address) {
        updateSession({
          stage: result ? "got_price" : "entered_address",
          delivery_address: address,
          calculated_price: result?.price || null,
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [address, result]);

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

  const handlePlaceSelect = useCallback((result: PlaceSelectResult) => {
    setAddress(result.formattedAddress);
    setCustomerCoords({ lat: result.lat, lng: result.lng });
    updateSession({
      stage: "entered_address",
      delivery_address: result.formattedAddress,
      address_lat: result.lat,
      address_lng: result.lng,
    });
    trackEvent("address_entered", { address: result.formattedAddress });
  }, []);

  // Auto-calculate price when coordinates are set (address selected from dropdown)
  useEffect(() => {
    if (customerCoords) {
      calculateDistance();
    }
  }, [customerCoords]);

  const calculateDistance = useCallback(async () => {
    console.log("[calculateDistance] starting, address:", address);
    console.log("[calculateDistance] customerCoords:", customerCoords);
    // Read address from the autocomplete input if state is empty
    const currentAddress = address.trim() || getPlaceInputValue(containerRef.current);
    if (!currentAddress) { setError("Please enter a delivery address."); return; }
    setLoading(true); setError(""); setResult(null); setMatchedEffective(null);

    try {
      let custLat = customerCoords?.lat;
      let custLng = customerCoords?.lng;

      if (custLat == null || custLng == null) {
        console.log("[calculateDistance] no coords, trying geocoder");
        if (!window.google?.maps?.Geocoder) {
          console.log("[calculateDistance] geocoder not available");
          setError("Maps not loaded yet. Please wait a moment and try again.");
          setLoading(false); return;
        }
        const geocoder = new window.google.maps.Geocoder();
        console.log("[calculateDistance] geocoder created, calling geocode for:", currentAddress);
        let geocodeResult: any;
        try {
          geocodeResult = await geocoder.geocode({ address: currentAddress });
        } catch (geocodeErr: any) {
          console.error("[calculateDistance] geocoder.geocode threw:", geocodeErr?.message || geocodeErr);
          setError("Could not locate that address. Please try again.");
          setLoading(false); return;
        }
        console.log("[calculateDistance] geocode result:", geocodeResult);
        if (geocodeResult.results?.[0]?.geometry?.location) {
          custLat = geocodeResult.results[0].geometry.location.lat();
          custLng = geocodeResult.results[0].geometry.location.lng();
          console.log("[calculateDistance] geocoded coords:", custLat, custLng);
        } else {
          console.log("[calculateDistance] geocode failed, no results");
          setError("Could not locate that address. Please try again.");
          setLoading(false); return;
        }
      }

      console.log("[calculateDistance] coords:", custLat, custLng);

      if (pits.length === 0) {
        setError("No delivery locations configured. Please call us for pricing.");
        setLoading(false); return;
      }

      if (Math.abs(custLat! - 30) > 15 || Math.abs(custLng! - (-90)) > 15) {
        setError("Address not found in our service area. Please enter a Louisiana address.");
        setLoading(false); return;
      }

      // Distances are real driving miles from Google Distance Matrix API — NOT haversine.
      console.log("[calculateDistance] calling findBestPitDriving, pits:", pits.length);
      const bestResult = await findBestPitDriving(pits, custLat!, custLng!, globalPricing, supabase);
      console.log("[calculateDistance] bestResult:", bestResult);

      if (!bestResult) {
        setError("No delivery locations available. Please call us.");
        setLoading(false); return;
      }

      if (!bestResult.serviceable) {
        setError("That address is outside our delivery area. Call us for options.");
        setOutOfAreaAddress(currentAddress);
        setOutOfAreaDistance(parseFloat(bestResult.distance.toFixed(1)));
        setNearestPitInfo({ id: bestResult.pit.id, name: bestResult.pit.name, distance: bestResult.distance });
        setShowOutOfAreaModal(true);
        trackEvent("out_of_area", {
          nearest_pit: bestResult.pit.name,
          distance_miles: parseFloat(bestResult.distance.toFixed(1)),
        });
        updateSession({
          stage: "got_out_of_area",
          delivery_address: currentAddress,
          nearest_pit_name: bestResult.pit.name,
          nearest_pit_id: bestResult.pit.id,
          serviceable: false,
        });
        setLoading(false); return;
      }

      const effective = getEffectivePrice(bestResult.pit, globalPricing);
      setMatchedPit(bestResult.pit);
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
        delivery_address: currentAddress,
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
      <div id={embedded ? undefined : "estimator"} ref={containerRef} className={embedded
        ? "bg-foreground/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl scroll-mt-24"
        : "bg-card border border-border rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
      }>
        <div className="space-y-4">
          <label htmlFor="delivery-address" className={`font-display tracking-wider flex items-center gap-2 ${embedded ? "text-primary-foreground" : "text-foreground"} text-2xl py-[5px]`}>
            <MapPin className="w-5 h-5 text-accent" /> DELIVERY ADDRESS
          </label>
          <p className={`font-body ${embedded ? "text-primary-foreground/60" : "text-muted-foreground"} py-[4px] text-base`}>
            Get an exact delivery price in seconds — no account needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {apiLoaded ? (
              <PlaceAutocompleteInput
                onPlaceSelect={handlePlaceSelect}
                onInputChange={(val) => { setAddress(val); setCustomerCoords(null); }}
                onEnterKey={calculateDistance}
                placeholder="Enter your delivery address for an instant price"
                initialValue={prefillAddress || ""}
                id="delivery-address"
                containerClassName={`flex-1 ${embedded ? "place-autocomplete-embedded" : ""}`}
              />
            ) : (
              <div className="flex-1 h-12 rounded-xl border border-input bg-background animate-pulse" />
            )}
            {loading && (
              <div className="flex items-center justify-center h-12 min-h-[44px] px-8">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <span className="ml-2 font-display tracking-wider text-sm text-muted-foreground">Calculating...</span>
              </div>
            )}
          </div>

          {/* Change Address — right-aligned, only when result is showing */}
          {result && (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAddress("");
                  setCustomerCoords(null);
                  setError("");
                  setMatchedPit(null);
                  setMatchedEffective(null);
                  setQuantity(1);
                  setTimeout(() => {
                    const input = containerRef.current?.querySelector<HTMLInputElement>("input");
                    if (input) { input.value = ""; input.focus(); }
                  }, 50);
                }}
                className="text-sm text-accent underline underline-offset-2 hover:text-accent/80 font-body cursor-pointer transition-colors"
              >
                Change Address
              </button>
            </div>
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
            className="mt-6 space-y-5"
          >
            {/* Price per load */}
            <div className="text-center">
              <p className={`font-body text-xs uppercase tracking-wider ${embedded ? "text-primary-foreground/50" : "text-muted-foreground"}`}>Per Load Starting At</p>
              <p className="font-display text-4xl text-accent mt-1">
                {formatCurrency(result.price)}
              </p>
            </div>

            {/* Quantity selector — no background card */}
            <div className="flex items-center justify-center gap-4">
              <span className={`font-body text-sm ${embedded ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Number of Loads</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-30 hover:bg-accent/90 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className={`font-display text-xl w-8 text-center ${embedded ? "text-primary-foreground" : "text-foreground"}`}>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  disabled={quantity >= 10}
                  className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-30 hover:bg-accent/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Price breakdown */}
            {quantity >= 2 ? (() => {
              const subtotal = result.price * quantity;
              const taxInfo = getTaxRateFromAddress(address);
              const taxAmount = subtotal * taxInfo.rate;
              const processingFee = subtotal * 0.035;
              const total = subtotal + taxAmount + processingFee;
              const muted = embedded ? "text-primary-foreground/50" : "text-muted-foreground";
              const text = embedded ? "text-primary-foreground" : "text-foreground";
              return (
                <div className="space-y-2 font-body text-sm">
                  <div className="flex justify-between">
                    <span className={muted}>Subtotal <span className="ml-2">{quantity} × {formatCurrency(result.price)}</span></span>
                    <span className="text-accent">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={muted}>Sales Tax <span className="ml-1 text-xs">({(taxInfo.rate * 100).toFixed(2)}%)</span></span>
                    <span className="text-accent">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={muted}>Processing Fee <span className="ml-1 text-xs">(3.5% card · included if paying cash)</span></span>
                    <span className="text-accent">{formatCurrency(processingFee)}</span>
                  </div>
                  <div className={`border-t ${embedded ? "border-white/20" : "border-border"} pt-2 flex justify-between`}>
                    <span className={`font-display tracking-wider ${text}`}>Total Estimated</span>
                    <span className={`font-display text-lg font-bold ${text}`}>{formatCurrency(total)}</span>
                  </div>
                </div>
              );
            })() : (
              <p className={`font-body text-sm text-center ${embedded ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                1 load × {formatCurrency(result.price)} = <span className="font-display text-lg text-accent font-bold">{formatCurrency(result.price)}</span>
              </p>
            )}

            {result.sameDayCutoff && isSameDayAvailable(result.sameDayCutoff) && (
              <div className="flex items-center gap-2 justify-center text-green-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-body font-medium">
                  ✓ Same-day delivery available — order by {formatCutoffTime(result.sameDayCutoff)}
                </span>
              </div>
            )}

            {/* Disclaimer */}
            <p className={`font-body text-sm text-center ${embedded ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
              9 cubic yards of river sand • {matchedEffective && result.distance > matchedEffective.free_miles
                ? `Includes ${formatCurrency((result.distance - matchedEffective.free_miles) * matchedEffective.extra_per_mile)} extended-area surcharge`
                : "Local delivery included"
              } • Saturday +{formatCurrency(matchedEffective?.saturday_surcharge ?? globalPricing.saturday_surcharge)}
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1 h-12 font-display tracking-wider text-lg bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20" asChild>
                <Link to={`/order?address=${encodeURIComponent(address)}&distance=${result.distance}&price=${result.price}&quantity=${quantity}&pit_id=${matchedPit?.id || ""}&pit_name=${encodeURIComponent(matchedPit?.name || "")}${matchedPit?.operating_days ? `&operating_days=${matchedPit.operating_days.join(",")}` : ""}${matchedPit?.saturday_surcharge_override != null ? `&sat_surcharge=${matchedPit.saturday_surcharge_override}` : ""}${matchedPit?.same_day_cutoff ? `&same_day_cutoff=${encodeURIComponent(matchedPit.same_day_cutoff)}` : ""}`} onClick={() => updateSession({ stage: "clicked_order_now", calculated_price: result!.price * quantity, delivery_address: address })}><ShoppingCart className="w-5 h-5 mr-2" /> ORDER NOW{quantity > 1 ? ` (${quantity} LOADS)` : ""}</Link>
              </Button>
              <Button variant="outline" className={`flex-1 h-12 font-display tracking-wider text-lg rounded-xl ${embedded ? "border-2 border-white text-white bg-white/10 hover:bg-white/20" : "border-2 border-accent text-accent bg-transparent hover:bg-accent/10"}`} asChild>
                <a href="tel:+18554689297">CALL TO ORDER</a>
              </Button>
            </div>

            {/* Volume quote form at quantity = 10 */}
            {quantity >= 10 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-4"
              >
                <div className={`border-t ${embedded ? "border-white/10" : "border-border"} pt-6`}>
                  <div className="flex items-center gap-2 mb-2">
                    <HardHat className="w-5 h-5 text-accent" />
                    <span className={`font-display text-lg tracking-wider ${embedded ? "text-primary-foreground" : "text-foreground"}`}>Large Order? Get a Special Rate.</span>
                  </div>
                  <p className={`font-body text-sm mb-4 ${embedded ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    Orders of 10+ loads qualify for volume pricing. Leave your info and we'll call you back with a custom quote.
                  </p>

                  {volumeSuccess ? (
                    <p className="font-body text-sm text-green-400 text-center py-4">✅ We'll call you within 1 business hour.</p>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const phone = stripPhone(volumePhone);
                        if (!volumeName.trim() || phone.length < 10) return;
                        setVolumeSubmitting(true);
                        setVolumeError("");
                        try {
                          const { error: insertErr } = await supabase.from("delivery_leads").insert({
                            customer_name: volumeName.trim(),
                            customer_phone: phone,
                            customer_email: volumeEmail.trim() || null,
                            address: address,
                            calculated_price: result!.price * 10,
                            notes: "10+ loads volume inquiry",
                            stage: "new",
                          });
                          if (insertErr) throw insertErr;
                          setVolumeSuccess(true);
                          trackEvent("volume_quote_requested", { loads: 10, price: result!.price * 10 });
                        } catch {
                          setVolumeError("Something went wrong. Please call 1-855-GOT-WAYS");
                        } finally {
                          setVolumeSubmitting(false);
                        }
                      }}
                      className="space-y-3"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Name"
                        value={volumeName}
                        onChange={(e) => setVolumeName(e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/20 bg-white/5 px-4 font-body text-primary-foreground placeholder:text-primary-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <input
                        type="tel"
                        required
                        placeholder="Phone"
                        value={volumePhone}
                        onChange={(e) => setVolumePhone(formatPhone(e.target.value))}
                        className="w-full h-12 rounded-xl border border-white/20 bg-white/5 px-4 font-body text-primary-foreground placeholder:text-primary-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <input
                        type="email"
                        placeholder="Email (optional)"
                        value={volumeEmail}
                        onChange={(e) => setVolumeEmail(e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/20 bg-white/5 px-4 font-body text-primary-foreground placeholder:text-primary-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      {volumeError && <p className="font-body text-sm text-destructive">{volumeError}</p>}
                      <Button
                        type="submit"
                        disabled={volumeSubmitting}
                        className="w-full h-12 font-display tracking-wider text-base bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl"
                      >
                        {volumeSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "REQUEST VOLUME QUOTE"}
                      </Button>
                    </form>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      <OutOfAreaModal
        open={showOutOfAreaModal}
        onClose={() => setShowOutOfAreaModal(false)}
        address={outOfAreaAddress}
        distanceMiles={outOfAreaDistance}
        nearestPit={nearestPitInfo}
        calculatedPrice={result?.price ?? null}
      />
    </>
  );

  if (embedded) {
    return estimatorContent;
  }

  return (
    <section id="estimator" className="py-24 bg-background overflow-x-hidden scroll-mt-24">
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
