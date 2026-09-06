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
  return md
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
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
  if (tag === "strong" || tag === "b") {
    const inner = childrenToMd(el).trim();
    return inner ? `**${inner}**` : "";
  }
  if (tag === "em" || tag === "i") {
    const inner = childrenToMd(el).trim();
    return inner ? `*${inner}*` : "";
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
      const inner = childrenToMd(li as HTMLElement).trim();
      return (tag === "ol" ? `${i + 1}. ` : "- ") + inner;
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
