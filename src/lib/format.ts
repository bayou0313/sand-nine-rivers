// Phone mask: (xxx) xxx-xxxx
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Strip phone mask back to digits for storage
export function stripPhone(value: string): string {
  return value.replace(/\D/g, "");
}

// Currency: $1,234.56
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Louisiana state tax rate
export const LA_STATE_TAX_RATE = 0.05;

// Parish-based Louisiana sales tax rates (state + local combined)
const PARISH_TAX_RATES: Record<string, number> = {
  "jefferson": 0.0975,
  "orleans": 0.1000,
  "st. bernard": 0.1000,
  "st. charles": 0.1055,
  "st. tammany": 0.0925,
  "plaquemines": 0.0975,
  "st. john the baptist": 0.1025,
  "st. james": 0.0850,
  "lafourche": 0.0970,
  "tangipahoa": 0.0945,
};

// Default rate when parish can't be detected
const DEFAULT_TAX_RATE = 0.0975;

export function getTaxRateFromAddress(address: string): { rate: number; parish: string } {
  const lower = address.toLowerCase();

  // Try to match parish names from the address
  // Check longer names first to avoid partial matches
  const orderedParishes = Object.keys(PARISH_TAX_RATES).sort((a, b) => b.length - a.length);

  for (const parish of orderedParishes) {
    if (lower.includes(parish)) {
      return { rate: PARISH_TAX_RATES[parish], parish: parish.replace(/\b\w/g, c => c.toUpperCase()) + " Parish" };
    }
  }

  // City-to-parish mapping for common NOLA area cities
  const cityToParish: Record<string, string> = {
    "new orleans": "orleans",
    "metairie": "jefferson",
    "kenner": "jefferson",
    "gretna": "jefferson",
    "harvey": "jefferson",
    "marrero": "jefferson",
    "westwego": "jefferson",
    "terrytown": "jefferson",
    "bridge city": "jefferson",
    "avondale": "jefferson",
    "chalmette": "st. bernard",
    "arabi": "st. bernard",
    "meraux": "st. bernard",
    "slidell": "st. tammany",
    "mandeville": "st. tammany",
    "covington": "st. tammany",
    "madisonville": "st. tammany",
    "abita springs": "st. tammany",
    "belle chasse": "plaquemines",
    "luling": "st. charles",
    "destrehan": "st. charles",
    "laplace": "st. john the baptist",
    "reserve": "st. john the baptist",
    "new orleans east": "orleans",
    "algiers": "orleans",
    "gentilly": "orleans",
    "lakeview": "orleans",
    "mid-city": "orleans",
    "uptown": "orleans",
    "bywater": "orleans",
    "treme": "orleans",
  };

  for (const [city, parish] of Object.entries(cityToParish)) {
    if (lower.includes(city)) {
      return { rate: PARISH_TAX_RATES[parish], parish: parish.replace(/\b\w/g, c => c.toUpperCase()) + " Parish" };
    }
  }

  return { rate: DEFAULT_TAX_RATE, parish: "Unknown Parish (default)" };
}

// Extract parish from Google Maps place result address_components
export function getParishFromPlaceResult(
  addressComponents: Array<{ long_name: string; short_name: string; types: string[] }>
): string | null {
  const county = addressComponents.find(c => c.types.includes("administrative_area_level_2"));
  if (!county) return null;
  return county.long_name;
}

// Look up tax rate by parish name (from Google Maps structured data)
export function getTaxRateByParish(parishName: string): { rate: number; parish: string } {
  const normalized = parishName.toLowerCase().replace(/ parish$/i, "").trim();
  const key = Object.keys(PARISH_TAX_RATES).find(k => k === normalized);
  if (key !== undefined) {
    return { rate: PARISH_TAX_RATES[key], parish: key.replace(/\b\w/g, c => c.toUpperCase()) + " Parish" };
  }
  return { rate: DEFAULT_TAX_RATE, parish: normalized.replace(/\b\w/g, c => c.toUpperCase()) + " Parish (default rate)" };
}

// ─── Delivery window formatting ──────────────────────────────────────────────

import type { PitDeliveryHours } from "@/lib/pits";

export const DELIVERY_HOURS_FALLBACK = "Contact us for hours";

/**
 * Format a 24h "HH:MM" string into a 12h display, e.g. "07:00" → "7:00 AM".
 * Returns null on invalid input.
 */
function format12h(hhmm: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = min.toString().padStart(2, "0");
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Format the delivery window for a given day-of-week from a PIT's delivery_hours jsonb.
 * - dayOfWeek: 0=Sun..6=Sat (use selectedDeliveryDate.date.getDay()).
 * - Returns "7:00 AM – 5:00 PM" if hours are configured for that day.
 * - Returns DELIVERY_HOURS_FALLBACK if hours are null, missing, or malformed.
 */
export function formatDeliveryWindow(
  hours: PitDeliveryHours | null | undefined,
  dayOfWeek: number,
): string {
  if (!hours || typeof hours !== "object") return DELIVERY_HOURS_FALLBACK;
  const entry = hours[String(dayOfWeek)];
  if (!entry || !entry.open || !entry.close) return DELIVERY_HOURS_FALLBACK;
  const open = format12h(entry.open);
  const close = format12h(entry.close);
  if (!open || !close) return DELIVERY_HOURS_FALLBACK;
  return `${open} – ${close}`;
}

