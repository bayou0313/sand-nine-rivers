import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared Google Maps loader for UI features (autocomplete, geocoding).
 * Distance calculations are handled server-side — no Distance Matrix needed here.
 * Fetches the API key at runtime from the backend.
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

    // Fetch the key from the backend and inject the script
    async function loadMaps() {
      // First try the build-time env var
      let key = import.meta.env.VITE_GOOGLE_MAPS_KEY || "AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI";

      // If not available at build time, fetch from backend
      if (!key) {
        try {
          const { data, error } = await supabase.functions.invoke("get-maps-key");
          if (error) throw error;
          key = data?.key || "";
        } catch (e) {
          console.error("[useGoogleMaps] Failed to fetch Maps API key:", e);
          return;
        }
      }

      if (!key) {
        console.error(
          "[useGoogleMaps] Google Maps API key is not configured. " +
          "Address autocomplete will not work."
        );
        return;
      }

      const script = document.createElement("script");
      script.src =
        `https://maps.googleapis.com/maps/api/js` +
        `?key=${key}&libraries=places&loading=async&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => setLoaded(true);
      script.onerror = () =>
        console.error(
          "[useGoogleMaps] Failed to load Google Maps. " +
          "Check API key and restrictions."
        );
      document.head.appendChild(script);
    }

    loadMaps();
  }, []);

  return { loaded };
}
