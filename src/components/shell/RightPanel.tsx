"use client";
import React, { useMemo } from "react";
import { useVaultStore, linksOf } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export function RightPanel() {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const { accentText, accentFadedRgba } = useDerivedTheme();
  const focusOnSplit = s.lastPane === "split" && !!s.split;
  const splitId = s.splitCurId();
  const splitNote = splitId ? s.notes.find((n) => n.id === splitId) : undefined;
  const rightNote = focusOnSplit ? splitNote : s.cur();

  const { backlinks, outgoing } = useMemo(() => {
    if (!rightNote) return { backlinks: [], outgoing: [] };
    const others = s.notes.filter((n) => n.id !== rightNote.id);
    const bl = others
      .filter((n) => linksOf(n).some((t) => t.toLowerCase() === rightNote.title.toLowerCase()))
      .map((n) => {
        let sn = n.content.replace(/[#*`>[\]]/g, "").replace(/\n+/g, " ").trim();
        sn = sn.length > 72 ? sn.slice(0, 72) + "…" : sn;
        return { note: n, snippet: sn };
      });
    const og = linksOf(rightNote).map((t) => {
      const tgt = s.byTitle(t);
      return { title: t, color: tgt ? accentText : accentFadedRgba, tag: tgt ? "" : "· new", target: tgt };
    });
    return { backlinks: bl, outgoing: og };
  }, [rightNote, s.notes, accentText, accentFadedRgba, s]);

  const showRight = s.showRight && !!rightNote;
  if (!showRight) return null;

  // Split view is disabled on mobile, so backlinks are always driven off the main pane there.
  const closeMobile = () => s.toggleRightMain();

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)" }}>Backlinks</span>
        <span style={{ fontSize: 10, color: "var(--ink)", background: "var(--code)", borderRadius: 20, padding: "0 6px", lineHeight: "15px" }}>{backlinks.length}</span>
      </div>
      {backlinks.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {backlinks.map(({ note, snippet }) => (
            <div
              key={note.id}
              onClick={() => s.navigate(note.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                s.onNoteContext(note.id, e.clientX, e.clientY);
              }}
              style={{ cursor: "pointer", background: "var(--bg)", border: "1px solid var(--border-soft)", borderRadius: 9, padding: "9px 11px" }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{note.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{snippet}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--faint)", fontStyle: "italic" }}>No notes link here yet.</div>
      )}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", margin: "20px 0 9px" }}>Outgoing links</div>
      {outgoing.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {outgoing.map((og) => (
            <div
              key={og.title}
              onClick={() => s.openOrCreate(og.title)}
              onContextMenu={(e) => {
                if (og.target) {
                  e.preventDefault();
                  s.onNoteContext(og.target.id, e.clientX, e.clientY);
                } else e.preventDefault();
              }}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: og.color, padding: "4px 6px", borderRadius: 6 }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{og.title}</span>
              <span style={{ fontSize: 10, color: "var(--faint)" }}>{og.tag}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--faint)", fontStyle: "italic" }}>No outgoing links.</div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div onClick={closeMobile} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 66, display: "flex", alignItems: "flex-end" }}>
        <div
          className="vscroll"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxHeight: "70vh",
            background: "var(--panel)",
            borderRadius: "16px 16px 0 0",
            boxShadow: "0 -18px 44px -12px rgba(25,20,12,.4)",
            overflowY: "auto",
            padding: "10px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
            <span style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="vscroll"
      style={{ width: 262, flex: "0 0 auto", background: "var(--panel)", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: "16px 16px 22px" }}
    >
      {content}
    </div>
  );
}
