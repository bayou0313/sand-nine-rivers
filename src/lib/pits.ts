/**
 * Shared PIT (Point of Interest / Distribution) utilities.
 * Pricing logic, effective pricing, and best-PIT selection.
 *
 * Distance calculations are performed server-side via the
 * `calculate-distances` edge function using GOOGLE_MAPS_SERVER_KEY.
 * No client-side Distance Matrix calls.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PitData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: string;
  base_price: number | null;
  free_miles: number | null;
  price_per_extra_mile: number | null;
  max_distance: number | null;
  operating_days: number[] | null;
  saturday_surcharge_override: number | null;
  same_day_cutoff: string | null;
}

export interface GlobalPricing {
  base_price: number;
  free_miles: number;
  extra_per_mile: number;
  max_distance: number;
  saturday_surcharge: number;
}

export interface EffectivePricing {
  base_price: number;
  free_miles: number;
  extra_per_mile: number;
  max_distance: number;
  saturday_surcharge: number;
}

export interface FindBestPitResult {
  pit: PitData;
  distance: number;
  price: number;
  serviceable: boolean;
}

// Last-resort fallbacks if DB fetch fails entirely
const FALLBACK_BASE_PRICE = 195;
const FALLBACK_FREE_MILES = 15;
const FALLBACK_EXTRA_PER_MILE = 5;
const FALLBACK_MAX_DISTANCE = 30;
const FALLBACK_SATURDAY_SURCHARGE = 35;

export const FALLBACK_GLOBAL_PRICING: GlobalPricing = {
  base_price: FALLBACK_BASE_PRICE,
  free_miles: FALLBACK_FREE_MILES,
  extra_per_mile: FALLBACK_EXTRA_PER_MILE,
  max_distance: FALLBACK_MAX_DISTANCE,
  saturday_surcharge: FALLBACK_SATURDAY_SURCHARGE,
};

/**
 * Parse global_settings rows into a GlobalPricing object.
 */
export function parseGlobalSettings(rows: { key: string; value: string }[]): GlobalPricing {
  const map: Record<string, string> = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    base_price: parseFloat(map.default_base_price) || FALLBACK_BASE_PRICE,
    free_miles: parseFloat(map.default_free_miles) || FALLBACK_FREE_MILES,
    extra_per_mile: parseFloat(map.default_extra_per_mile) || FALLBACK_EXTRA_PER_MILE,
    max_distance: parseFloat(map.default_max_distance) || FALLBACK_MAX_DISTANCE,
    saturday_surcharge: parseFloat(map.saturday_surcharge) || FALLBACK_SATURDAY_SURCHARGE,
  };
}

/**
 * Merge PIT-level overrides with global pricing.
 * NULL PIT fields fall back to global values.
 */
export function getEffectivePrice(pit: PitData, global: GlobalPricing): EffectivePricing {
  return {
    base_price: pit.base_price ?? global.base_price,
    free_miles: pit.free_miles ?? global.free_miles,
    extra_per_mile: pit.price_per_extra_mile ?? global.extra_per_mile,
    max_distance: pit.max_distance ?? global.max_distance,
    saturday_surcharge: pit.saturday_surcharge_override ?? global.saturday_surcharge,
  };
}

/**
 * Calculate the delivery price for a given distance and quantity.
 */
export function calcPitPrice(effective: EffectivePricing, distance: number, qty: number): number {
  const extraMiles = Math.max(0, distance - effective.free_miles);
  const extraCharge = extraMiles * effective.extra_per_mile;
  const rawPrice = effective.base_price + extraCharge;
  const unitPrice = Math.max(effective.base_price, Math.round(rawPrice));
  return unitPrice * qty;
}

/**
 * Calculate final price including Saturday surcharge.
 */
export function calcFinalPrice(effective: EffectivePricing, distance: number, qty: number, isSaturday: boolean): number {
  const base = calcPitPrice(effective, distance, qty);
  const surcharge = isSaturday ? effective.saturday_surcharge : 0;
  return base + surcharge;
}

/**
 * CANONICAL distance function — calls the backend edge function.
 * Single origin → multiple destinations. Returns miles[] (null if no route).
 */
export async function getDrivingDistanceBatch(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  if (destinations.length === 0) return [];

  const { data, error } = await supabase.functions.invoke("calculate-distances", {
    body: {
      mode: "batch",
      origin: { lat: originLat, lng: originLon },
      destinations,
    },
  });

  if (error) {
    console.error("[getDrivingDistanceBatch] Edge function error:", error);
    return new Array(destinations.length).fill(null);
  }

  return data?.distances || new Array(destinations.length).fill(null);
}

/**
 * Find the best PIT for a customer location using server-side driving distance.
 * No browser Google Maps dependency — uses the calculate-distances edge function.
 */
export async function findBestPitDriving(
  pits: PitData[],
  customerLat: number,
  customerLng: number,
  globalPricing: GlobalPricing
): Promise<FindBestPitResult | null> {
  const activePits = pits.filter(p => p.status === "active");
  if (activePits.length === 0) return null;

  const { data, error } = await supabase.functions.invoke("calculate-distances", {
    body: {
      mode: "find_best_pit",
      origins: activePits.map(p => ({ lat: p.lat, lng: p.lon })),
      destination: { lat: customerLat, lng: customerLng },
    },
  });

  if (error) {
    console.error("[findBestPitDriving] Edge function error:", error);
    return null;
  }

  const drivingDistances: (number | null)[] = data?.distances || [];

  const results = activePits
    .map((pit, i) => {
      const distance = drivingDistances[i];
      if (distance === null || distance === undefined) return null;
      const effective = getEffectivePrice(pit, globalPricing);
      const price = calcPitPrice(effective, distance, 1);
      const serviceable = distance <= effective.max_distance;
      return { pit, distance, price, serviceable };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (results.length === 0) return null;

  const serviceable = results.filter(r => r.serviceable);

  if (serviceable.length === 0) {
    results.sort((a, b) => a.distance - b.distance);
    return { ...results[0], serviceable: false };
  }

  serviceable.sort((a, b) =>
    Math.abs(a.distance - b.distance) < 0.5
      ? a.price - b.price
      : a.distance - b.distance
  );
  return { ...serviceable[0], serviceable: true };
}
