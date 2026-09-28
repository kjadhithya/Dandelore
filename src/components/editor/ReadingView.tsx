"use client";
import React, { useMemo } from "react";
import { md2html } from "@/lib/markdown/readingRenderer";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { FONTS } from "@/lib/theme/tokens";
import type { Note } from "@/types/vault";

export function ReadingView({ note }: { note: Note }) {
  const byTitle = useVaultStore((s) => s.byTitle);
  const openOrCreate = useVaultStore((s) => s.openOrCreate);
  const openSearch = useVaultStore((s) => s.openSearch);
  const onNoteContext = useVaultStore((s) => s.onNoteContext);
  const setNoteContent = useVaultStore((s) => s.setNoteContent);
  const noteFont = useVaultStore((s) => s.noteFont);
  const { accentText, accentFadedRgba } = useDerivedTheme();

  const html = useMemo(
    () =>
      md2html(note.content, note.attachments || {}, 0, (t) => !!byTitle(t), {
        code: "var(--code)",
        ink: "var(--ink)",
        text: "var(--text)",
        mut: "var(--muted)",
        sage: "var(--sage)",
        accentText,
        accentFadedRgba,
      }),
    [note.content, note.attachments, byTitle, accentText, accentFadedRgba],
  );

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const cb = t.closest && (t.closest("input[data-task]") as HTMLInputElement | null);
    if (cb) {
      e.preventDefault();
      const idx = parseInt(cb.getAttribute("data-task") || "0", 10);
      let cnt = -1;
      const lines = note.content.split("\n").map((l) => {
        const m = l.match(/^(\s*[-*]\s+)\[( |x|X)\]/);
        if (m) {
          cnt++;
          if (cnt === idx) {
            const d = m[2].toLowerCase() === "x";
            return l.replace(/\[( |x|X)\]/, "[" + (d ? " " : "x") + "]");
          }
        }
        return l;
      });
      setNoteContent(note.id, lines.join("\n"));
      return;
    }
    const tg = t.closest && (t.closest("[data-tag]") as HTMLElement | null);
    if (tg) {
      e.preventDefault();
      openSearch("tag:" + tg.getAttribute("data-tag"));
      return;
    }
    const wl = t.closest && (t.closest("[data-wikilink]") as HTMLElement | null);
    if (wl) {
      e.preventDefault();
      openOrCreate(wl.getAttribute("data-wikilink") || "");
      return;
    }
  }

  // Right-click on a [[link]] to an existing note gets the same note menu
  // as the sidebar (open in new tab / split, bookmark, ...). Links to notes
  // that don't exist yet keep the browser's own menu rather than creating
  // a note just to show a menu for it.
  function onContextMenu(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const wl = t.closest && (t.closest("[data-wikilink]") as HTMLElement | null);
    const target = wl && byTitle(wl.getAttribute("data-wikilink") || "");
    if (!target) return;
    e.preventDefault();
    onNoteContext(target.id, e.clientX, e.clientY);
  }

  return (
    <div
      className="liveedit readview"
      onContextMenu={onContextMenu}
      style={{ fontFamily: FONTS[noteFont] || FONTS.Serif, fontSize: 15.5, color: "var(--ink)" }}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
