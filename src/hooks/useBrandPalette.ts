import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaletteById, deriveCssVars, hexToHsl } from "@/lib/palettes";

/**
 * Fetches brand palette settings from global_settings and applies CSS custom properties.
 * Call once in top-level page components (Index, Order, CityPage).
 */
export function useBrandPalette() {
  useEffect(() => {
    const apply = async () => {
      try {
        const { data } = await supabase
          .from("global_settings")
          .select("key, value")
          .in("key", ["brand_palette", "brand_primary", "brand_accent", "brand_background"]);

        if (!data || data.length === 0) return; // keep CSS defaults

        const settings: Record<string, string> = {};
        data.forEach((r: any) => { settings[r.key] = r.value; });

        // Start from the palette preset
        const palette = getPaletteById(settings.brand_palette || "original_navy");

        // Allow per-field overrides from manual hex inputs
        const resolved = {
          ...palette,
          primary: settings.brand_primary || palette.primary,
          accent: settings.brand_accent || palette.accent,
          background: settings.brand_background || palette.background,
        };

        const vars = deriveCssVars(resolved);
        const root = document.documentElement;
        Object.entries(vars).forEach(([prop, val]) => {
          root.style.setProperty(prop, val);
        });
      } catch {
        // silently fall back to CSS defaults
      }
    };
    apply();
  }, []);
}
