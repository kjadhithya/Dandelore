"use client";
import React, { useMemo, useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { CategoriesIcon } from "@/components/icons/Icons";

export function CategoriesView() {
  const s = useVaultStore();
  const [newCat, setNewCat] = useState("");

  const catViewList = useMemo(
    () =>
      s.categories.map((c) => ({
        name: c,
        notes: sortNotes(s.notes.filter((n) => n.category === c), s.sort),
      })),
    [s.categories, s.notes, s.sort],
  );
  const uncatNotes = useMemo(() => sortNotes(s.notes.filter((n) => !n.category), s.sort), [s.notes, s.sort]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-spectral)", fontWeight: 600, fontSize: 22, color: "var(--ink)", flex: 1 }}>Categories</div>
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
            style={{ border: "1px solid var(--border)", background: "var(--input)", borderRadius: 8, padding: "7px 11px", fontSize: 13, color: "var(--ink)", fontFamily: "inherit", width: 180 }}
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
                style={{ border: "1px solid var(--accent, #b0623b)", background: "var(--input)", borderRadius: 7, padding: "5px 10px", fontSize: 15, color: "var(--ink)", fontFamily: "var(--font-spectral)", fontWeight: 600, marginBottom: 6 }}
              />
            ) : (
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                s.onCatContext(cat.name, e.clientX, e.clientY);
              }}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 2px 8px", borderBottom: "1px solid var(--border-soft)", marginBottom: 8, cursor: "context-menu" }}
            >
              <CategoriesIcon size={15} />
              <span style={{ fontFamily: "var(--font-spectral)", fontWeight: 600, fontSize: 15.5, color: "var(--ink)", flex: 1 }}>{cat.name}</span>
              <span style={{ fontSize: 11, color: "#fff", background: "var(--faint)", borderRadius: 20, padding: "1px 8px" }}>{cat.notes.length}</span>
            </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
              {cat.notes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          </div>
        ))}
        {uncatNotes.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--faint)", padding: "4px 2px 8px", borderBottom: "1px solid var(--border-soft)", marginBottom: 8 }}>
              Uncategorized
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
              {uncatNotes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
