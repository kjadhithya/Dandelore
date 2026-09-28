import { esc, escAttr, unesc } from "./esc";

export interface LineRender {
  cls: string;
  html: string;
}

export type TitleResolver = (title: string) => boolean;

export function inlineLive(s: string, hasNote: TitleResolver): string {
  s = esc(s);
  // Bare URLs auto-link, before any other inline syntax runs — the negative
  // lookbehind skips a URL right after "(" so it's left alone for the
  // `[text](url)` pass below instead of getting double-wrapped.
  s = s.replace(/(?<!\()\bhttps?:\/\/[^\s)\]]+/g, (url) => {
    const trimmed = url.replace(/[.,;:!?]+$/, "");
    const trailing = url.slice(trimmed.length);
    return '<a class="exlink" data-ext="1" href="' + trimmed + '">' + trimmed + "</a>" + trailing;
  });
  s = s.replace(
    /`([^`]+)`/g,
    '<span class="m">`</span><code class="ic">$1</code><span class="m">`</span>',
  );
  s = s.replace(
    /!\[\[([^\]]+)\]\]/g,
    (_mm, x) => '<span class="m">![[</span><span class="wl">' + x + "</span><span class=\"m\">]]</span>",
  );
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_mm, x) => {
    const title = unesc(x.trim());
    const cls = hasNote(title) ? "wl" : "wl missing";
    return (
      '<span class="m">[[</span><a class="' +
      cls +
      '" data-wikilink="' +
      escAttr(title) +
      '">' +
      x +
      "</a><span class=\"m\">]]</span>"
    );
  });
  // Unlike the other markup spans (headings, **bold**, [[wikilinks]]...),
  // the "[" and "](url)" here use "elm" instead of "m" — those reveal their
  // raw syntax on the active line so it's editable, but a link's URL is
  // long, isn't something anyone edits character-by-character inline, and
  // just cluttered the line while typing right next to it. "elm" stays
  // hidden regardless of active state; only the label itself is visible.
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="elm">[</span><a class="exlink" data-ext="1" href="$2">$1</a><span class="elm">]($2)</span>',
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="m">**</span><strong>$1</strong><span class="m">**</span>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<span class="m">*</span><em>$2</em><span class="m">*</span>');
  s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<span class="m">&lt;u&gt;</span><u>$1</u><span class="m">&lt;/u&gt;</span>');
  s = s.replace(/(^|\s)#([a-z0-9][\w/-]*)/gi, '$1<span class="tag" data-tag="$2">#$2</span>');
  return s;
}

/** Nesting level of a list line from its leading whitespace: each tab, or
 * each pair of spaces, is one level. */
export function indentLevel(ws: string): number {
  let tabs = 0;
  let spaces = 0;
  for (const ch of ws) {
    if (ch === "\t") tabs++;
    else spaces++;
  }
  return tabs + Math.floor(spaces / 2);
}

function lvlCls(ws: string): string {
  const l = Math.min(indentLevel(ws), 6);
  return l ? " lvl" + l : "";
}

function indSpan(ws: string): string {
  return ws ? '<span class="m ind">' + esc(ws) + "</span>" : "";
}

export function renderLineLive(text: string, hasNote: TitleResolver): LineRender {
  if (text === "") return { cls: "ln p", html: "<br>" };
  let m: RegExpMatchArray | null;
  if (/^```/.test(text)) return { cls: "ln fence", html: esc(text) || "<br>" };
  if ((m = text.match(/^(#{1,6})(\s+)(.*)$/)))
    return { cls: "ln h" + m[1].length, html: '<span class="m">' + esc(m[1] + m[2]) + "</span>" + inlineLive(m[3], hasNote) };
  if ((m = text.match(/^(\s*>\s?)(.*)$/)))
    return { cls: "ln bq", html: '<span class="m">' + esc(m[1]) + "</span>" + inlineLive(m[2], hasNote) };
  // List lines: the leading indentation sets the nesting level (lvl1..lvl6
  // classes indent the line). It goes in its own "ind" span that stays
  // hidden even on the active line — revealing it would shove the text
  // sideways by a tab's width every time the caret entered the line.
  if ((m = text.match(/^(\s*)([-*]\s+\[( |x|X)\]\s?)(.*)$/)))
    return {
      cls: "ln task" + (m[3].toLowerCase() === "x" ? " done" : "") + lvlCls(m[1]),
      html: indSpan(m[1]) + '<span class="m">' + esc(m[2]) + '</span><span class="bt">' + inlineLive(m[4], hasNote) + "</span>",
    };
  if ((m = text.match(/^(\s*)([-*]\s+)(.*)$/)))
    return { cls: "ln bullet" + lvlCls(m[1]), html: indSpan(m[1]) + '<span class="m">' + esc(m[2]) + "</span>" + inlineLive(m[3], hasNote) };
  if ((m = text.match(/^(\s*)(\d+\.\s+)(.*)$/)))
    return {
      cls: "ln ol" + lvlCls(m[1]),
      html: indSpan(m[1]) + '<span class="olnum">' + esc(m[2]) + "</span>" + inlineLive(m[3], hasNote),
    };
  if (/^(---|\*\*\*|___)\s*$/.test(text)) return { cls: "ln hr", html: esc(text) };
  return { cls: "ln p", html: inlineLive(text, hasNote) };
}

export function sepLine(t: string): boolean {
  return /\|/.test(t) && /-/.test(t) && /^\s*\|?[\s:|-]+$/.test(t);
}
