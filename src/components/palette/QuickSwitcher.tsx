"use client";
import React, { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { SearchIcon } from "@/components/icons/Icons";

export function QuickSwitcher() {
  const s = useVaultStore();
  const { accent } = useDerivedTheme();
  if (!s.quickOpen) return null;

  const qq = s.quickQuery.trim().toLowerCase();
  const qsrc = qq ? s.notes.filter((n) => n.title.toLowerCase().includes(qq) || n.content.toLowerCase().includes(qq)) : [...s.notes].reverse();
  const curId = s.curId();
  const results = qsrc.slice(0, 8).map((n) => {
    let sub = n.content.replace(/^#\s.*$/m, "").replace(/[#*`>[\]]/g, "").replace(/\n+/g, " ").trim();
    sub = sub.slice(0, 60) || "Empty note";
    return { note: n, sub, dot: n.id === curId ? accent : "var(--sage)" };
  });

  return (
    <div
      onClick={() => s.closeQuick()}
      style={{ position: "fixed", inset: 0, background: "rgba(58,48,32,0.34)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "13vh", zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "90vw", background: "var(--bg)", borderRadius: 13, boxShadow: "0 30px 70px -18px rgba(50,40,25,.6)", overflow: "hidden" }}>
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
        <div className="vscroll" style={{ maxHeight: 340, overflowY: "auto", padding: 7 }}>
          {results.map(({ note, sub, dot }) => (
            <div
              key={note.id}
              onClick={() => {
                s.navigate(note.id);
                s.closeQuick();
              }}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "0 0 auto" }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{note.title || "Untitled"}</div>
                <div style={{ fontSize: 11.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)" }}>{note.folder}</span>
            </div>
          ))}
          {results.length === 0 && <div style={{ padding: 18, textAlign: "center", fontSize: 13, color: "var(--faint)" }}>No matches.</div>}
        </div>
      </div>
    </div>
  );
}
