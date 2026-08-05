"use client";
import React, { useMemo } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";

interface Cmd {
  glyph: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const s = useVaultStore();
  if (!s.cmdOpen) return null;

  const allCmds: Cmd[] = [
    { glyph: "+", label: "New note", run: () => s.newNote() },
    { glyph: "⌕", label: "Quick switcher", hint: "⌘O", run: () => s.toggleQuick() },
    {
      glyph: "⌕",
      label: "Search notes",
      run: () => {
        useVaultStore.setState({ sideMode: "search", leftOpen: true });
        setTimeout(() => document.getElementById("sidebarSearch")?.focus(), 0);
      },
    },
    { glyph: "◉", label: "Graph view", run: () => s.goGraph() },
    { glyph: "▦", label: "Journal", run: () => s.goJournal() },
    { glyph: "☼", label: "Today's daily note", run: () => s.openOrCreate(new Date().toISOString().slice(0, 10), "Journal") },
    { glyph: "⚙", label: "Settings", run: () => s.openSettings() },
    { glyph: "⇊", label: "Import Markdown", run: () => document.getElementById("importInput")?.click() },
    { glyph: "⇈", label: "Export vault (JSON)", run: () => s.exportJson() },
    { glyph: "⎘", label: "Attach file", run: () => document.getElementById("attachInput")?.click() },
    { glyph: "👁", label: "Toggle reading view", run: () => s.toggleReading() },
    {
      glyph: "🗑",
      label: "Delete note",
      run: () => {
        const note = s.cur();
        if (!note) return;
        s.openConfirm({
          title: "Delete note?",
          message: `"${note.title || "Untitled"}" will be permanently deleted. This can't be undone.`,
          confirmLabel: "Delete",
          onConfirm: () => s.deleteCurrent(),
        });
      },
    },
    {
      glyph: "▤",
      label: "New folder",
      run: () => {
        useVaultStore.setState({ leftOpen: true });
        s.newFolder();
      },
    },
  ];

  const cq = s.cmdQuery.trim().toLowerCase();
  const commands = allCmds.filter((c) => !cq || c.label.toLowerCase().includes(cq));

  return (
    <div
      onClick={() => s.closeCmd()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "13vh", zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: "90vw", background: "var(--bg)", borderRadius: 13, boxShadow: "0 30px 70px -18px rgba(0,0,0,.5)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 18px", borderBottom: "1px solid var(--border-soft)" }}>
          <span style={{ fontFamily: "var(--font-ibm-plex-mono)", color: "var(--accent, #b0623b)", fontSize: 16 }}>⌘</span>
          <input
            autoFocus
            value={s.cmdQuery}
            onChange={(e) => s.onCmd(e.target.value)}
            placeholder="Type a command…"
            style={{ border: "none", background: "transparent", fontSize: 16, color: "var(--ink)", width: "100%", fontFamily: "var(--font-title, var(--font-spectral))" }}
          />
        </div>
        <div className="vscroll" style={{ maxHeight: 360, overflowY: "auto", padding: 7 }}>
          {commands.map((c) => (
            <div
              key={c.label}
              onClick={() => {
                s.closeCmd();
                c.run();
              }}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-ibm-plex-mono)", flex: "0 0 auto" }}>
                {c.glyph}
              </span>
              <span style={{ fontSize: 13.5, color: "var(--ink)", flex: 1 }}>{c.label}</span>
              <span style={{ fontSize: 10.5, color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)" }}>{c.hint}</span>
            </div>
          ))}
          {commands.length === 0 && <div style={{ padding: 18, textAlign: "center", fontSize: 13, color: "var(--faint)" }}>No matching command.</div>}
        </div>
      </div>
    </div>
  );
}
