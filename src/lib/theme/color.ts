export function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || "#000").replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function mixHex(h1: string, h2: string, t: number): string {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  return rgbToHex(a.map((c, i) => c + (b[i] - c) * t));
}

function relLuminance(rgb: number[]): number {
  const c = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(h1: string, h2: string): number {
  const L1 = relLuminance(hexToRgb(h1));
  const L2 = relLuminance(hexToRgb(h2));
  const a = Math.max(L1, L2);
  const b = Math.min(L1, L2);
  return (a + 0.05) / (b + 0.05);
}

/** Whatever accent the user picks should render as-is wherever possible —
 * this only nudges lightness (never saturation, which is what previously
 * turned muted colors vivid) toward the background's opposite pole, and
 * only as far as needed to clear minRatio. A color that's already legible
 * comes back completely unchanged. */
export function accessibleAccent(hex: string, bgHex: string, minRatio = 4.5): string {
  if (contrastRatio(hex, bgHex) >= minRatio) return hex;
  const bgLum = relLuminance(hexToRgb(bgHex));
  const toward = bgLum < 0.5 ? "#ffffff" : "#000000";
  for (let t = 0.05; t <= 1.001; t += 0.05) {
    const mixed = mixHex(hex, toward, t);
    if (contrastRatio(mixed, bgHex) >= minRatio) return mixed;
  }
  return toward;
}

/** The darkest "deeper shade of the same accent" (mixed toward black) that
 * still clears minRatio, backing off from maxT as needed instead of
 * ignoring legibility — darkening on a dark background reduces contrast,
 * so a flat darken amount can go illegible depending on the base color. */
export function deepenAccent(hex: string, bgHex: string, maxT: number, minRatio: number): string {
  for (let t = maxT; t >= 0; t -= 0.02) {
    const mixed = mixHex(hex, "#000000", t);
    if (contrastRatio(mixed, bgHex) >= minRatio) return mixed;
  }
  return hex;
}
