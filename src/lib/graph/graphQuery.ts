// A small subset of Obsidian's search syntax, used by the graph's "Search
// files" filter and by group queries:
//   word "exact phrase"    all terms must match (title or content)
//   -word                   excludes matches
//   a OR b                  either side
//   file:x  path:x  tag:#x  content:x  category:x
// Matching is case-insensitive.

export interface QueryTarget {
  title: string;
  content: string;
  folder: string;
  category: string;
  tags: string[];
}

interface Term {
  neg: boolean;
  op: string | null;
  value: string;
}

function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /-?(?:[a-z]+:)?"[^"]*"|\S+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push(m[0]);
  return out;
}

function parseTerm(tok: string): Term | null {
  let neg = false;
  let t = tok;
  if (t.startsWith("-") && t.length > 1) {
    neg = true;
    t = t.slice(1);
  }
  let op: string | null = null;
  const m = t.match(/^(file|path|tag|content|category|line):(.*)$/i);
  if (m) {
    op = m[1].toLowerCase();
    t = m[2];
  }
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) t = t.slice(1, -1);
  const value = t.toLowerCase();
  if (!value) return null;
  return { neg, op, value };
}

function termMatches(term: Term, x: QueryTarget): boolean {
  const v = term.value;
  const title = x.title.toLowerCase();
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
    case "line":
      return x.content.toLowerCase().includes(v);
    default:
      return title.includes(v) || x.content.toLowerCase().includes(v);
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
