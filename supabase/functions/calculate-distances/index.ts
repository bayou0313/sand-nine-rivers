import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Public edge function for driving-distance calculations.
 * Uses the server-side GOOGLE_MAPS_SERVER_KEY so the browser key
 * doesn't need Distance Matrix API authorization.
 *
 * Accepts two modes:
 *
 * 1. "find_best_pit" — single customer → multiple PIT origins
 *    Body: { mode: "find_best_pit", origins: [{lat,lng},...], destination: {lat,lng} }
 *    Returns: { distances: (number|null)[] }   (miles per origin)
 *
 * 2. "batch" — single origin → multiple destinations
 *    Body: { mode: "batch", origin: {lat,lng}, destinations: [{lat,lng},...] }
 *    Returns: { distances: (number|null)[] }   (miles per destination)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { mode } = body;

    if (mode === "find_best_pit") {
      // origins = PIT locations, destination = customer
      const { origins, destination } = body;
      if (!Array.isArray(origins) || !destination?.lat || !destination?.lng) {
        return new Response(
          JSON.stringify({ error: "Invalid params for find_best_pit" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const distances = await getDistances(
        origins.map((o: any) => `${o.lat},${o.lng}`).join("|"),
        `${destination.lat},${destination.lng}`,
        apiKey
      );
      return new Response(
        JSON.stringify({ distances }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "batch") {
      // single origin → multiple destinations
      const { origin, destinations } = body;
      if (!origin?.lat || !origin?.lng || !Array.isArray(destinations)) {
        return new Response(
          JSON.stringify({ error: "Invalid params for batch" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const BATCH = 25;
      const results: (number | null)[] = new Array(destinations.length).fill(null);
      for (let i = 0; i < destinations.length; i += BATCH) {
        const batch = destinations.slice(i, i + BATCH);
        const destsStr = batch.map((d: any) => `${d.lat},${d.lng}`).join("|");
        const batchResults = await getDistancesSingleOrigin(
          `${origin.lat},${origin.lng}`,
          destsStr,
          apiKey
        );
        for (let j = 0; j < batchResults.length; j++) {
          results[i + j] = batchResults[j];
        }
      }
      return new Response(
        JSON.stringify({ distances: results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown mode. Use 'find_best_pit' or 'batch'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[calculate-distances] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Multiple origins → single destination (for find_best_pit).
 * Returns miles[] matching each origin.
 */
async function getDistances(
  originsStr: string,
  destinationStr: string,
  apiKey: string
): Promise<(number | null)[]> {
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(originsStr)}` +
    `&destinations=${encodeURIComponent(destinationStr)}` +
    `&units=imperial&mode=driving&avoid=ferries` +
    `&key=${apiKey}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status !== "OK") {
    console.error("[getDistances] API error:", data.status, data.error_message);
    return [];
  }
  return (data.rows || []).map((row: any) => {
    const el = row.elements?.[0];
    if (el?.status === "OK" && el.distance?.value) {
      return el.distance.value / 1609.344;
    }
    return null;
  });
}

/**
 * Single origin → multiple destinations (for batch mode).
 */
async function getDistancesSingleOrigin(
  originStr: string,
  destsStr: string,
  apiKey: string
): Promise<(number | null)[]> {
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(originStr)}` +
    `&destinations=${encodeURIComponent(destsStr)}` +
    `&units=imperial&mode=driving&avoid=ferries` +
    `&key=${apiKey}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status !== "OK") {
    console.error("[getDistancesSingleOrigin] API error:", data.status, data.error_message);
    return [];
  }
  const elements = data.rows?.[0]?.elements || [];
  return elements.map((el: any) => {
    if (el?.status === "OK" && el.distance?.value) {
      return el.distance.value / 1609.344;
    }
    return null;
  });
}
