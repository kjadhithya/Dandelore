"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { SearchIcon, SortIcon, MoreIcon, PinIcon } from "@/components/icons/Icons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { CategoryActionsMenu } from "./CategoryActionsMenu";

type CatOrder = "default" | "count-desc" | "count-asc" | "name-az" | "name-za" | "mod-new" | "mod-old" | "created-new" | "created-old";
const CAT_ORDER_OPTS: [CatOrder, string][] = [
  ["default", "Default order"],
  ["count-desc", "Note count (high to low)"],
  ["count-asc", "Note count (low to high)"],
  ["name-az", "Name (A to Z)"],
  ["name-za", "Name (Z to A)"],
  ["mod-new", "Modified (new to old)"],
  ["mod-old", "Modified (old to new)"],
  ["created-new", "Created (new to old)"],
  ["created-old", "Created (old to new)"],
];
const CAT_ORDER_KEYS = new Set(CAT_ORDER_OPTS.map(([k]) => k));

// Read synchronously (not in an effect) so the chosen sort is already
// correct on the very first render — this view only ever mounts after
// VaultShell's own local-DB hydration gate, so there's no SSR pass to
// mismatch against here. Without this, catOrder always started at
// "default" and only a user re-picking it in this session would change
// it, which reads as "the categories are sorted wrong for a second"
// on every reload since there was never anywhere it could recover the
// real choice from.
function readStoredCatOrder(): CatOrder {
  try {
    const v = localStorage.getItem("kv-catOrder");
    if (v && CAT_ORDER_KEYS.has(v as CatOrder)) return v as CatOrder;
  } catch {}
  return "default";
}

export function CategoriesView() {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const [newCat, setNewCat] = useState("");
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  // right:0 off this button overflowed past the left edge on a narrow
  // viewport — measuring and clamping into the visible viewport instead
  // keeps the dropdown on-screen at any width.
  const sortBtnRef = useRef<HTMLDivElement | null>(null);
  const [sortPos, setSortPos] = useState<{ top: number; left: number } | null>(null);
  const [catOrder, setCatOrder] = useState<CatOrder>(readStoredCatOrder);

  useEffect(() => {
    try {
      localStorage.setItem("kv-catOrder", catOrder);
    } catch {}
  }, [catOrder]);

  const catViewList = useMemo(() => {
    // Categories carry no timestamp of their own — "Created" falls back to
    // insertion order in s.categories (append-only, so index doubles as
    // creation order), and "Modified" to the most recently touched note in
    // that category (empty categories sort as never-modified).
    const createdIndex = new Map(s.categories.map((c, i) => [c, i]));
    return s.categories
      .filter((c) => !query.trim() || c.toLowerCase().includes(query.trim().toLowerCase()))
      .map((c) => {
        const notes = sortNotes(s.notes.filter((n) => n.category === c), "mod-new");
        return {
          name: c,
          pinned: s.pinnedCategories.includes(c),
          notes,
          lastModified: notes[0] ? notes[0].modified || notes[0].date || "" : "",
          createdIdx: createdIndex.get(c) ?? 0,
        };
      })
      .sort((a, b) => {
        const pinDiff = Number(b.pinned) - Number(a.pinned);
        if (pinDiff) return pinDiff;
        switch (catOrder) {
          case "count-desc":
            return b.notes.length - a.notes.length;
          case "count-asc":
            return a.notes.length - b.notes.length;
          case "name-az":
            return a.name.localeCompare(b.name);
          case "name-za":
            return b.name.localeCompare(a.name);
          case "mod-new":
            return b.lastModified.localeCompare(a.lastModified);
          case "mod-old":
            return a.lastModified.localeCompare(b.lastModified);
          case "created-new":
            return b.createdIdx - a.createdIdx;
          case "created-old":
            return a.createdIdx - b.createdIdx;
          default:
            return 0;
        }
      });
  }, [s.categories, s.notes, s.pinnedCategories, query, catOrder]);
  const sortLabel = CAT_ORDER_OPTS.find(([k]) => k === catOrder)?.[1] || "Sort";

  return (
    <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 30px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 22, color: "var(--ink)", marginBottom: 14 }}>Categories</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--input)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 10px", flex: 1, minWidth: 140 }}>
            <SearchIcon size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories..."
              style={{ border: "none", background: "transparent", fontSize: 13, color: "var(--ink)", flex: 1, minWidth: 0, fontFamily: "inherit" }}
            />
            {query && (
              <div onClick={() => setQuery("")} title="Clear" style={{ flex: "0 0 auto", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", cursor: "pointer", color: "var(--faint)" }}>
                ×
              </div>
            )}
          </div>
          <div ref={sortBtnRef} style={{ position: "relative", flex: "0 0 auto" }}>
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
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--ink)", border: "1px solid var(--border)", background: "var(--input)", borderRadius: 9, padding: "7px 11px" }}
            >
              <SortIcon size={15} />
              {!isMobile && sortLabel}
            </div>
            {sortOpen && sortPos && (
              <div
                onMouseLeave={() => setSortOpen(false)}
                style={{ position: "fixed", top: sortPos.top, left: sortPos.left, zIndex: 10, minWidth: 200, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)", padding: 5 }}
              >
                {CAT_ORDER_OPTS.map(([key, label]) => (
                  <div
                    key={key}
                    onClick={() => {
                      setCatOrder(key);
                      setSortOpen(false);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer", borderRadius: 6, background: catOrder === key ? "var(--active)" : "transparent" }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = newCat.trim();
                if (v) s.addCategoryGlobal(v);
                setNewCat("");
              }
            }}
            placeholder="+ New category"
            style={{ border: "1px solid var(--border)", background: "var(--input)", borderRadius: 9, padding: "7px 11px", fontSize: 13, color: "var(--ink)", fontFamily: "inherit", width: 150, flex: "0 0 auto" }}
          />
        </div>
        {catViewList.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
            {catViewList.map((cat) => {
              const shown = cat.notes.slice(0, 5);
              return (
                <div key={cat.name} style={{ border: "1px solid var(--border-soft)", borderRadius: 12, padding: "16px 18px", background: "var(--panel)" }}>
                  {s.catRenaming === cat.name ? (
                    <input
                      autoFocus
                      defaultValue={cat.name}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") s.renameCategory(cat.name, (e.target as HTMLInputElement).value);
                        else if (e.key === "Escape") s.renameCategory(cat.name, cat.name);
                      }}
                      onBlur={(e) => s.renameCategory(cat.name, e.target.value)}
                      style={{ border: "1px solid var(--accent, #b0623b)", background: "var(--input)", borderRadius: 7, padding: "5px 10px", fontSize: 16, color: "var(--ink)", fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, marginBottom: 4, width: "100%" }}
                    />
                  ) : (
                    <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          onClick={() => s.goCategory(cat.name)}
                          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 16.5, color: "var(--ink)", overflow: "hidden" }}
                        >
                          {cat.pinned && (
                            <span style={{ display: "flex", color: "var(--accent)" }}>
                              <PinIcon size={13} filled />
                            </span>
                          )}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                          {cat.notes.length} note{cat.notes.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div
                        onClick={() => setMenuFor(menuFor === cat.name ? null : cat.name)}
                        title="More actions"
                        style={{
                          position: "relative",
                          flex: "0 0 auto",
                          width: isMobile ? 40 : 30,
                          height: isMobile ? 40 : 30,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          cursor: "pointer",
                          color: "var(--muted)",
                        }}
                      >
                        <MoreIcon size={16} />
                        {menuFor === cat.name && <CategoryActionsMenu name={cat.name} onClose={() => setMenuFor(null)} />}
                      </div>
                    </div>
                  )}
                  <div style={{ height: 1, background: "var(--border-soft)", margin: "12px 0 10px" }} />
                  {shown.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {shown.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => s.navigate(n.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            s.onNoteContext(n.id, e.clientX, e.clientY);
                          }}
                          style={{ fontSize: 13, color: "var(--text)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {n.title || "Untitled"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "var(--faint)" }}>No notes yet</div>
                  )}
                  {cat.notes.length > 0 && (
                    <div
                      onClick={() => s.goCategory(cat.name)}
                      style={{ marginTop: 12, fontSize: 12.5, color: "var(--accent-text, var(--accent))", cursor: "pointer", fontWeight: 500 }}
                    >
                      View all ({cat.notes.length})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {catViewList.length === 0 && (
          <div style={{ padding: "50px 0", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            {query.trim() ? "No matching categories" : "No categories yet"}
          </div>
        )}
      </div>
    </div>
  );
}
