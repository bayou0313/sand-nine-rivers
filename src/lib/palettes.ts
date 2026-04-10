// 10 brand color palettes — stored as hex, converted to HSL for CSS vars

export interface Palette {
  id: string;
  name: string;
  vibe: string;
  primary: string;   // hex
  accent: string;     // hex
  background: string; // hex
}

export const PALETTES: Palette[] = [
  { id: "ways-core",          name: "WAYS Core",           vibe: "Authority — Navy + Gold",        primary: "#0D2137", accent: "#C07A00", background: "#F5F2EA" },
  { id: "mississippi-mud",    name: "Mississippi Mud",      vibe: "Earthy — Brown + Orange",        primary: "#3D2B1F", accent: "#D4822A", background: "#FBF6EF" },
  { id: "gulf-green",         name: "Gulf Green",           vibe: "Natural — Forest + Gold",        primary: "#1B4332", accent: "#D4A017", background: "#F0F7F4" },
  { id: "bayou-night",        name: "Bayou Night",          vibe: "Bold — Deep Navy + Orange",      primary: "#1A0A2E", accent: "#FF6B2B", background: "#FFFFFF" },
  { id: "river-sand-natural", name: "River Sand Natural",   vibe: "Premium — Slate + Sand Yellow",  primary: "#2C3E50", accent: "#E8C547", background: "#FAFAF8" },
];

/** Convert hex (#RRGGBB) to HSL "h s% l%" string */
export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Derive a lighter version for card/muted backgrounds */
function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Given a palette, return all CSS variable overrides as HSL strings */
export function deriveCssVars(palette: Palette): Record<string, string> {
  const primary = hexToHsl(palette.primary);
  const accent = hexToHsl(palette.accent);
  const bg = hexToHsl(palette.background);
  const card = hexToHsl(darken(palette.background, 5));
  const secondary = hexToHsl(darken(palette.background, 15));
  const muted = hexToHsl(darken(palette.background, 10));
  const border = hexToHsl(darken(palette.background, 25));
  const sandLight = hexToHsl(darken(palette.background, 12));

  return {
    "--primary": primary,
    "--primary-foreground": "0 0% 100%",
    "--background": bg,
    "--foreground": primary,
    "--card": card,
    "--card-foreground": primary,
    "--popover": bg,
    "--popover-foreground": primary,
    "--secondary": secondary,
    "--secondary-foreground": primary,
    "--muted": muted,
    "--muted-foreground": hexToHsl(lighten(palette.primary, 60)),
    "--accent": accent,
    "--accent-foreground": primary,
    "--border": border,
    "--input": border,
    "--ring": primary,
    "--sand-light": sandLight,
    "--sand-dark": primary,
    "--hero-overlay": hexToHsl(darken(palette.primary, 10)),
  };
}

export function getPaletteById(id: string): Palette {
  return PALETTES.find(p => p.id === id) || PALETTES[0];
}

/** Deterministically pick a palette based on a string slug */
export function getPaletteForSlug(slug: string): Palette {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) & 0xffffffff;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}
