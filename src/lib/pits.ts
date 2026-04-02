/**
 * Shared PIT (Point of Interest / Distribution) utilities.
 * Pricing logic, effective pricing, and best-PIT selection.
 *
 * IMPORTANT: This system does NOT use haversine (straight-line) distances anywhere.
 * All distance calculations use the Google Distance Matrix API with
 * mode=driving and avoid=ferries. Toll roads (I-10 etc.) are used for
 * deliveries, so tolls are NOT avoided. This ensures accurate road-based
 * mileage for pricing. Never add haversine as a fallback or pre-filter.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  sunday_surcharge: number | null;
  is_pickup_only?: boolean;
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
 * Find the best PIT for a customer location using driving distance.
 * Calls the leads-auth edge function which proxies the Google Distance Matrix API.
 */
export async function findBestPitDriving(
  pits: PitData[],
  customerLat: number,
  customerLng: number,
  globalPricing: GlobalPricing,
  supabaseClient?: any,
  deliveryDayOfWeek?: number // 0=Sun..6=Sat — filter pits by operating_days
): Promise<FindBestPitResult | null> {
  let activePits = pits.filter(p => p.status === "active" && !p.is_pickup_only);

  // Filter by operating days if a specific delivery day is requested
  if (deliveryDayOfWeek !== undefined) {
    const pitsOpenOnDay = activePits.filter(p =>
      !p.operating_days || p.operating_days.length === 0 || p.operating_days.includes(deliveryDayOfWeek)
    );
    if (pitsOpenOnDay.length > 0) activePits = pitsOpenOnDay;
  }

  if (activePits.length === 0) return null;

  if (!supabaseClient) {
    console.error("[findBestPitDriving] No supabase client provided");
    return null;
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke("leads-auth", {
      body: {
        action: "calculate_distances",
        origins: activePits.map(p => ({ lat: p.lat, lng: p.lon })),
        destination: { lat: customerLat, lng: customerLng },
      },
    });

    if (error) throw error;

    const drivingDistances: (number | null)[] = data.distances || [];
    console.log("[findBestPitDriving] driving distances:", drivingDistances);

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

    console.log("[findBestPitDriving] results:", results);

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
  } catch (err: any) {
    console.error("[findBestPitDriving] failed:", err.message);
    return null;
  }
}
