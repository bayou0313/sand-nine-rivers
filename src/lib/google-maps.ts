/**
 * Shared Google Maps loader — ensures the script is injected exactly once.
 */
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI";

export { GOOGLE_MAPS_API_KEY };

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (window.google?.maps?.places) { resolve(); return; }
      existing.addEventListener("load", () => resolve());
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) { resolve(); return; }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * React hook helper: poll until Google Maps is ready.
 * Use in useEffect: returns cleanup function.
 */
export function pollForGoogleMaps(onReady: () => void): () => void {
  if (window.google?.maps?.places) {
    onReady();
    return () => {};
  }

  // Kick off loading if not started
  loadGoogleMaps();

  const interval = setInterval(() => {
    if (window.google?.maps?.places) {
      onReady();
      clearInterval(interval);
    }
  }, 100);

  return () => clearInterval(interval);
}
