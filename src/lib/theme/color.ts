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

export function mixHex(h1: string, h2: string, t: number): string {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  return rgbToHex(a.map((c, i) => c + (b[i] - c) * t));
}

export function accessibleAccent(
  hex: string,
  bgHex: string,
  minRatio = 7,
): string {
  if (contrastRatio(hex, bgHex) >= minRatio) return hex;
  const bgLum = relLuminance(hexToRgb(bgHex));
  const toward = bgLum < 0.5 ? [255, 255, 255] : [0, 0, 0];
  const base = hexToRgb(hex);
  for (let t = 0.05; t <= 1.001; t += 0.05) {
    const mixed = base.map((c, i) => c + (toward[i] - c) * t);
    const mhex = rgbToHex(mixed);
    if (contrastRatio(mhex, bgHex) >= minRatio) return mhex;
  }
  return rgbToHex(toward);
}

export function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
