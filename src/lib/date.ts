/** Notes store dates as plain ISO ("YYYY-MM-DD") — the format a native
 * <input type="date"> value always uses regardless of locale. Everywhere
 * the app displays that as text, format it dd/mm/yy instead of leaking the
 * raw ISO string. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y.slice(2)}`;
}
