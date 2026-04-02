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
export const LA_STATE_TAX_RATE = 0.0445;

// Parish-based Louisiana sales tax rates (state + local combined)
const PARISH_TAX_RATES: Record<string, number> = {
  "jefferson": 0.0975,
  "orleans": 0.1000,
  "st. bernard": 0.1000,
  "st. charles": 0.1000,
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
  return county.long_name.replace(/ Parish$/i, "").toLowerCase();
}

// Look up tax rate by parish name (from Google Maps structured data)
export function getTaxRateByParish(parishName: string): { rate: number; parish: string } {
  const key = parishName.toLowerCase();
  if (PARISH_TAX_RATES[key] !== undefined) {
    return { rate: PARISH_TAX_RATES[key], parish: key.replace(/\b\w/g, c => c.toUpperCase()) + " Parish" };
  }
  return { rate: DEFAULT_TAX_RATE, parish: key.replace(/\b\w/g, c => c.toUpperCase()) + " Parish (default rate)" };
}
