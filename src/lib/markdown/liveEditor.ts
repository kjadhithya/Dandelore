import { esc, escAttr } from "./esc";

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
    const cls = hasNote(x.trim()) ? "wl" : "wl missing";
    return (
      '<span class="m">[[</span><a class="' +
      cls +
      '" data-wikilink="' +
      escAttr(x.trim()) +
      '">' +
      x +
      "</a><span class=\"m\">]]</span>"
    );
  });
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="m">[</span><a class="exlink" data-ext="1" href="$2">$1</a><span class="m">]($2)</span>',
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="m">**</span><strong>$1</strong><span class="m">**</span>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<span class="m">*</span><em>$2</em><span class="m">*</span>');
  s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<span class="m">&lt;u&gt;</span><u>$1</u><span class="m">&lt;/u&gt;</span>');
  s = s.replace(/(^|\s)#([a-z0-9][\w/-]*)/gi, '$1<span class="tag" data-tag="$2">#$2</span>');
  return s;
}

export function renderLineLive(text: string, hasNote: TitleResolver): LineRender {
  if (text === "") return { cls: "ln p", html: "<br>" };
  let m: RegExpMatchArray | null;
  if (/^```/.test(text)) return { cls: "ln fence", html: esc(text) || "<br>" };
  if ((m = text.match(/^(#{1,6})(\s+)(.*)$/)))
    return { cls: "ln h" + m[1].length, html: '<span class="m">' + esc(m[1] + m[2]) + "</span>" + inlineLive(m[3], hasNote) };
  if ((m = text.match(/^(\s*>\s?)(.*)$/)))
    return { cls: "ln bq", html: '<span class="m">' + esc(m[1]) + "</span>" + inlineLive(m[2], hasNote) };
  if ((m = text.match(/^(\s*[-*]\s+\[( |x|X)\]\s?)(.*)$/)))
    return {
      cls: "ln task" + (m[2].toLowerCase() === "x" ? " done" : ""),
      html: '<span class="m">' + esc(m[1]) + '</span><span class="bt">' + inlineLive(m[3], hasNote) + "</span>",
    };
  if ((m = text.match(/^(\s*[-*]\s+)(.*)$/)))
    return { cls: "ln bullet", html: '<span class="m">' + esc(m[1]) + "</span>" + inlineLive(m[2], hasNote) };
  if ((m = text.match(/^(\s*\d+\.\s+)(.*)$/)))
    return {
      cls: "ln ol",
      html: '<span style="color:var(--muted);">' + esc(m[1]) + "</span>" + inlineLive(m[2], hasNote),
    };
  if (/^(---|\*\*\*|___)\s*$/.test(text)) return { cls: "ln hr", html: esc(text) };
  return { cls: "ln p", html: inlineLive(text, hasNote) };
}

export function sepLine(t: string): boolean {
  return /\|/.test(t) && /-/.test(t) && /^\s*\|?[\s:|-]+$/.test(t);
}
