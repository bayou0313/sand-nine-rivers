import { useState, useEffect } from "react";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

/**
 * Shared Google Maps loader. Call this in any component that
 * needs Maps/Places. Handles deduplication — the script is only
 * ever injected once regardless of how many components call this hook.
 * Returns { loaded: boolean }.
 */
export function useGoogleMaps(): { loaded: boolean } {
  const [loaded, setLoaded] = useState(
    typeof window !== "undefined" && !!window.google?.maps?.places
  );

  useEffect(() => {
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    // Script already injected by another component — wait for it
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    if (existing) {
      const onLoad = () => setLoaded(true);
      existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }

    // First load — inject the script
    if (!MAPS_KEY) {
      console.error(
        "[useGoogleMaps] VITE_GOOGLE_MAPS_KEY is not set. " +
        "Address autocomplete will not work."
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () =>
      console.error(
        "[useGoogleMaps] Failed to load Google Maps. " +
        "Check VITE_GOOGLE_MAPS_KEY and API restrictions."
      );
    document.head.appendChild(script);
  }, []);

  return { loaded };
}
