/** Converts pasted rich HTML (from a webpage, Google Doc, Notion, Word,
 * etc.) into this app's markdown, so structure — separate paragraphs,
 * links, headings, lists — survives the paste instead of collapsing into
 * one run-on line. Without this, the browser's default paste inserts the
 * raw HTML into the contentEditable, and serialize() reads it back out
 * via plain .textContent, which discards all block-level structure. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const md = childrenToMd(doc.body);
  // Each block handler below (div/p/heading/list/etc.) wraps itself with a
  // leading and trailing newline so it can't run together with a sibling —
  // but that means two adjacent blocks each contribute one, stacking into a
  // blank line between every single line of the source. This app has no
  // "blank line separates paragraphs" convention (every line, including a
  // literal empty one, renders as its own line — see renderLineLive), so
  // collapsing any run of newlines down to exactly one is what actually
  // reproduces the source's line breaks instead of inserting new gaps.
  return (
    mergeAdjacentBold(md)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

/** Adjacent bold runs (<b>foo</b><b>bar</b> — Word/Docs split formatting at
 * every style change) would otherwise meet as "**foo****bar**", which the
 * renderers show as a pile of literal asterisks. */
function mergeAdjacentBold(s: string): string {
  return s.replace(/\*\*([ \t]*)\*\*/g, "$1");
}

/** Wraps inline content in a markdown marker (** or *) without breaking it.
 * The renderers only recognise a marker pair on a single line with no
 * whitespace just inside it, so surrounding whitespace is moved outside the
 * markers (`<b>Source: </b>` → `**Source:** `), and content spanning several
 * lines (a <b> around a <p>, a <br> inside bold) gets each line wrapped on
 * its own instead of leaving a lone "**" stranded on a line. */
function wrapInline(inner: string, marker: string): string {
  if (!inner.trim()) return inner;
  return inner
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)(.*?)(\s*)$/);
      if (!m || !m[2]) return line;
      // Already fully wrapped (bold nested in bold) — don't double it up
      // into "****text****".
      if (m[2].length > marker.length * 2 && m[2].startsWith(marker) && m[2].endsWith(marker)) return line;
      return m[1] + marker + m[2] + marker + m[3];
    })
    .join("\n");
}

/** Some sources mark bold with CSS instead of <b> — Google Docs does this for
 * every styled run — and Docs also wraps the whole paste in
 * <b style="font-weight:normal">, which must NOT make everything bold. */
function styleWeight(el: HTMLElement): "bold" | "normal" | null {
  const w = el.style?.fontWeight;
  if (!w) return null;
  return w === "bold" || w === "bolder" || Number(w) >= 600 ? "bold" : "normal";
}

/** Converts a <table> into a markdown pipe table, which the reading view
 * renders as a real table. Each cell is flattened onto one line (a newline
 * inside a cell would break the row) and literal pipes are escaped. */
function tableToMd(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr")).filter((tr) => tr.closest("table") === table);
  const grid = rows
    .map((tr) =>
      Array.from(tr.children)
        .filter((c) => /^t[hd]$/i.test(c.tagName))
        .map((c) =>
          mergeAdjacentBold(childrenToMd(c as HTMLElement))
            .replace(/\s*\n\s*/g, " ")
            .replace(/\|/g, "\\|")
            .trim(),
        ),
    )
    .filter((r) => r.length);
  if (!grid.length) return "";
  const cols = Math.max(...grid.map((r) => r.length));
  const line = (r: string[]) => "| " + Array.from({ length: cols }, (_, i) => r[i] || "").join(" | ") + " |";
  const out = [line(grid[0]), "| " + Array(cols).fill("---").join(" | ") + " |", ...grid.slice(1).map(line)];
  return `\n\n${out.join("\n")}\n\n`;
}

function childrenToMd(el: HTMLElement): string {
  return Array.from(el.childNodes).map(walk).join("");
}

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "script" || tag === "style") return "";
  if (tag === "br") return "\n";

  if (tag === "img") {
    const src = el.getAttribute("src") || "";
    if (!src) return "";
    const alt = el.getAttribute("alt") || "";
    return `![${alt}](${src})`;
  }

  if (tag === "a") {
    // Rich-copy sources (Google Docs, web apps, chat UIs) often wrap an
    // image in a link with no other visible text — without this, the
    // fallback below would emit the bare href as literal paragraph text.
    if (el.children.length === 1 && el.children[0].tagName.toLowerCase() === "img" && !(el.textContent || "").trim()) {
      return walk(el.children[0]);
    }
    const href = el.getAttribute("href") || "";
    const text = childrenToMd(el).trim();
    if (!href) return text;
    if (!text) return "";
    if (text === href) return href;
    return `[${text}](${href})`;
  }
  if (tag === "table") return tableToMd(el);
  if (tag === "strong" || tag === "b" || (tag === "span" && styleWeight(el) === "bold")) {
    const inner = childrenToMd(el);
    if (tag !== "span" && styleWeight(el) === "normal") return inner;
    // Bold or italic nested inside bold ("**a **b** c**", "**a *b* c**")
    // isn't understood by the renderers and shows up as stray asterisks —
    // keep the text, drop the inner markers.
    return wrapInline(inner.replace(/\*\*/g, "").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2"), "**");
  }
  if (tag === "em" || tag === "i" || (tag === "span" && el.style?.fontStyle === "italic")) {
    return wrapInline(childrenToMd(el), "*");
  }
  if (tag === "code") {
    return `\`${el.textContent || ""}\``;
  }
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const inner = childrenToMd(el).trim();
    return inner ? `\n\n${"#".repeat(level)} ${inner}\n\n` : "";
  }
  if (tag === "blockquote") {
    const inner = childrenToMd(el).trim();
    return inner
      ? `\n\n${inner
          .split("\n")
          .map((l) => "> " + l)
          .join("\n")}\n\n`
      : "";
  }
  if (tag === "hr") return "\n\n---\n\n";
  if (tag === "ul" || tag === "ol") {
    const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "li");
    const lines = items.map((li, i) => {
      // A nested <ul>/<ol> inside the item comes back as its own list lines
      // — indent those a level so the nesting survives the paste.
      const [first, ...rest] = childrenToMd(li as HTMLElement)
        .trim()
        .split("\n")
        .filter((l) => l.trim());
      const nested = rest.map((l) => (/^\s*([-*]|\d+\.)\s/.test(l) ? "\t" + l : l));
      return [(tag === "ol" ? `${i + 1}. ` : "- ") + (first || ""), ...nested].join("\n");
    });
    return lines.length ? `\n\n${lines.join("\n")}\n\n` : "";
  }
  if (tag === "p" || tag === "div") {
    const inner = childrenToMd(el).trim();
    return inner ? `\n\n${inner}\n\n` : "";
  }
  // Anything else (span, table cells, semantic wrappers, etc.) — keep its
  // text but don't force a block break around it.
  return childrenToMd(el);
}
