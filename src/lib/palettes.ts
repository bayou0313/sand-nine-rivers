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
  { id: "original_navy",    name: "Original Navy",    vibe: "Current brand",    primary: "#0D2137", accent: "#C07A00", background: "#F2EDE4" },
  { id: "charcoal_ember",   name: "Charcoal Ember",   vibe: "Warm industrial",  primary: "#2D2D2D", accent: "#D4763A", background: "#F5F2EE" },
  { id: "forest_gold",      name: "Forest Gold",      vibe: "Earthy natural",   primary: "#1B4332", accent: "#D4A017", background: "#F4F1EC" },
  { id: "slate_copper",     name: "Slate Copper",     vibe: "Modern refined",   primary: "#334155", accent: "#B87333", background: "#F8F6F3" },
  { id: "espresso_sand",    name: "Espresso Sand",    vibe: "Warm premium",     primary: "#3E2723", accent: "#C9A84C", background: "#FAF7F2" },
  { id: "storm_steel",      name: "Storm Steel",      vibe: "Cool minimal",     primary: "#1E293B", accent: "#64748B", background: "#F1F5F9" },
  { id: "oxblood_clay",     name: "Oxblood Clay",     vibe: "Bold heritage",    primary: "#6B1D1D", accent: "#C07A00", background: "#FBF7F2" },
  { id: "midnight_sage",    name: "Midnight Sage",    vibe: "Calm natural",     primary: "#1A1A2E", accent: "#7C9A6E", background: "#F5F5F0" },
  { id: "granite_amber",    name: "Granite Amber",    vibe: "Neutral bold",     primary: "#4A4A4A", accent: "#E5A100", background: "#FAFAF8" },
  { id: "dusk_terracotta",  name: "Dusk Terracotta",  vibe: "Desert warmth",    primary: "#2C1810", accent: "#C45B28", background: "#F9F5F0" },
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
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}
