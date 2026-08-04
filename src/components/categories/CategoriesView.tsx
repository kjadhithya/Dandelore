"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { SearchIcon, SortIcon, EditIcon, TrashIcon } from "@/components/icons/Icons";
import { SORT_OPTS } from "@/lib/theme/tokens";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

function CategoryRowMenu({ name, onClose }: { name: string; onClose: () => void }) {
  const s = useVaultStore();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
        zIndex: 30,
        minWidth: 150,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 16px 40px -12px rgba(25,20,12,.5)",
        padding: 5,
      }}
    >
      <div
        onClick={() => {
          useVaultStore.setState({ catRenaming: name });
          onClose();
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6 }}
      >
        <EditIcon size={14} />
        Rename
      </div>
      <div
        onClick={() => {
          onClose();
          s.openConfirm({
            title: "Delete category?",
            message: `"${name}" will be removed. Notes in this category are kept, just uncategorized.`,
            confirmLabel: "Delete category",
            onConfirm: () => s.deleteCategory(name),
          });
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "#c15a3d", cursor: "pointer", borderRadius: 6 }}
      >
        <TrashIcon size={14} />
        Delete
      </div>
    </div>
  );
}

export function CategoriesView() {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const [newCat, setNewCat] = useState("");
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const catViewList = useMemo(
    () =>
      s.categories
        .filter((c) => !query.trim() || c.toLowerCase().includes(query.trim().toLowerCase()))
        .map((c) => ({
          name: c,
          notes: sortNotes(s.notes.filter((n) => n.category === c), s.sort),
        })),
    [s.categories, s.notes, s.sort, query],
  );
  const sortLabel = SORT_OPTS.find(([k]) => k === s.sort)?.[1] || "Sort";

  function NoteCard({ note }: { note: (typeof s.notes)[number] }) {
    const [hover, setHover] = useState(false);
    return (
      <div
        onClick={() => s.navigate(note.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          s.onNoteContext(note.id, e.clientX, e.clientY);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ cursor: "pointer", background: "var(--panel)", border: `1px solid ${hover ? "var(--edge)" : "var(--border-soft)"}`, borderRadius: 9, padding: "9px 12px" }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{note.folder || "—"}</div>
      </div>
    );
  }

  return (
    <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 22px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 22, color: "var(--ink)", marginBottom: 14 }}>Categories</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: isMobile ? "wrap" : "nowrap" }}>
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
          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <div
              onClick={() => setSortOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--ink)", border: "1px solid var(--border)", background: "var(--input)", borderRadius: 9, padding: "7px 11px" }}
            >
              <SortIcon size={15} />
              {!isMobile && sortLabel}
            </div>
            {sortOpen && (
              <div
                onMouseLeave={() => setSortOpen(false)}
                style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 10, minWidth: 200, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 16px 40px -12px rgba(25,20,12,.5)", padding: 5 }}
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
        {catViewList.map((cat) => (
          <div key={cat.name} style={{ marginBottom: 16 }}>
            {s.catRenaming === cat.name ? (
              <input
                autoFocus
                defaultValue={cat.name}
                onKeyDown={(e) => {
                  if (e.key === "Enter") s.renameCategory(cat.name, (e.target as HTMLInputElement).value);
                  else if (e.key === "Escape") s.renameCategory(cat.name, cat.name);
                }}
                onBlur={(e) => s.renameCategory(cat.name, e.target.value)}
                style={{ border: "1px solid var(--accent, #b0623b)", background: "var(--input)", borderRadius: 7, padding: "5px 10px", fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, marginBottom: 6 }}
              />
            ) : (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "4px 2px 8px",
                  borderBottom: "1px solid var(--border-soft)",
                  marginBottom: 8,
                }}
              >
                <span
                  onClick={() => s.goCategory(cat.name)}
                  style={{ cursor: "pointer", fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 15.5, color: "var(--ink)" }}
                >
                  {cat.name}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink)", background: "var(--code)", borderRadius: 20, padding: "1px 8px", flex: "0 0 auto" }}>{cat.notes.length}</span>
                <div style={{ flex: 1 }} />
                <div
                  onClick={() => setMenuFor(menuFor === cat.name ? null : cat.name)}
                  title="Edit category"
                  style={{
                    position: "relative",
                    width: isMobile ? 40 : 32,
                    height: isMobile ? 40 : 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "var(--muted)",
                  }}
                >
                  <EditIcon size={15} />
                  {menuFor === cat.name && <CategoryRowMenu name={cat.name} onClose={() => setMenuFor(null)} />}
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
              {cat.notes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          </div>
        ))}
        {catViewList.length === 0 && (
          <div style={{ padding: "50px 0", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            {query.trim() ? "No matching categories" : "No categories yet"}
          </div>
        )}
      </div>
    </div>
  );
}
