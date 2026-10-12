"use client";
import React, { useEffect, useRef, useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { BookmarkIcon, SortIcon, GraphIcon, CloseIcon } from "@/components/icons/Icons";
import { useGraphSettings } from "@/lib/graph/graphSettings";
import { SORT_OPTS } from "@/lib/theme/tokens";
import { formatDate } from "@/lib/date";

export function BookmarksView() {
  const s = useVaultStore();
  const [sortOpen, setSortOpen] = useState(false);
  // right:0 off this row's own right edge overflowed past the left edge of
  // a narrow (mobile-width) viewport, clipping the dropdown — measuring
  // and clamping into the visible viewport fixes that at any width.
  const sortBtnRef = useRef<HTMLDivElement | null>(null);
  const [sortPos, setSortPos] = useState<{ top: number; left: number } | null>(null);
  const notes = sortNotes(
    s.notes.filter((n) => n.bookmarked),
    s.sort,
  );
  const sortLabel = SORT_OPTS.find(([k]) => k === s.sort)?.[1] || "Sort";
  const graphBookmarks = useGraphSettings((g) => g.bookmarks);
  const removeGraphBookmark = useGraphSettings((g) => g.removeBookmark);
  useEffect(() => useGraphSettings.getState().hydrate(), []);

  return (
    <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 22px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 22, color: "var(--ink)", flex: 1 }}>Bookmarks</div>
          {notes.length > 0 && (
            <div ref={sortBtnRef} style={{ position: "relative" }}>
              <div
                onClick={() => {
                  setSortOpen((v) => {
                    const next = !v;
                    if (next && sortBtnRef.current) {
                      const r = sortBtnRef.current.getBoundingClientRect();
                      const MENU_W = 200;
                      const MARGIN = 8;
                      setSortPos({
                        top: r.bottom + 4,
                        left: Math.min(Math.max(MARGIN, r.right - MENU_W), Math.max(MARGIN, window.innerWidth - MENU_W - MARGIN)),
                      });
                    }
                    return next;
                  });
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: "var(--muted)", border: "1px solid var(--border)", background: "var(--input)", borderRadius: 8, padding: "6px 11px" }}
              >
                <SortIcon size={15} />
                {sortLabel}
              </div>
              {sortOpen && sortPos && (
                <div
                  onMouseLeave={() => setSortOpen(false)}
                  style={{ position: "fixed", top: sortPos.top, left: sortPos.left, zIndex: 10, minWidth: 200, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)", padding: 5 }}
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
        {graphBookmarks.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", padding: "0 10px 6px" }}>Graph views</div>
            {graphBookmarks.map((b) => (
              <div
                key={b.id}
                onClick={() => s.navView({ kind: "graph", id: b.id })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 10px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
              >
                <span style={{ color: "var(--muted)", display: "flex" }}>
                  <GraphIcon size={16} />
                </span>
                <span style={{ flex: 1, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</span>
                <span
                  role="button"
                  title="Remove bookmark"
                  aria-label="Remove bookmark"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeGraphBookmark(b.id);
                  }}
                  style={{ color: "var(--faint)", display: "flex", padding: 4, borderRadius: 6, cursor: "pointer" }}
                >
                  <CloseIcon size={14} />
                </span>
              </div>
            ))}
          </div>
        )}
        {notes.length === 0 && graphBookmarks.length > 0 ? null : notes.length === 0 ? (
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
                <span style={{ fontSize: 11.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)", flex: "0 0 auto" }}>{formatDate(n.date) || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
