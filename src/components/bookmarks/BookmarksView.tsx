"use client";
import React, { useState } from "react";
import { useVaultStore, sortNotes } from "@/lib/store/useVaultStore";
import { BookmarkIcon } from "@/components/icons/Icons";

export function BookmarksView() {
  const s = useVaultStore();
  const notes = sortNotes(
    s.notes.filter((n) => n.bookmarked),
    s.sort,
  );

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
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title || "Untitled"}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{note.category || note.folder || "—"}</div>
      </div>
    );
  }

  return (
    <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 22px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 22, color: "var(--ink)", marginBottom: 18 }}>Bookmarks</div>
        {notes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "60px 0", color: "var(--muted)" }}>
            <BookmarkIcon size={30} />
            <span style={{ fontSize: 13.5 }}>No bookmarked notes yet</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
