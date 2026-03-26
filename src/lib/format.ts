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

// Parish-based Louisiana sales tax rates (state 4.45% + local)
const PARISH_TAX_RATES: Record<string, number> = {
  "orleans": 0.0945,
  "jefferson": 0.0920,
  "st. bernard": 0.0950,
  "st. tammany": 0.0970,
  "plaquemines": 0.0950,
  "st. charles": 0.0920,
  "st. john": 0.0945,
  "lafourche": 0.1045,
  "terrebonne": 0.1020,
  "tangipahoa": 0.0995,
  "washington": 0.0995,
};

// Default to Orleans Parish rate if we can't detect
const DEFAULT_TAX_RATE = 0.0945;

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
    "laplace": "st. john",
    "reserve": "st. john",
  };

  for (const [city, parish] of Object.entries(cityToParish)) {
    if (lower.includes(city)) {
      return { rate: PARISH_TAX_RATES[parish], parish: parish.replace(/\b\w/g, c => c.toUpperCase()) + " Parish" };
    }
  }

  return { rate: DEFAULT_TAX_RATE, parish: "Orleans Parish (default)" };
}
