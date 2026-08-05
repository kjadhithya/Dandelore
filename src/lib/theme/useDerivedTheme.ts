import { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { mixHex, hexToRgb } from "./color";
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
    // Links/tags use the exact same color as buttons — the accent the user
    // picked, unmodified — rather than a derived/adjusted variant of it.
    const accentText = accent;
    // Faded ("missing page") links are a slightly deeper shade of that same
    // color, not a different hue and not washed out toward the background.
    const accentFadedRgba = mixHex(accent, "#000000", 0.22);
    const rgb = hexToRgb(accent);
    const accentSelRgba = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`;
    return { theme, accent, accentText, accentFadedRgba, accentSelRgba, isDark };
  }, [theme, accent]);
}
