/**
 * Shared PIT (Point of Interest / Distribution) utilities.
 * Pricing logic, effective pricing, and best-PIT selection.
 *
 * IMPORTANT: This system does NOT use haversine (straight-line) distances anywhere.
 * All distance calculations use the Google Distance Matrix API with
 * mode=driving and avoid=ferries. Toll roads (I-10 etc.) are used for
 * deliveries, so tolls are NOT avoided. This ensures accurate road-based
 * mileage for pricing. Never add haversine as a fallback or pre-filter.
 *
 * PRICING: All pricing comes from individual PIT records. There are no
 * global pricing defaults — each PIT must have base_price, free_miles,
 * price_per_extra_mile, and max_distance set.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PitData {
  id: string;
  name: string;
  address: string;
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

/** Non-pricing global settings still read from global_settings */
export interface GlobalFees {
  saturday_surcharge: number;
  card_processing_fee_percent: number;
  card_processing_fee_fixed: number;
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
  distance: number;           // actual driving miles (display)
  billedDistance: number;      // billed miles (pricing) — includes phantom miles
  price: number;
  serviceable: boolean;
  isNorthshore: boolean;
}

// Last-resort fallbacks if a pit somehow has null pricing
const FALLBACK_BASE_PRICE = 195;
const FALLBACK_FREE_MILES = 15;
const FALLBACK_EXTRA_PER_MILE = 5;
const FALLBACK_MAX_DISTANCE = 30;
const FALLBACK_SATURDAY_SURCHARGE = 35;

export const FALLBACK_GLOBAL_FEES: GlobalFees = {
  saturday_surcharge: FALLBACK_SATURDAY_SURCHARGE,
  card_processing_fee_percent: 3.5,
  card_processing_fee_fixed: 0.30,
};

/**
 * Parse global_settings rows into GlobalFees (non-pricing settings only).
 */
export function parseGlobalFees(rows: { key: string; value: string }[]): GlobalFees {
  const map: Record<string, string> = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    saturday_surcharge: parseFloat(map.saturday_surcharge) || FALLBACK_SATURDAY_SURCHARGE,
    card_processing_fee_percent: parseFloat(map.card_processing_fee_percent) || 3.5,
    card_processing_fee_fixed: parseFloat(map.card_processing_fee_fixed) || 0.30,
  };
}

// ── Legacy aliases for backward compatibility ──
// Some files may still import these names; they map to the new types.
export type GlobalPricing = GlobalFees & {
  base_price: number;
  free_miles: number;
  extra_per_mile: number;
  max_distance: number;
};

export const FALLBACK_GLOBAL_PRICING: GlobalPricing = {
  ...FALLBACK_GLOBAL_FEES,
  base_price: FALLBACK_BASE_PRICE,
  free_miles: FALLBACK_FREE_MILES,
  extra_per_mile: FALLBACK_EXTRA_PER_MILE,
  max_distance: FALLBACK_MAX_DISTANCE,
};

export function parseGlobalSettings(rows: { key: string; value: string }[]): GlobalPricing {
  const fees = parseGlobalFees(rows);
  return {
    ...fees,
    base_price: FALLBACK_BASE_PRICE,
    free_miles: FALLBACK_FREE_MILES,
    extra_per_mile: FALLBACK_EXTRA_PER_MILE,
    max_distance: FALLBACK_MAX_DISTANCE,
  };
}

/**
 * Get effective pricing from a PIT record.
 * The globalFees parameter is only used for saturday_surcharge fallback.
 */
export function getEffectivePrice(pit: PitData, globalFees: GlobalFees | GlobalPricing): EffectivePricing {
  return {
    base_price: pit.base_price ?? FALLBACK_BASE_PRICE,
    free_miles: pit.free_miles ?? FALLBACK_FREE_MILES,
    extra_per_mile: pit.price_per_extra_mile ?? FALLBACK_EXTRA_PER_MILE,
    max_distance: pit.max_distance ?? FALLBACK_MAX_DISTANCE,
    saturday_surcharge: pit.saturday_surcharge_override ?? globalFees.saturday_surcharge,
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
 * Reverse the baked 3.5% fee to get COD price.
 * Used when pricing_mode is "baked" and customer selects PAY AT DELIVERY.
 */
export function getCODPrice(bakedPrice: number, discountPercent = 3.5): number {
  return Math.round(bakedPrice / (1 + discountPercent / 100));
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
 * All pricing comes from individual PIT records.
 */
export async function findBestPitDriving(
  pits: PitData[],
  customerAddress: string,
  globalFees: GlobalFees | GlobalPricing,
  supabaseClient?: any,
  deliveryDayOfWeek?: number, // 0=Sun..6=Sat — filter pits by operating_days
  zipCode?: string,
): Promise<FindBestPitResult | null> {
  let activePits = pits.filter(p => p.status === "active" && !p.is_pickup_only);

  // Filter by operating days if a specific delivery day is requested
  if (deliveryDayOfWeek !== undefined) {
    const pitsOpenOnDay = activePits.filter(p =>
      !p.operating_days || p.operating_days.length === 0 || p.operating_days.includes(deliveryDayOfWeek)
    );
    if (pitsOpenOnDay.length === 0) return null;
    activePits = pitsOpenOnDay;
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
        origins: activePits.map(p => p.address),
        destination: customerAddress,
        zip_code: zipCode || '',
      },
    });

    if (error) throw error;

    const drivingDistances: (number | null)[] = data.distances || [];
    const billedDistancesArr: (number | null)[] = data.billed_distances || data.distances || [];
    const northshore: boolean = data.is_northshore || false;
    console.log("[findBestPitDriving] driving distances:", drivingDistances, "billed:", billedDistancesArr, "northshore:", northshore);

    const results = activePits
      .map((pit, i) => {
        const distance = drivingDistances[i];
        if (distance === null || distance === undefined) return null;
        const billedDistance = billedDistancesArr[i] ?? distance;
        const effective = getEffectivePrice(pit, globalFees);
        const price = calcPitPrice(effective, billedDistance, 1); // price on BILLED distance
        const serviceable = distance <= effective.max_distance;
        return { pit, distance, billedDistance, price, serviceable, isNorthshore: northshore };
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

/**
 * Get driving distances for ALL active (non-pickup) pits to a customer address.
 * Returns the full ranked array sorted by distance ascending.
 * Used by the per-date pit assignment calendar.
 */
export async function findAllPitDistances(
  pits: PitData[],
  customerAddress: string,
  globalFees: GlobalFees | GlobalPricing,
  supabaseClient?: any,
  zipCode?: string,
): Promise<FindBestPitResult[]> {
  const activePits = pits.filter(p => p.status === "active" && !p.is_pickup_only);
  if (activePits.length === 0 || !supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient.functions.invoke("leads-auth", {
      body: {
        action: "calculate_distances",
        origins: activePits.map(p => p.address),
        destination: customerAddress,
        zip_code: zipCode || '',
      },
    });
    if (error) throw error;

    const drivingDistances: (number | null)[] = data.distances || [];
    const billedDistancesArr: (number | null)[] = data.billed_distances || data.distances || [];
    const northshore: boolean = data.is_northshore || false;

    const results = activePits
      .map((pit, i) => {
        const distance = drivingDistances[i];
        if (distance === null || distance === undefined) return null;
        const billedDistance = billedDistancesArr[i] ?? distance;
        const effective = getEffectivePrice(pit, globalFees);
        const price = calcPitPrice(effective, billedDistance, 1);
        const serviceable = distance <= effective.max_distance;
        return { pit, distance, billedDistance, price, serviceable, isNorthshore: northshore };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    results.sort((a, b) => a.distance - b.distance);
    console.log("[findAllPitDistances] results:", results.map(r => `${r.pit.name}: ${r.distance.toFixed(1)}mi`));
    return results;
  } catch (err: any) {
    console.error("[findAllPitDistances] failed:", err.message);
    return [];
  }
}
