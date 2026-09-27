export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escAttr(s: string): string {
  return esc(s).replace(/"/g, "&quot;");
}

/** Reverses esc(). The inline renderers escape the whole line before their
 * regex passes run, so a captured [[Title]] arrives as "A &amp; B" — it has
 * to be decoded before it's used as a lookup key or re-escaped into an
 * attribute, or a title containing &, < or > never matches its note. */
export function unesc(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
