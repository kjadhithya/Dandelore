"use client";
import React, { useMemo, useState } from "react";
import { useVaultStore, noteTags } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { buildFolderRows, rootNotes as computeRootNotes } from "@/lib/sidebarModel";
import {
  NewNoteIcon,
  NewFolderIcon,
  SearchIcon,
  SortIcon,
  RevealIcon,
  CollapseAllIcon,
  ChevronRightIcon,
  GripIcon,
} from "@/components/icons/Icons";
import type { Note } from "@/types/vault";

const SORT_DEFS: [string, string][] = [
  ["name-az", "File name (A to Z)"],
  ["name-za", "File name (Z to A)"],
  ["DIV", ""],
  ["mod-new", "Modified time (new to old)"],
  ["mod-old", "Modified time (old to new)"],
  ["DIV2", ""],
  ["created-new", "Created time (new to old)"],
  ["created-old", "Created time (old to new)"],
];

const SEARCH_OPTIONS: [string, string][] = [
  ["path:", "match path of the file"],
  ["file:", "match file name"],
  ["tag:", "search for tags"],
  ["category:", "search by category"],
  ["line:", "keywords on same line"],
  ["section:", "keywords under same heading"],
];

function toolBtnStyle(active: boolean, hover: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    cursor: "pointer",
    color: active || hover ? "var(--ink)" : "var(--muted)",
    background: active || hover ? "var(--ribbon)" : "transparent",
  };
}

function ToolButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={toolBtnStyle(!!active, hover)}
    >
      {children}
    </div>
  );
}

function snippetOf(n: Note): string {
  const line = n.content.split("\n").find((l) => l.trim()) || n.content;
  return line.replace(/[#*`>[\]]/g, "").trim().slice(0, 80) || n.folder;
}

export function Sidebar() {
  const s = useVaultStore();
  const { accent, accentText } = useDerivedTheme();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const folderRows = useMemo(
    () => buildFolderRows(s.folderList, s.folderParents, s.notes, s.expanded, s.sort),
    [s.folderList, s.folderParents, s.notes, s.expanded, s.sort],
  );
  const rNotes = useMemo(
    () => computeRootNotes(s.notes, s.folderList, s.sort),
    [s.notes, s.folderList, s.sort],
  );
  const visibleOrder = useMemo(
    () => [...folderRows.flatMap((r) => r.notes.map((n) => n.id)), ...rNotes.map((n) => n.id)],
    [folderRows, rNotes],
  );

  const curId = s.curId();

  function noteDot(id: string) {
    if (s.selectedIds.includes(id)) return accentText;
    if (id === curId) return accentText;
    return "var(--edge)";
  }

  function handleRowClick(e: React.MouseEvent, id: string) {
    s.rowClick(id, { meta: e.metaKey || e.ctrlKey, shift: e.shiftKey }, visibleOrder);
  }

  function NoteRow({ note }: { note: Note }) {
    const [hover, setHover] = useState(false);
    const isRenaming = s.renaming === note.id;
    if (isRenaming) {
      return (
        <div style={{ padding: "2px 9px" }}>
          <input
            autoFocus
            value={note.title}
            onChange={(e) => s.onRenameLive(note.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              else if (e.key === "Escape") s.stopRename();
            }}
            onBlur={() => s.stopRename()}
            style={{
              width: "100%",
              border: "1px solid var(--accent, #b0623b)",
              background: "var(--input)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 13,
              color: "var(--ink)",
            }}
          />
        </div>
      );
    }
    return (
      <div
        draggable
        onDragStart={() => s.setDraggingId(note.id)}
        onClick={(e) => handleRowClick(e, note.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          s.onNoteContext(note.id, e.clientX, e.clientY);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 9px",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
          color: note.id === curId ? "var(--ink)" : "var(--text)",
          background: s.selectedIds.includes(note.id) ? "var(--active)" : hover ? "var(--ribbon)" : "transparent",
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: noteDot(note.id), flex: "0 0 auto" }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{note.title || "Untitled"}</span>
      </div>
    );
  }

  function FolderHeader({ name, depth, count, open }: { name: string; depth: number; count: number; open: boolean }) {
    const [hover, setHover] = useState(false);
    const isRenaming = s.folderRenaming === name;
    const isDragOver = s.dragOverFolder === name;
    if (isRenaming) {
      return (
        <div style={{ padding: `2px ${9 + depth * 13}px 2px ${8 + depth * 13}px` }}>
          <input
            autoFocus
            value={s.folderRenameDraft}
            onChange={(e) => s.onFolderRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") s.commitFolderRename(name, s.folderRenameDraft);
              else if (e.key === "Escape") s.startFolderRename(name);
            }}
            onBlur={() => s.commitFolderRename(name, s.folderRenameDraft)}
            style={{
              width: "100%",
              border: "1px solid var(--accent, #b0623b)",
              background: "var(--input)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "var(--ink)",
            }}
          />
        </div>
      );
    }
    return (
      <div
        draggable
        onDragStart={() => s.setDraggingFolder(name)}
        onDragOver={(e) => {
          e.preventDefault();
          s.setDragOverFolder(name);
        }}
        onDragLeave={() => {
          if (s.dragOverFolder === name) s.setDragOverFolder(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (s.draggingFolder) s.reparentFolder(s.draggingFolder, name);
          else if (s.draggingId) s.moveNoteTo(s.draggingId, name);
        }}
        onClick={() => s.toggleFolder(name)}
        onContextMenu={(e) => {
          e.preventDefault();
          s.onFolderContext(name, e.clientX, e.clientY);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: `6px ${9 + depth * 13}px 6px ${8 + depth * 13}px`,
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--text)",
          background: isDragOver ? "var(--active)" : hover ? "var(--ribbon)" : "transparent",
          boxShadow: isDragOver ? `inset 0 0 0 1px ${accent}` : "none",
        }}
      >
        <ChevronRightIcon size={10} style={{ transform: open ? "rotate(90deg)" : "none", flex: "0 0 auto", transition: "transform .1s" }} />
        <span style={{ flex: 1 }}>{name}</span>
        <span style={{ fontSize: 10, color: "var(--faint)", fontWeight: 500 }}>{count}</span>
      </div>
    );
  }

  const hasSearchText = s.searchQuery.trim() !== "";
  const searchResults = useMemo(() => {
    const rawq = s.searchQuery.trim();
    if (!rawq) return [];
    let mode = "text";
    let term = rawq.toLowerCase();
    const pre = rawq.match(/^(tag|file|path|line|section|cat|category)\s*:/i);
    if (pre) {
      mode = pre[1].toLowerCase();
      if (mode === "category") mode = "cat";
      term = rawq.slice(pre[0].length).trim().toLowerCase();
    }
    let matched = s.notes.filter((n) => {
      if (!term) return true;
      if (mode === "tag") return noteTags(n).some((t) => t.toLowerCase().includes(term));
      if (mode === "cat") return (n.category || "").toLowerCase().includes(term);
      if (mode === "file") return n.title.toLowerCase().includes(term);
      if (mode === "path") return (n.folder + "/" + n.title).toLowerCase().includes(term);
      if (mode === "line") return n.content.toLowerCase().split("\n").some((l) => l.includes(term));
      if (mode === "section")
        return n.content.split("\n").some((l) => /^#{1,6}\s/.test(l) && l.toLowerCase().includes(term));
      return n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term);
    });
    matched = [...matched].sort((a, b) => a.title.localeCompare(b.title));
    return matched.map((n) => {
      let snip: string;
      if (mode === "tag") snip = "tags: " + noteTags(n).join(" ");
      else if (mode === "cat") snip = "category: " + (n.category || "—");
      else if (mode === "path" || mode === "file") snip = "in " + n.folder;
      else {
        const line = (n.content.split("\n").find((l) => l.toLowerCase().includes(term)) || n.content)
          .replace(/[#*`>[\]]/g, "")
          .trim();
        snip = line.slice(0, 80) || n.folder;
      }
      return { note: n, snippet: snip };
    });
  }, [s.searchQuery, s.notes]);

  return (
    <>
      <div style={{ width: s.leftWidth, flex: "0 0 auto", background: "var(--panel)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "10px 10px 8px" }}>
          <ToolButton title="New note" onClick={() => s.newNote()}>
            <NewNoteIcon />
          </ToolButton>
          <ToolButton title="New folder" onClick={() => s.newFolder()}>
            <NewFolderIcon />
          </ToolButton>
          <ToolButton title="Search" active={s.sideMode === "search"} onClick={() => s.toggleSearchMode()}>
            <SearchIcon />
          </ToolButton>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <ToolButton title="Sort" onClick={() => setSortMenuOpen((v) => !v)}>
              <SortIcon />
            </ToolButton>
            {sortMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: 32,
                  right: 0,
                  zIndex: 30,
                  minWidth: 220,
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 16px 40px -12px rgba(25,20,12,.5)",
                  padding: 5,
                }}
                onMouseLeave={() => setSortMenuOpen(false)}
              >
                {SORT_DEFS.map(([key, label], i) =>
                  key.startsWith("DIV") ? (
                    <div key={key + i} style={{ height: 1, background: "var(--border)", margin: "5px 8px" }} />
                  ) : (
                    <div
                      key={key}
                      onClick={() => {
                        s.setSort(key as never);
                        setSortMenuOpen(false);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer", borderRadius: 6 }}
                    >
                      <span style={{ width: 12, color: accent }}>{s.sort === key ? "✓" : ""}</span>
                      {label}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
          <ToolButton title="Auto-reveal current file" active={s.autoReveal} onClick={() => s.toggleReveal()}>
            <RevealIcon />
          </ToolButton>
          <ToolButton title="Collapse / expand all" onClick={() => s.toggleAllFolders()}>
            <CollapseAllIcon />
          </ToolButton>
        </div>

        {s.sideMode === "search" ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
            <div style={{ padding: "0 12px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--input)", border: `1px solid ${accent}`, borderRadius: 9, padding: "7px 10px" }}>
                <SearchIcon size={14} />
                <input
                  id="sidebarSearch"
                  autoFocus
                  value={s.searchQuery}
                  onChange={(e) => s.onSearchQuery(e.target.value)}
                  onKeyDown={(e) => s.onSearchKey(e.key)}
                  placeholder="Search..."
                  style={{ border: "none", background: "transparent", fontSize: 13, color: "var(--ink)", width: "100%", fontFamily: "inherit" }}
                />
                {hasSearchText && (
                  <div onClick={() => s.clearSearch()} title="Clear" style={{ flex: "0 0 auto", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", cursor: "pointer", color: "var(--faint)" }}>
                    ×
                  </div>
                )}
              </div>
            </div>
            {!hasSearchText ? (
              <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", padding: "2px 6px 6px" }}>
                  Search options
                </div>
                {SEARCH_OPTIONS.map(([prefix, desc]) => (
                  <div
                    key={prefix}
                    onClick={() => s.onSearchQuery(prefix)}
                    style={{ padding: "7px 8px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "var(--text)" }}
                  >
                    <span style={{ color: "var(--ink)", fontWeight: 600, fontFamily: "var(--font-ibm-plex-mono)" }}>{prefix}</span> {desc}
                  </div>
                ))}
                {s.searchHistory.length > 0 && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", marginTop: 12, padding: "2px 6px 6px" }}>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)" }}>History</span>
                      <span onClick={() => s.clearHistory()} style={{ cursor: "pointer", color: "var(--faint)", fontSize: 14 }}>
                        ×
                      </span>
                    </div>
                    {s.searchHistory.map((h) => (
                      <div
                        key={h}
                        onClick={() => s.openSearch(h)}
                        style={{ padding: "6px 8px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "var(--text)", fontFamily: "var(--font-ibm-plex-mono)" }}
                      >
                        {h}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 16px 8px" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>
                    {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 10px 14px" }}>
                  {searchResults.map(({ note, snippet }) => (
                    <div key={note.id} style={{ marginBottom: 10 }}>
                      <div
                        onClick={() => s.navigate(note.id)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px", cursor: "pointer", borderRadius: 6 }}
                      >
                        <span style={{ fontSize: 9, color: "var(--faint)" }}>▾</span>
                        <span style={{ fontFamily: "var(--font-spectral)", fontSize: 14, color: "var(--ink)", flex: 1 }}>{note.title}</span>
                      </div>
                      <div
                        onClick={() => s.navigate(note.id)}
                        style={{ cursor: "pointer", margin: "4px 6px 0 18px", background: "var(--bg)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 11px", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}
                      >
                        {snippet}
                      </div>
                    </div>
                  ))}
                  {searchResults.length === 0 && (
                    <div style={{ fontSize: 12.5, color: "var(--faint)", fontStyle: "italic", padding: "8px 6px" }}>No results.</div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 8px 14px" }}>
            {s.selectedIds.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 8px", padding: "6px 10px", background: "var(--panel)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>
                <span style={{ flex: 1 }}>{s.selectedIds.length} selected</span>
                <span onClick={() => s.clearSelection()} style={{ cursor: "pointer", color: "var(--faint)" }}>
                  Clear
                </span>
              </div>
            )}
            {folderRows.map((row) => (
              <div key={row.name}>
                <FolderHeader name={row.name} depth={row.depth} count={row.count} open={row.open} />
                {row.open && (
                  <div>
                    {row.notes.map((n) => (
                      <div key={n.id} style={{ paddingLeft: 18 + row.depth * 13 }}>
                        <NoteRow note={n} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                s.setRootDragOver(true);
              }}
              onDragLeave={() => s.setRootDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                s.setRootDragOver(false);
                if (s.draggingFolder) s.reparentFolder(s.draggingFolder, null);
                else if (s.draggingId) s.moveNoteTo(s.draggingId, "");
              }}
              style={{
                minHeight: 24,
                borderRadius: 8,
                boxShadow: s.rootDragOver ? `inset 0 0 0 1px ${accent}` : "none",
                background: s.rootDragOver ? "var(--active)" : "transparent",
              }}
            >
              {rNotes.map((n) => (
                <NoteRow key={n.id} note={n} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = s.leftWidth;
          const move = (ev: MouseEvent) => s.setLeftWidth(startW + (ev.clientX - startX));
          const up = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
          };
          document.addEventListener("mousemove", move);
          document.addEventListener("mouseup", up);
        }}
        onDoubleClick={() => s.toggleLeft()}
        className="resizer"
        title="Drag to resize"
        style={{ width: 1, flex: "0 0 auto", cursor: "col-resize", background: "var(--border)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span
          className="grip"
          style={{ position: "absolute", width: 13, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, background: "var(--panel)", boxShadow: "0 1px 4px rgba(40,32,20,.22)", color: "var(--muted)" }}
        >
          <GripIcon />
        </span>
      </div>
    </>
  );
}
