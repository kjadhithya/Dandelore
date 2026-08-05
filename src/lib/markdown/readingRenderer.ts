import { esc } from "./esc";
import { escAttr } from "./esc";
import type { Attachment } from "@/types/vault";
import type { TitleResolver } from "./liveEditor";

export interface ReadingColors {
  code: string;
  ink: string;
  text: string;
  mut: string;
  sage: string;
  accentText: string;
  accentFadedRgba: string;
}

function inline(s: string, atts: Record<string, Attachment>, hasNote: TitleResolver, C: ReadingColors): string {
  s = esc(s);
  s = s.replace(/(?<!\()\bhttps?:\/\/[^\s)\]]+/g, (url) => {
    const trimmed = url.replace(/[.,;:!?]+$/, "");
    const trailing = url.slice(trimmed.length);
    return '<a class="exlink" data-ext="1" href="' + trimmed + '" target="_blank">' + trimmed + "</a>" + trailing;
  });
  s = s.replace(
    /`([^`]+)`/g,
    '<code style="background:' +
      C.code +
      ';padding:1px 5px;border-radius:4px;font-family:IBM Plex Mono,monospace;font-size:.88em;">$1</code>',
  );
  s = s.replace(/!\[\[([^\]]+)\]\]/g, (_m, nm) => {
    const a = atts[nm.trim()];
    if (!a) return '<span style="color:' + C.accentFadedRgba + ';">[' + nm.trim() + " — missing]</span>";
    const t = a.type || "";
    if (t.indexOf("image") === 0)
      return (
        '<img data-embed="' +
        escAttr(nm.trim()) +
        '" src="' +
        a.url +
        '" style="width:' +
        (a.w || "100%") +
        ';border-radius:8px;margin:8px 0;display:block;">'
      );
    if (t.indexOf("video") === 0)
      return '<video src="' + a.url + '" controls style="max-width:100%;border-radius:8px;margin:8px 0;display:block;"></video>';
    if (t.indexOf("audio") === 0) return '<audio src="' + a.url + '" controls style="width:100%;margin:8px 0;"></audio>';
    if (t.indexOf("pdf") >= 0)
      return (
        '<embed src="' +
        a.url +
        '" type="application/pdf" style="width:100%;height:420px;border-radius:8px;border:1px solid var(--border);margin:8px 0;">'
      );
    return (
      '<a href="' +
      a.url +
      '" download="' +
      escAttr(nm.trim()) +
      '" style="display:inline-block;padding:8px 12px;background:' +
      C.code +
      ';border-radius:8px;border:1px solid var(--border);margin:6px 0;">⬇ ' +
      nm.trim() +
      "</a>"
    );
  });
  s = s.replace(
    /\[\[([^\]]+)\]\]/g,
    (_m, t) =>
      '<a class="wl' +
      (hasNote(t.trim()) ? "" : " missing") +
      '" data-wikilink="' +
      escAttr(t.trim()) +
      '" href="#">' +
      t.trim() +
      "</a>",
  );
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="exlink" data-ext="1" href="$2" target="_blank">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(
    /(^|\s)#([a-z0-9][\w/-]*)/gi,
    '$1<span data-tag="$2" style="color:' + C.accentText + ';cursor:pointer;">#$2</span>',
  );
  return s;
}

export function md2html(
  md: string,
  atts: Record<string, Attachment>,
  taskStart: number,
  hasNote: TitleResolver,
  C: ReadingColors,
): string {
  atts = atts || {};
  let taskIdx = (taskStart || 0) - 1;
  const lines = md.split("\n");
  let out = "";
  let i = 0;
  const listOpen = { ul: false, ol: false };
  const closeLists = () => {
    if (listOpen.ul) {
      out += "</ul>";
      listOpen.ul = false;
    }
    if (listOpen.ol) {
      out += "</ol>";
      listOpen.ol = false;
    }
  };
  const inl = (s: string) => inline(s, atts, hasNote, C);

  // True for any line that starts a different block type (or is blank) —
  // used to find where a run of plain paragraph lines ends, so consecutive
  // source lines with no blank line between them join into one <p> instead
  // of each getting their own paragraph margin. That grouping is what makes
  // reading-mode spacing match the live editor, where a blank line is the
  // only thing that creates a visible gap between lines.
  const isSpecialLine = (l: string) =>
    /^```/.test(l) ||
    /^#{1,6}\s/.test(l) ||
    /^\s*>/.test(l) ||
    /^\s*[-*]\s+\[( |x|X)\]/.test(l) ||
    /^\s*[-*]\s+/.test(l) ||
    /^\s*\d+\.\s+/.test(l) ||
    /^\s*(---|\*\*\*)\s*$/.test(l) ||
    /^\s*$/.test(l);

  // The live editor renders every source line as its own div — a blank
  // line is a real (empty) line with its own height, so it's the *only*
  // thing that visibly separates two blocks; adjacent non-blank lines sit
  // almost flush. Reading mode used to give every block a fixed CSS margin
  // regardless of the source, which both squeezed real paragraph breaks and
  // added space that wasn't in the source at all. Instead, every block
  // below has ~0 margin of its own, and blank source lines are rendered as
  // explicit spacers (one per blank line, so two blank lines really do take
  // twice the space) — spacing now comes from the source the same way it
  // does in edit mode, not from a fixed per-block-type constant.
  let blankRun = 0;
  const flushBlanks = () => {
    for (let n = 0; n < blankRun; n++) out += '<div style="height:1.85em"></div>';
    blankRun = 0;
  };

  while (i < lines.length) {
    const ln = lines[i];
    if (/^\s*$/.test(ln)) {
      blankRun++;
      i++;
      continue;
    }
    if (/^```/.test(ln)) {
      closeLists();
      flushBlanks();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out +=
        '<pre style="background:' +
        C.code +
        ';border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow:auto;font-family:IBM Plex Mono,monospace;font-size:12.5px;line-height:1.6;color:var(--text);margin:0;">' +
        esc(buf.join("\n")) +
        "</pre>";
      continue;
    }
    if (/\|/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      closeLists();
      flushBlanks();
      const row = (l: string) =>
        l
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = row(ln);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
        body.push(row(lines[i]));
        i++;
      }
      out +=
        '<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:13px;"><thead><tr>' +
        head
          .map(
            (h) =>
              '<th style="text-align:left;padding:7px 10px;border-bottom:2px solid var(--border-soft);color:' +
              C.mut +
              ';font-weight:600;">' +
              inl(h) +
              "</th>",
          )
          .join("") +
        "</tr></thead><tbody>";
      body.forEach((r) => {
        out +=
          "<tr>" +
          r
            .map(
              (c) =>
                '<td style="padding:7px 10px;border-bottom:1px solid var(--border-soft);color:' +
                C.text +
                ';">' +
                inl(c) +
                "</td>",
            )
            .join("") +
          "</tr>";
      });
      out += "</tbody></table>";
      continue;
    }
    if (/^#{1,6}\s/.test(ln)) {
      closeLists();
      flushBlanks();
      const lvl = ln.match(/^#+/)![0].length;
      const sz = [0, 26, 21, 18, 16, 15, 14][lvl];
      const mtb = [
        [0, 0],
        [2, 4],
        [12, 3],
        [10, 2],
        [8, 2],
        [8, 2],
        [8, 2],
      ][lvl];
      out +=
        "<h" +
        lvl +
        ' style="font-family:var(--font-title, Spectral),serif;font-weight:600;font-size:' +
        sz +
        "px;color:var(--ink);margin:" +
        mtb[0] +
        "px 0 " +
        mtb[1] +
        'px;line-height:1.25;">' +
        inl(ln.replace(/^#+\s/, "")) +
        "</h" +
        lvl +
        ">";
      i++;
      continue;
    }
    if (/^\s*>/.test(ln)) {
      closeLists();
      flushBlanks();
      out +=
        '<blockquote style="border-left:3px solid ' +
        C.accentText +
        ';margin:0;padding:10px 16px;color:var(--text);font-style:italic;background:color-mix(in srgb, var(--ink) 6%, transparent);border-radius:0 6px 6px 0;">' +
        inl(ln.replace(/^\s*>\s?/, "")) +
        "</blockquote>";
      i++;
      continue;
    }
    if (/^\s*[-*]\s+\[( |x|X)\]/.test(ln)) {
      if (blankRun > 0) closeLists();
      flushBlanks();
      if (listOpen.ol) {
        out += "</ol>";
        listOpen.ol = false;
      }
      if (!listOpen.ul) {
        out += '<ul style="list-style:none;padding:0;margin:0;">';
        listOpen.ul = true;
      }
      taskIdx++;
      const done = /\[(x|X)\]/.test(ln);
      const txt = ln.replace(/^\s*[-*]\s+\[( |x|X)\]\s?/, "");
      out +=
        '<li style="display:flex;align-items:flex-start;gap:9px;margin:0;line-height:1.6;"><input type="checkbox" data-task="' +
        taskIdx +
        '" ' +
        (done ? "checked" : "") +
        ' style="margin-top:4px;accent-color:' +
        C.sage +
        ';cursor:pointer;width:15px;height:15px;flex:0 0 auto;"><span style="' +
        (done ? "color:var(--faint);text-decoration:line-through;" : "color:var(--text);") +
        '">' +
        inl(txt) +
        "</span></li>";
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(ln)) {
      if (blankRun > 0) closeLists();
      flushBlanks();
      if (listOpen.ol) {
        out += "</ol>";
        listOpen.ol = false;
      }
      if (!listOpen.ul) {
        out += '<ul style="padding-left:20px;margin:0;">';
        listOpen.ul = true;
      }
      out +=
        '<li style="margin:0;line-height:1.75;color:var(--text);">' + inl(ln.replace(/^\s*[-*]\s+/, "")) + "</li>";
      i++;
      continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      if (blankRun > 0) closeLists();
      flushBlanks();
      if (listOpen.ul) {
        out += "</ul>";
        listOpen.ul = false;
      }
      if (!listOpen.ol) {
        out += '<ol style="padding-left:22px;margin:0;">';
        listOpen.ol = true;
      }
      out +=
        '<li style="margin:0;line-height:1.75;color:var(--text);">' + inl(ln.replace(/^\s*\d+\.\s+/, "")) + "</li>";
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(ln)) {
      closeLists();
      flushBlanks();
      out += '<hr style="border:none;border-top:1px solid var(--border-soft);margin:12px 0;">';
      i++;
      continue;
    }
    closeLists();
    flushBlanks();
    const para: string[] = [ln];
    i++;
    while (i < lines.length && !isSpecialLine(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out += '<p style="margin:0;line-height:1.75;color:var(--text);">' + para.map(inl).join("<br>") + "</p>";
  }
  closeLists();
  return out;
}
