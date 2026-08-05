/** Windows-authored files (and some paste sources) use CRLF line endings.
 * The live editor's per-line regexes anchor on end-of-string (`(.*)$`),
 * and `.` never matches `\r`, so a trailing `\r` silently fails every
 * "is this line a bullet/heading/quote/etc." match — the line falls
 * through to plain-paragraph rendering with no visible error. Reading
 * mode's simpler prefix-only regexes don't hit this, which is why the
 * same note could look right in one mode and wrong in the other.
 * Normalize once, at the point content enters the app. */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
