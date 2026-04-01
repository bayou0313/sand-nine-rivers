// Updated 2026-03-31 to force fresh frontend build
import { useState, useEffect } from "react";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || "";

const SCRIPT_ID = "google-maps-script";

export function useGoogleMaps(): { loaded: boolean } {
  const [loaded, setLoaded] = useState(
    typeof window !== "undefined" && 
    !!window.google?.maps?.places
  );

  useEffect(() => {
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {
      const onLoad = () => setLoaded(true);
      existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&language=en`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error(
      "[useGoogleMaps] Failed to load Google Maps."
    );
    document.head.appendChild(script);

    return () => {};
  }, []);

  return { loaded };
}
