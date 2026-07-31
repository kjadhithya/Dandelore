"use client";
import React, { useEffect, useRef, useState } from "react";
import { EditorEngine, type PopupState } from "@/lib/editor/EditorEngine";
import { useVaultStore, noteTags, copyText } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { FONTS } from "@/lib/theme/tokens";
import { attachFilesToCurrentNote } from "@/lib/vault/attachFiles";
import type { Note } from "@/types/vault";

export function LiveEditor({ note }: { note: Note }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EditorEngine | null>(null);
  const [popup, setPopup] = useState<PopupState>(null);
  const { accentText } = useDerivedTheme();
  const noteFont = useVaultStore((s) => s.noteFont);
  const byTitle = useVaultStore((s) => s.byTitle);
  const allTags = useVaultStore((s) => s.allTags);
  const setNoteContent = useVaultStore((s) => s.setNoteContent);
  const undo = useVaultStore((s) => s.undo);
  const redo = useVaultStore((s) => s.redo);
  const openOrCreate = useVaultStore((s) => s.openOrCreate);
  const openSearch = useVaultStore((s) => s.openSearch);

  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;

  if (!engineRef.current) {
    engineRef.current = new EditorEngine({
      hasNote: (t) => !!byTitle(t),
      getLinkSuggestions: (query) => {
        const dq = query.toLowerCase();
        const titles = useVaultStore
          .getState()
          .notes.map((n) => n.title)
          .filter((t) => !dq || t.toLowerCase().includes(dq))
          .slice(0, 8);
        const sug = titles.map((t) => ({ label: t }));
        if (dq && !useVaultStore.getState().notes.some((n) => n.title.toLowerCase() === dq)) {
          sug.push({ label: `Create "${query}"`, isCreate: true } as { label: string; isCreate: boolean });
        }
        return sug;
      },
      getTagSuggestions: (query) => {
        const dq = query.toLowerCase();
        return allTags()
          .filter((t) => !dq || t.toLowerCase().includes(dq))
          .slice(0, 8);
      },
      onContentChange: (content) => setNoteContent(noteIdRef.current, content),
      onPopupChange: setPopup,
      onPickLink: (title) => openOrCreate(title),
      onOpenSearch: openSearch,
      onUndo: undo,
      onRedo: redo,
      onPasteFiles: (files) => attachFilesToCurrentNote(files),
      copyText,
      accentText,
      codeColor: "var(--code)",
      mutColor: "var(--muted)",
      inkColor: "var(--ink)",
    });
  }

  useEffect(() => {
    const engine = engineRef.current!;
    engine.deps.accentText = accentText;
  }, [accentText]);

  const lastNoteId = useRef(note.id);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = engineRef.current!;
    engine.mount(hostRef.current);
    engine.ed!.style.fontFamily = FONTS[noteFont] || FONTS.Serif;
    engine.ed!.style.fontSize = "15.5px";
    engine.ed!.style.color = "var(--ink)";
    engine.renderFull(note.content);
    return () => {
      engine.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current!;
    if (!engine.ed) return;
    engine.ed.style.fontFamily = FONTS[noteFont] || FONTS.Serif;
  }, [noteFont]);

  useEffect(() => {
    const engine = engineRef.current!;
    if (!engine.ed) return;
    // Re-render whenever we switch to a different note, regardless of focus —
    // in-place edits to the SAME note never hit this branch since serialize()
    // already kept the DOM in sync (avoids clobbering the caret while typing).
    if (note.id !== lastNoteId.current) {
      engine.renderFull(note.content);
    }
    lastNoteId.current = note.id;
  }, [note.id, note.content]);

  const suggestions =
    popup?.type === "link"
      ? popup.suggestions
      : popup?.type === "tag"
        ? popup.suggestions.map((label) => ({ label }))
        : [];

  return (
    <div style={{ position: "relative" }}>
      <div ref={hostRef} />
      {popup && suggestions.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: popup.pos.x,
            top: popup.pos.y,
            zIndex: 70,
            minWidth: 220,
            maxWidth: 360,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 16px 40px -12px rgba(25,20,12,.5)",
            padding: 5,
          }}
        >
          {suggestions.map((sug, i) => (
            <div
              key={sug.label + i}
              onMouseDown={(e) => {
                e.preventDefault();
                if (popup.type === "link") engineRef.current!.pickLink((sug as { label: string; isCreate?: boolean }).isCreate ? popup.query : sug.label);
                else engineRef.current!.pickTag(sug.label);
              }}
              style={{
                padding: "8px 11px",
                borderRadius: 7,
                cursor: "pointer",
                fontFamily: popup.type === "link" ? "var(--font-spectral)" : "var(--font-ibm-plex-mono)",
                fontSize: popup.type === "link" ? 14 : 13,
                color:
                  popup.type === "link"
                    ? (sug as { isCreate?: boolean }).isCreate
                      ? "var(--sage)"
                      : "var(--ink)"
                    : accentText,
                background: i === popup.activeIdx ? "var(--panel)" : "transparent",
              }}
            >
              {popup.type === "tag" ? "#" : ""}
              {sug.label}
            </div>
          ))}
          {popup.type === "link" && (
            <div style={{ padding: "6px 11px 3px", borderTop: "1px solid var(--border-soft)", marginTop: 4, fontSize: 11, color: "var(--faint)" }}>
              ↵ to link · Esc to cancel
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function noteTagsOf(n: Note) {
  return noteTags(n);
}
