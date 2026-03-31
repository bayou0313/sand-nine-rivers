import { useState, useEffect } from "react";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || 
  "AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI";

const SCRIPT_ID = "google-maps-script";

export function useGoogleMaps(): { loaded: boolean } {

  const [loaded, setLoaded] = useState(

    typeof window !== "undefined" && 

    !!window.google?.maps?.places

  );

  useEffect(() => {

    // Already loaded

    if (window.google?.maps?.places) {

      setLoaded(true);

      return;

    }

    // Script already in DOM — wait for it

    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {

      const onLoad = () => setLoaded(true);

      existing.addEventListener("load", onLoad);

      return () => existing.removeEventListener("load", onLoad);

    }

    // First load — inject once

    const script = document.createElement("script");

    script.id = SCRIPT_ID;

    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;

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
