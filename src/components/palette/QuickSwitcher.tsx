"use client";
import React, { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { SearchIcon } from "@/components/icons/Icons";
import { Highlighted } from "@/components/search/Highlighted";
import { searchNotes, searchCategories, isClosestOnly } from "@/lib/search";

export function QuickSwitcher() {
  const s = useVaultStore();
  const { accent } = useDerivedTheme();
  if (!s.quickOpen) return null;

  const qq = s.quickQuery.trim();
  // searchNotes ranks title matches first, so common-word content matches
  // can't crowd a note whose title actually matches out of the top 8.
  const hits = qq ? searchNotes(s.notes, qq, 8) : [];
  const closestOnly = isClosestOnly(hits, qq);
  const cats = qq ? searchCategories(s.categories, s.notes, qq).slice(0, 4) : [];
  const results = qq
    ? hits.map((h) => ({ note: h.note, sub: h.snippet || "Empty note" }))
    : [...s.notes]
        .reverse()
        .slice(0, 8)
        .map((n) => {
          let sub = n.content.replace(/^#\s.*$/m, "").replace(/[#*`>[\]]/g, "").replace(/\n+/g, " ").trim();
          sub = sub.slice(0, 60) || "Empty note";
          return { note: n, sub };
        });

  return (
    <div
      onClick={() => s.closeQuick()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "13vh", zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "90vw", background: "var(--bg)", borderRadius: 13, boxShadow: "0 30px 70px -18px rgba(0,0,0,.5)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 18px", borderBottom: "1px solid var(--border-soft)" }}>
          <span style={{ color: accent }}>
            <SearchIcon size={17} />
          </span>
          <input
            autoFocus
            value={s.quickQuery}
            onChange={(e) => s.onQuick(e.target.value)}
            placeholder="Jump to or search notes…"
            style={{ border: "none", background: "transparent", fontSize: 16, color: "var(--ink)", width: "100%", fontFamily: "var(--font-title, var(--font-spectral))" }}
          />
        </div>
        <div className="vscroll" style={{ maxHeight: 400, overflowY: "auto", padding: 7 }}>
          {cats.map((c) => (
            <div
              key={"cat:" + c.name}
              onClick={() => {
                s.goCategory(c.name);
                s.closeQuick();
              }}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, cursor: "pointer" }}
            >
              <span style={{ fontSize: 13, color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 10px" }}>
                <Highlighted text={c.name} query={qq} color={accent} />
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)" }}>
                category · {c.count}
              </span>
            </div>
          ))}
          {closestOnly && (
            <div style={{ padding: "8px 12px 4px", fontSize: 11.5, color: "var(--faint)" }}>No exact match — closest notes:</div>
          )}
          {results.map(({ note, sub }) => (
            <div
              key={note.id}
              onClick={() => {
                s.navigate(note.id);
                s.closeQuick();
              }}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                  <Highlighted text={note.title || "Untitled"} query={qq} color={accent} />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <Highlighted text={sub} query={qq} color={accent} />
                </div>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)" }}>{note.folder}</span>
            </div>
          ))}
          {results.length === 0 && cats.length === 0 && <div style={{ padding: 18, textAlign: "center", fontSize: 13, color: "var(--faint)" }}>No matches.</div>}
        </div>
      </div>
    </div>
  );
}
