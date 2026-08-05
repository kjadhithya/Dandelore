"use client";
import React, { useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { BookmarkIcon, SortIcon } from "@/components/icons/Icons";
import { SORT_OPTS } from "@/lib/theme/tokens";

export function BookmarksView() {
  const s = useVaultStore();
  const [sortOpen, setSortOpen] = useState(false);
  const notes = sortNotes(
    s.notes.filter((n) => n.bookmarked),
    s.sort,
  );
  const sortLabel = SORT_OPTS.find(([k]) => k === s.sort)?.[1] || "Sort";

  return (
    <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 22px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 22, color: "var(--ink)", flex: 1 }}>Bookmarks</div>
          {notes.length > 0 && (
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setSortOpen((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: "var(--muted)", border: "1px solid var(--border)", background: "var(--input)", borderRadius: 8, padding: "6px 11px" }}
              >
                <SortIcon size={15} />
                {sortLabel}
              </div>
              {sortOpen && (
                <div
                  onMouseLeave={() => setSortOpen(false)}
                  style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 10, minWidth: 200, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)", padding: 5 }}
                >
                  {SORT_OPTS.map(([key, label]) => (
                    <div
                      key={key}
                      onClick={() => {
                        s.setSort(key);
                        setSortOpen(false);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer", borderRadius: 6, background: s.sort === key ? "var(--active)" : "transparent" }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {notes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 0", color: "var(--muted)" }}>
            <BookmarkIcon size={30} />
            <span style={{ fontSize: 13.5 }}>No bookmarked notes yet</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {notes.map((n) => (
              <div
                key={n.id}
                onClick={() => s.navigate(n.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  s.onNoteContext(n.id, e.clientX, e.clientY);
                }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 10px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
              >
                <span style={{ flex: 1, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title || "Untitled"}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", flex: "0 0 auto", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.category || n.folder || ""}</span>
                <span style={{ fontSize: 11.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)", flex: "0 0 auto" }}>{n.date || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
