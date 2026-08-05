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
