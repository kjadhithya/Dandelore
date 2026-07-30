import { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { THEME_BG } from "./tokens";
import { accessibleAccent, hexToRgb, rgba, saturateHex } from "./color";
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
    const accentFadedRgba = rgba(accentText, 0.55);
    const rgb = hexToRgb(accent);
    const accentSelRgba = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`;
    return { theme, accent, accentText, accentFadedRgba, accentSelRgba, isDark };
  }, [theme, accent]);
}
