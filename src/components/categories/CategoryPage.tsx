"use client";
import React, { useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { SortIcon, MoreIcon } from "@/components/icons/Icons";
import { SORT_OPTS } from "@/lib/theme/tokens";
import { CategoryActionsMenu } from "./CategoryActionsMenu";

export function CategoryPage({ name }: { name: string }) {
  const s = useVaultStore();
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notes = sortNotes(
    s.notes.filter((n) => n.category === name),
    s.sort,
  );
  const sortLabel = SORT_OPTS.find(([k]) => k === s.sort)?.[1] || "Sort";

  function commitRename(newName: string) {
    const v = newName.trim();
    if (v && v !== name) {
      s.renameCategory(name, v);
      s.goCategory(v);
    }
  }

  return (
    <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 22px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          {s.catRenaming === name ? (
            <input
              autoFocus
              defaultValue={name}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitRename((e.target as HTMLInputElement).value);
                  useVaultStore.setState({ catRenaming: null });
                } else if (e.key === "Escape") {
                  useVaultStore.setState({ catRenaming: null });
                }
              }}
              onBlur={(e) => {
                commitRename(e.target.value);
                useVaultStore.setState({ catRenaming: null });
              }}
              style={{ flex: 1, border: "1px solid var(--accent, #b0623b)", background: "var(--input)", borderRadius: 8, padding: "5px 10px", fontSize: 22, color: "var(--ink)", fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600 }}
            />
          ) : (
            <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 24, color: "var(--ink)", flex: 1 }}>{name}</div>
          )}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setMenuOpen((v) => !v)}
              title="More actions"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", color: "var(--muted)" }}
            >
              <MoreIcon size={17} />
            </div>
            {menuOpen && <CategoryActionsMenu name={name} onClose={() => setMenuOpen(false)} onDeleted={() => s.goCategories()} />}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1 }}>
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
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
                      s.setSort(key as never);
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
        </div>
        {notes.length === 0 ? (
          <div style={{ padding: "50px 0", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>No notes in this category yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {notes.map((n) => (
              <div
                key={n.id}
                onClick={() => s.navigate(n.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 10px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
              >
                <span style={{ flex: 1, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title || "Untitled"}</span>
                <span style={{ fontSize: 11.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)", flex: "0 0 auto" }}>{n.date || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
