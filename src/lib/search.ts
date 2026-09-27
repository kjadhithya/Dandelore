import type { Note } from "@/types/vault";

/** Word-based, typo-tolerant search shared by the sidebar search and the
 * quick switcher. The old search was one plain substring check, so the
 * query had to appear in the note verbatim — "product books" never found
 * "Product Design Books". Here the query is split into words and each word
 * is matched on its own, anywhere in the note, as a whole word, a word
 * prefix, a substring, or (for longer words) a near-miss spelling. */

export interface SearchHit {
  note: Note;
  score: number;
  /** How many of the query's words were found — below the total means this
   * is a "closest match" rather than a full one. */
  matched: number;
  /** A line from the note containing a matched word, for the preview. */
  snippet: string;
}

export interface CategoryHit {
  name: string;
  count: number;
}

export function queryWords(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function wordsOf(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Splitting every note's content into words on every keystroke is the
// expensive part — cache it per note object. Notes are replaced (not
// mutated) on edit, so a stale entry is simply never looked up again.
const contentCache = new WeakMap<Note, { lower: string; words: Set<string> }>();
function contentIndex(n: Note): { lower: string; words: Set<string> } {
  let c = contentCache.get(n);
  if (!c) {
    const lower = n.content.toLowerCase();
    c = { lower, words: new Set(wordsOf(lower)) };
    contentCache.set(n, c);
  }
  return c;
}

/** Levenshtein distance, giving up early once it exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function typoBudget(w: string): number {
  return w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
}

/** 0 = no match; higher = better match of query word `q` against a word list. */
function matchWord(q: string, words: Iterable<string>, fullText: string): number {
  let best = 0;
  const budget = typoBudget(q);
  for (const w of words) {
    if (w === q) return 4;
    if (w.startsWith(q)) best = Math.max(best, 3);
    else if (best < 2 && q.length >= 3 && w.includes(q)) best = 2;
    // Typos rarely hit the first letter, and requiring it keeps this cheap
    // enough to run across every word of every note on each keystroke.
    else if (best < 1 && budget && w[0] === q[0] && editDistance(q, w.slice(0, q.length + budget), budget) <= budget) best = 1;
  }
  // Catches things word-splitting misses, like a query of "e-mail" vs "email".
  if (!best && q.length >= 3 && fullText.includes(q)) best = 2;
  return best;
}

function snippetFor(n: Note, words: string[]): string {
  const lines = n.content.split("\n");
  const clean = (l: string) => l.replace(/[#*`>[\]]/g, "").trim();
  let line = lines.find((l) => {
    const lw = l.toLowerCase();
    return l.trim() && !/^#\s/.test(l) && words.some((w) => lw.includes(w));
  });
  if (!line) line = lines.find((l) => clean(l) && !/^#\s/.test(l)) || "";
  let text = clean(line);
  // Keep the first matched word in view when the line is long.
  if (text.length > 90) {
    const lower = text.toLowerCase();
    const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0), text.length);
    const start = at > 40 && at < text.length ? at - 30 : 0;
    text = (start ? "…" : "") + text.slice(start, start + 90).trim() + "…";
  }
  return text;
}

/** Searches notes by title, category and content. Notes containing every
 * query word come first, best title matches on top. If nothing contains
 * every word, the notes matching the most words are returned instead so a
 * slightly-off query still lands near what was meant. */
export function searchNotes(notes: Note[], query: string, limit = Infinity): SearchHit[] {
  const q = queryWords(query);
  if (!q.length) return [];
  const phrase = query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  for (const n of notes) {
    const title = (n.title || "").toLowerCase();
    const titleWords = wordsOf(title);
    const catWords = wordsOf(n.category || "");
    const content = contentIndex(n);
    let score = 0;
    let matched = 0;
    let titleMatched = 0;
    for (const w of q) {
      const t = matchWord(w, titleWords, title);
      const c = t ? 0 : matchWord(w, catWords, "");
      const b = t || c ? 0 : matchWord(w, content.words, content.lower);
      if (t) titleMatched++;
      if (t || c || b) matched++;
      score += t * 10 + c * 4 + b;
    }
    if (!matched) continue;
    if (titleMatched === q.length) score += 20;
    if (title === phrase) score += 60;
    else if (title.startsWith(phrase)) score += 30;
    else if (title.includes(phrase)) score += 15;
    hits.push({ note: n, score, matched, snippet: "" });
  }
  const full = hits.filter((h) => h.matched === q.length);
  // A single-word query that matched nothing has no "closest" to offer
  // beyond noise; for multi-word queries require at least half the words.
  const pool = full.length ? full : hits.filter((h) => q.length > 1 && h.matched >= Math.ceil(q.length / 2));
  pool.sort((a, b) => b.matched - a.matched || b.score - a.score || a.note.title.localeCompare(b.note.title));
  const out = pool.slice(0, limit);
  for (const h of out) h.snippet = snippetFor(h.note, q);
  return out;
}

/** True when `results` are only partial ("closest") matches for `query`. */
export function isClosestOnly(results: SearchHit[], query: string): boolean {
  return results.length > 0 && results[0].matched < queryWords(query).length;
}

export function searchCategories(categories: string[], notes: Note[], query: string): CategoryHit[] {
  const q = queryWords(query);
  if (!q.length) return [];
  const counts = new Map<string, number>();
  for (const n of notes) if (n.category) counts.set(n.category, (counts.get(n.category) || 0) + 1);
  const all = [...new Set([...categories, ...counts.keys()])];
  return all
    .map((name) => {
      const lower = name.toLowerCase();
      const ws = wordsOf(name);
      let score = 0;
      for (const w of q) {
        const m = matchWord(w, ws, lower);
        if (!m) return null;
        score += m;
      }
      if (lower === query.trim().toLowerCase()) score += 10;
      return { name, count: counts.get(name) || 0, score };
    })
    .filter((c): c is CategoryHit & { score: number } => !!c)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map(({ name, count }) => ({ name, count }));
}

/** Splits text into plain and highlighted parts for every query word, so
 * results can show what matched. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = queryWords(query).filter((w) => w.length >= 2 || queryWords(query).length === 1);
  if (!q.length || !text) return [{ text, hit: false }];
  const re = new RegExp("(" + q.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return text
    .split(re)
    .filter((p) => p !== "")
    .map((p) => ({ text: p, hit: q.includes(p.toLowerCase()) }));
}
