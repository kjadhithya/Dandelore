// A subset of Obsidian's search syntax, used by the graph's "Search files"
// filter and by group queries:
//   word "exact phrase"    all terms must match (title or content)
//   -word                   excludes matches
//   a OR b                  either side
//   path:x  file:x  tag:#x  content:x  category:x
//   line:(a b)              all words on the same line
//   section:(a b)           all words under the same heading
//   [property]  [property:value]   note properties (category, tags, date, folder)
// Matching is case-insensitive.

export interface QueryTarget {
  title: string;
  content: string;
  folder: string;
  category: string;
  tags: string[];
  date?: string;
}

interface Term {
  neg: boolean;
  op: string | null;
  value: string;
  /** For [property] terms: the property name. */
  prop?: string;
}

function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /-?\[[^\]]*\]?|-?(?:[a-z]+:)?(?:"[^"]*"|\([^)]*\)?|\S+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push(m[0]);
  return out;
}

function unwrap(v: string): string {
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) return v.slice(1, -1);
  if (v.startsWith("(")) return v.slice(1, v.endsWith(")") ? -1 : undefined);
  return v;
}

function parseTerm(tok: string): Term | null {
  let neg = false;
  let t = tok;
  if (t.startsWith("-") && t.length > 1) {
    neg = true;
    t = t.slice(1);
  }
  if (t.startsWith("[")) {
    const inner = t.slice(1, t.endsWith("]") ? -1 : undefined);
    const i = inner.indexOf(":");
    const prop = (i >= 0 ? inner.slice(0, i) : inner).trim().toLowerCase();
    const value = (i >= 0 ? unwrap(inner.slice(i + 1).trim()) : "").toLowerCase();
    return prop ? { neg, op: "property", prop, value } : null;
  }
  let op: string | null = null;
  const m = t.match(/^(file|path|tag|content|category|line|section):(.*)$/i);
  if (m) {
    op = m[1].toLowerCase();
    t = m[2];
  }
  const value = unwrap(t).toLowerCase().trim();
  if (!value) return null;
  return { neg, op, value };
}

const words = (v: string) => v.split(/\s+/).filter(Boolean);
const hasAll = (text: string, ws: string[]) => ws.every((w) => text.includes(w));

function sections(content: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const line of content.split("\n")) {
    if (/^#{1,6}\s/.test(line) && cur.length) {
      out.push(cur.join("\n"));
      cur = [];
    }
    cur.push(line);
  }
  out.push(cur.join("\n"));
  return out;
}

function propertyValues(x: QueryTarget, prop: string): string[] | null {
  switch (prop) {
    case "category":
      return x.category ? [x.category] : [];
    case "tags":
    case "tag":
      return x.tags;
    case "date":
      return x.date ? [x.date] : [];
    case "folder":
      return x.folder ? [x.folder] : [];
    case "title":
      return [x.title];
    default:
      return null;
  }
}

function termMatches(term: Term, x: QueryTarget): boolean {
  const v = term.value;
  const title = x.title.toLowerCase();
  const content = x.content.toLowerCase();
  switch (term.op) {
    case "file":
      return title.includes(v);
    case "path":
      return (x.folder + "/" + x.title).toLowerCase().includes(v);
    case "tag": {
      const want = v.replace(/^#/, "");
      return x.tags.some((t) => {
        const tag = t.toLowerCase();
        return tag === want || tag.startsWith(want + "/");
      });
    }
    case "category":
      return x.category.toLowerCase().includes(v);
    case "content":
      return hasAll(content, words(v));
    case "line": {
      const ws = words(v);
      return content.split("\n").some((l) => hasAll(l, ws));
    }
    case "section": {
      const ws = words(v);
      return sections(content).some((s) => hasAll(s, ws));
    }
    case "property": {
      const vals = propertyValues(x, term.prop!);
      if (!vals) return false;
      if (!v) return vals.length > 0;
      return vals.some((p) => p.toLowerCase().replace(/^#/, "").includes(v.replace(/^#/, "")));
    }
    default:
      return words(v).every((w) => title.includes(w) || content.includes(w));
  }
}

/** Compile a query once; returns null for an empty query (matches all). */
export function compileQuery(q: string): ((x: QueryTarget) => boolean) | null {
  const alternatives = q
    .split(/\s+OR\s+/)
    .map((part) => tokenize(part).map(parseTerm).filter((t): t is Term => !!t))
    .filter((terms) => terms.length > 0);
  if (!alternatives.length) return null;
  return (x) => alternatives.some((terms) => terms.every((t) => termMatches(t, x) !== t.neg));
}
