/**
 * Shared Google Maps API key export.
 * Script loading is handled exclusively by src/hooks/useGoogleMaps.ts.
 */
const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_KEY ||
  "AIzaSyALI_GnekVryYGyUeXV8BvaGV74MIvk3SI";

export { GOOGLE_MAPS_API_KEY };
