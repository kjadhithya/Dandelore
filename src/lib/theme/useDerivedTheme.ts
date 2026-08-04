import { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { THEME_BG } from "./tokens";
import { accessibleAccent, hexToRgb, saturateHex } from "./color";
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
    const baseForText = saturateHex(accent, isDark ? 22 : 14);
    const accentText = accessibleAccent(baseForText, THEME_BG[theme] || "#faf5ea", isDark ? 7 : 4.8);
    // "Missing page" links need to read as visually secondary to real links,
    // but alpha-blending (the old approach) let contrast fall well below
    // readable thresholds on some themes. Hold it to its own, lower contrast
    // floor instead — still clearly fainter than a real link, never illegible.
    const accentFadedRgba = accessibleAccent(baseForText, THEME_BG[theme] || "#faf5ea", isDark ? 4.0 : 3.2);
    const rgb = hexToRgb(accent);
    const accentSelRgba = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`;
    return { theme, accent, accentText, accentFadedRgba, accentSelRgba, isDark };
  }, [theme, accent]);
}
