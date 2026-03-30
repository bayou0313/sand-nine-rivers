/**
 * Shared PIT (Point of Interest / Distribution) utilities.
 * Driving distance via Google Maps Distance Matrix, effective pricing, price calculation, and best-PIT selection.
 *
 * IMPORTANT: haversine / straight-line distance has been removed from this codebase.
 * All distance calculations use the Google Maps Distance Matrix API (mode=driving, avoid=ferries).
 * If a driving distance cannot be obtained, the result is null and the caller must skip it.
 */

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
 * CANONICAL distance function for the entire codebase.
 * Uses Google Maps Distance Matrix JS SDK — roads only, no ferries.
 * Requires window.google.maps to be loaded before calling.
 * If a specific route returns no result → returns null for that index.
 *   Callers must skip/exclude nulls. Never substitute haversine.
 * Batches in groups of 25 (Distance Matrix API limit per call).
 *
 * Server-side mirror: getDrivingDistances() in leads_index.ts — must stay in sync.
 */
export async function getDrivingDistanceBatch(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  if (!window.google?.maps) {
    throw new Error(
      "getDrivingDistanceBatch: Google Maps JS SDK is not loaded. " +
      "Ensure the script is loaded before calling distance functions."
    );
  }
  if (destinations.length === 0) return [];

  const results: (number | null)[] = new Array(destinations.length).fill(null);
  const BATCH = 25;
  const service = new window.google.maps.DistanceMatrixService();

  for (let i = 0; i < destinations.length; i += BATCH) {
    const batch = destinations.slice(i, i + BATCH);
    try {
      const response = await service.getDistanceMatrix({
        origins: [{ lat: originLat, lng: originLon }],
        destinations: batch.map(d => ({ lat: d.lat, lng: d.lng })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        avoidFerries: true,
      });
      const elements = response.rows?.[0]?.elements || [];
      for (let j = 0; j < elements.length; j++) {
        if (elements[j]?.status === "OK" && elements[j].distance?.value) {
          results[i + j] = elements[j].distance.value / 1609.344;
        }
        // If status is not OK → result stays null → caller skips this destination
      }
    } catch (e) {
      console.error("[getDrivingDistanceBatch] Batch request failed:", e);
      // Results for this batch stay null — caller skips them
    }
  }
  return results;
}

/**
 * Find the best PIT for a customer location using driving distance.
 * Uses Google Maps Distance Matrix JS SDK — no haversine fallback.
 * Requires window.google.maps to be loaded before calling.
 * If the API fails or returns no results, returns null.
 */
export async function findBestPitDriving(
  pits: PitData[],
  customerLat: number,
  customerLng: number,
  globalPricing: GlobalPricing
): Promise<FindBestPitResult | null> {
  if (!window.google?.maps) {
    throw new Error("findBestPitDriving: Google Maps JS SDK is not loaded.");
  }
  const activePits = pits.filter(p => p.status === "active");
  if (activePits.length === 0) return null;

  const service = new window.google.maps.DistanceMatrixService();

  let drivingDistances: (number | null)[];
  try {
    const response = await service.getDistanceMatrix({
      origins: activePits.map(p => ({ lat: p.lat, lng: p.lon })),
      destinations: [{ lat: customerLat, lng: customerLng }],
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      avoidFerries: true,
    });
    drivingDistances = (response.rows || []).map((row: any) => {
      const el = row.elements?.[0];
      if (el?.status === "OK" && el.distance?.value) {
        return el.distance.value / 1609.344;
      }
      return null;
    });
  } catch (e) {
    console.error("[findBestPitDriving] Distance Matrix request failed:", e);
    return null;
  }

  const results = activePits
    .map((pit, i) => {
      const distance = drivingDistances[i];
      if (distance === null) return null; // No road route — exclude this PIT
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
