/**
 * Shared PIT (Point of Interest / Distribution) utilities.
 * Haversine distance, effective pricing, price calculation, and best-PIT selection.
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
 * Haversine distance in miles between two lat/lon points.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
 * Find the best PIT for a customer location (straight-line pre-filter).
 * Returns nearest serviceable PIT (tie-break on price).
 * If none serviceable, returns nearest with serviceable=false for lead capture.
 */
export function findBestPit(
  pits: PitData[],
  customerLat: number,
  customerLng: number,
  globalPricing: GlobalPricing
): FindBestPitResult | null {
  const activePits = pits.filter(p => p.status === "active");
  if (activePits.length === 0) return null;

  const results = activePits.map(pit => {
    const distance = haversineDistance(
      Number(pit.lat), Number(pit.lon),
      customerLat, customerLng
    );
    const effective = getEffectivePrice(pit, globalPricing);
    const price = calcPitPrice(effective, distance, 1);
    const serviceable = distance <= effective.max_distance;
    return { pit, distance, price, serviceable };
  });

  // Only serviceable PITs
  const serviceable = results.filter(r => r.serviceable);

  if (serviceable.length === 0) {
    // Return nearest PIT even if out of range (for lead capture)
    results.sort((a, b) => a.distance - b.distance);
    return { ...results[0], serviceable: false };
  }

  // Primary: shortest distance. Tie-breaker: lowest price
  serviceable.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) < 0.1) {
      return a.price - b.price;
    }
    return a.distance - b.distance;
  });

  return { ...serviceable[0], serviceable: true };
}

/**
 * Find the best PIT using actual driving distance via Google Distance Matrix API.
 * 1) Pre-filters with Haversine to top 5 closest PITs (saves API calls)
 * 2) Calls Distance Matrix for driving distance
 * 3) Returns best result based on real road miles
 */
export async function findBestPitDriving(
  pits: PitData[],
  customerLat: number,
  customerLng: number,
  globalPricing: GlobalPricing,
  googleMapsApiKey: string
): Promise<FindBestPitResult | null> {
  const activePits = pits.filter(p => p.status === "active");
  if (activePits.length === 0) return null;

  // Step 1: Pre-filter with Haversine — keep top 5 closest
  const preFiltered = activePits
    .map(pit => ({
      pit,
      straightLine: haversineDistance(Number(pit.lat), Number(pit.lon), customerLat, customerLng),
    }))
    .sort((a, b) => a.straightLine - b.straightLine)
    .slice(0, 5);

  // Step 2: Call Google Distance Matrix for driving distances
  const origins = preFiltered.map(p => `${p.pit.lat},${p.pit.lon}`).join("|");
  const destination = `${customerLat},${customerLng}`;

  let drivingDistances: (number | null)[];
  try {
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destination)}&units=imperial&mode=driving&avoid=ferries&key=${googleMapsApiKey}`
    );
    const data = await resp.json();

    drivingDistances = (data.rows || []).map((row: any) => {
      const el = row.elements?.[0];
      if (el?.status === "OK" && el.distance?.value) {
        // Convert meters to miles
        return el.distance.value / 1609.344;
      }
      return null;
    });
  } catch {
    // If Distance Matrix fails, fall back to Haversine
    console.warn("Distance Matrix API failed, falling back to straight-line distance");
    return findBestPit(pits, customerLat, customerLng, globalPricing);
  }

  // Step 3: Build results with driving distances (fall back to straight-line if API missed one)
  const results = preFiltered.map((item, i) => {
    const distance = drivingDistances[i] ?? item.straightLine;
    const effective = getEffectivePrice(item.pit, globalPricing);
    const price = calcPitPrice(effective, distance, 1);
    const serviceable = distance <= effective.max_distance;
    return { pit: item.pit, distance, price, serviceable };
  });

  const serviceable = results.filter(r => r.serviceable);

  if (serviceable.length === 0) {
    results.sort((a, b) => a.distance - b.distance);
    return { ...results[0], serviceable: false };
  }

  serviceable.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) < 0.5) {
      return a.price - b.price;
    }
    return a.distance - b.distance;
  });

  return { ...serviceable[0], serviceable: true };
}
