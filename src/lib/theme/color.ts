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

function rgbToHsl(rgb: number[]): [number, number, number] {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

export function saturateHex(hex: string, addPct: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const ns = Math.max(0, Math.min(100, s + addPct));
  return rgbToHex(hslToRgb(h, ns, l));
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
