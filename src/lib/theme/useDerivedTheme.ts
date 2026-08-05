import { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { THEME_BG } from "./tokens";
import { accessibleAccent, hexToRgb, mixHex } from "./color";
import type { ThemeName } from "@/types/vault";

export interface DerivedColors {
  theme: ThemeName;
  accent: string;
  accentText: string;
  accentFadedRgba: string;
  accentSelRgba: string;
  isDark: boolean;
}

export function useDerivedTheme(): DerivedColors {
  const theme = useVaultStore((s) => s.themeOverride) || "Light Warm";
  const accent = useVaultStore((s) => s.accentOverride) || "#b0623b";

  return useMemo(() => {
    const isDark = theme.indexOf("Dark") === 0;
    const bg = THEME_BG[theme] || "#faf5ea";
    // Links/tags should read as the color the user actually picked, not a
    // saturation-boosted reinterpretation of it — only nudge lightness, and
    // only as far as needed to clear a normal-text contrast floor.
    const accentText = accessibleAccent(accent, bg, 4.5);
    // "Missing page" links read as a de-emphasized version of the *same*
    // accent — mixed toward the background so it's genuinely darker on dark
    // themes and lighter on light themes (i.e. faded, not a different hue),
    // with a low contrast floor so it never drops below legible.
    const accentFadedRgba = accessibleAccent(mixHex(accent, bg, 0.45), bg, 2.8);
    const rgb = hexToRgb(accent);
    const accentSelRgba = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`;
    return { theme, accent, accentText, accentFadedRgba, accentSelRgba, isDark };
  }, [theme, accent]);
}
