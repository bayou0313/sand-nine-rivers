import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Truck, DollarSign, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ORIGIN = "1215 River Rd, Bridge City, LA 70094";
const BASE_PRICE = 195;
const BASE_MILES = 15;
const MAX_MILES = 25;
const PER_MILE_EXTRA = 3.49;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    if (window.google?.maps?.places) {
      setApiLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setApiLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove since other parts may use it
    };
  }, []);

  // Init autocomplete
  useEffect(() => {
    if (!apiLoaded || !inputRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      types: ["address"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) {
        setAddress(place.formatted_address);
      }
    });
  }, [apiLoaded]);

  const calculateDistance = useCallback(async () => {
    if (!address.trim()) {
      setError("Please enter a delivery address.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    if (!apiLoaded) {
      setError("Google Maps API is not loaded. Please check API key configuration.");
      setLoading(false);
      return;
    }

    try {
      const service = new google.maps.DistanceMatrixService();
      const response = await service.getDistanceMatrix({
        origins: [ORIGIN],
        destinations: [address],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      });

      const element = response.rows[0]?.elements[0];
      if (!element || element.status !== "OK") {
        setError("Could not calculate distance to that address. Please check the address and try again.");
        setLoading(false);
        return;
      }

      const distanceMeters = element.distance.value;
      const distanceMiles = distanceMeters / 1609.34;
      const duration = element.duration.text;

      if (distanceMiles > MAX_MILES) {
        setError(
          `Unfortunately, that address is ${distanceMiles.toFixed(1)} miles away. We currently deliver within ${MAX_MILES} miles of our location. Please call us to discuss options.`
        );
        setLoading(false);
        return;
      }

      let price = BASE_PRICE;
      if (distanceMiles > BASE_MILES) {
        const extraMiles = distanceMiles - BASE_MILES;
        price += extraMiles * PER_MILE_EXTRA;
      }

      setResult({
        distance: parseFloat(distanceMiles.toFixed(1)),
        price: parseFloat(price.toFixed(2)),
        address: element.distance.text + " away",
        duration,
      });
    } catch {
      setError("Something went wrong. Please try again or call us directly.");
    } finally {
      setLoading(false);
    }
  }, [address, apiLoaded]);

  return (
    <section id="estimator" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">INSTANT ESTIMATE</p>
          <h2 className="text-5xl md:text-6xl text-foreground">
            GET YOUR DELIVERY PRICE
          </h2>
          <p className="font-body text-muted-foreground mt-4 max-w-xl mx-auto">
            Enter your delivery address and we'll instantly calculate your price. 9 yards of quality river sand — starting at just $195.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
            <div className="space-y-4">
              <label className="font-display text-lg text-foreground tracking-wider flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                DELIVERY ADDRESS
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter your delivery address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 h-12 text-base"
                  onKeyDown={(e) => e.key === "Enter" && calculateDistance()}
                />
                <Button
                  onClick={calculateDistance}
                  disabled={loading}
                  className="h-12 font-display tracking-wider text-base px-8"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Truck className="w-5 h-5 mr-2" />
                      GET PRICE
                    </>
                  )}
                </Button>
              </div>

              {!GOOGLE_MAPS_API_KEY && (
                <p className="text-sm text-muted-foreground font-body flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  Google Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to enable address autocomplete and distance calculation.
                </p>
              )}
            </div>

            {error && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <p className="font-body text-sm text-destructive">{error}</p>
              </div>
            )}

            {result && (
              <div className="mt-6 p-6 bg-primary/5 border border-primary/20 rounded-lg space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-display text-xl tracking-wider">DELIVERY AVAILABLE!</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-background rounded-md">
                    <p className="font-body text-xs text-muted-foreground uppercase">Distance</p>
                    <p className="font-display text-2xl text-foreground">{result.distance} MI</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-md">
                    <p className="font-body text-xs text-muted-foreground uppercase">Drive Time</p>
                    <p className="font-display text-2xl text-foreground">{result.duration}</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-md">
                    <p className="font-body text-xs text-muted-foreground uppercase">Total Price</p>
                    <p className="font-display text-2xl text-primary flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                      {result.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <p className="font-body text-sm text-muted-foreground text-center">
                  9 cubic yards of river sand • {result.distance <= BASE_MILES ? "Free delivery included" : `Includes $${((result.distance - BASE_MILES) * PER_MILE_EXTRA).toFixed(2)} delivery surcharge`}
                </p>
                <Button className="w-full h-12 font-display tracking-wider text-lg" asChild>
                  <a href="tel:+15551234567">CALL TO ORDER — {result.price.toFixed(2)}</a>
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="font-display text-2xl text-primary">0–15 MI</p>
              <p className="font-body text-sm text-muted-foreground">$195 flat rate</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="font-display text-2xl text-primary">15–25 MI</p>
              <p className="font-body text-sm text-muted-foreground">$195 + $3.49/mile</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <p className="font-display text-2xl text-primary">9 YDS</p>
              <p className="font-body text-sm text-muted-foreground">Per load delivered</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeliveryEstimator;
