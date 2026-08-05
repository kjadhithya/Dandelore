import { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { THEME_BG } from "./tokens";
import { accessibleAccent, bestTextOn, deepenAccent, hexToRgb } from "./color";
import type { ThemeName } from "@/types/vault";

export interface DerivedColors {
  theme: ThemeName;
  accent: string;
  accentText: string;
  accentFadedRgba: string;
  accentSelRgba: string;
  accentButtonText: string;
  isDark: boolean;
}

export function useDerivedTheme(): DerivedColors {
  const theme = useVaultStore((s) => s.themeOverride) || "Light Warm";
  const accent = useVaultStore((s) => s.accentOverride) || "#b0623b";

  return useMemo(() => {
    const isDark = theme.indexOf("Dark") === 0;
    const bg = THEME_BG[theme] || "#faf7f2";
    // Links/tags use the accent the user picked — same as buttons — as long
    // as it's actually legible against the background; only nudged (never
    // saturated, which is what previously turned muted colors vivid) as far
    // as needed to clear a normal-text contrast floor.
    const accentText = accessibleAccent(accent, bg, 4.5);
    // Faded ("missing page") links are a deeper shade of that same color —
    // darkening reduces contrast on a dark background, so this backs off
    // from the requested depth as needed rather than risking illegible text.
    const accentFadedRgba = deepenAccent(accent, bg, 0.22, 2.6);
    const rgb = hexToRgb(accent);
    const accentSelRgba = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`;
    // Text drawn ON TOP of a solid accent button — the accent itself can be
    // anything from a pale pastel to near-black, so a fixed white doesn't
    // always have enough contrast; pick whichever of black/white reads best.
    const accentButtonText = bestTextOn(accent);
    return { theme, accent, accentText, accentFadedRgba, accentSelRgba, accentButtonText, isDark };
  }, [theme, accent]);
}
