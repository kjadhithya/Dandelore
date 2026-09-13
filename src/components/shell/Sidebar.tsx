"use client";
import React, { useMemo, useRef, useState } from "react";
import { useVaultStore, noteTags } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
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

function toolBtnStyle(active: boolean, hover: boolean, size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
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
  const isMobile = useIsMobile();
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={toolBtnStyle(!!active, hover, isMobile ? 42 : 33)}
    >
      {children}
    </div>
  );
}

function snippetOf(n: Note): string {
  const line = n.content.split("\n").find((l) => l.trim()) || n.content;
  return line.replace(/[#*`>[\]]/g, "").trim().slice(0, 80) || n.folder;
}

// NoteRow and FolderHeader are declared here at module scope, not nested
// inside Sidebar(), so their component identity stays stable across
// re-renders. When they were nested, every Sidebar re-render (which
// happens on every keystroke while renaming, since the draft text lives
// in the store) created a brand-new function for React to diff against —
// React saw that as a different component type and remounted the row
// from scratch, including its <input>. The remounted input re-ran
// autoFocus (and, for the folder rename box, re-selected its text), so
// each keystroke landed in a freshly re-selected field and replaced the
// previous character instead of appending to it.
function NoteRow({
  note,
  onDragStart,
  onRowClick,
}: {
  note: Note;
  onDragStart: (e: React.MouseEvent, note: Note) => void;
  onRowClick: (e: React.MouseEvent, id: string) => void;
}) {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const curId = s.curId();
  const [hover, setHover] = useState(false);
  const renameStartRef = useRef(note.title);
  // While something is being dragged, the cursor still crosses rows and
  // fires mouseenter/mouseleave same as always — but the row-level hover
  // tint underneath the whole-folder drop highlight reads as a second,
  // conflicting highlight instead of the one deliberate "drop here" cue.
  const dragging = !!s.draggingId || !!s.draggingFolder;
  const isRenaming = s.renaming === note.id;
  if (isRenaming) {
    return (
      <div style={{ padding: "2px 9px" }}>
        <input
          autoFocus
          onFocus={(e) => {
            renameStartRef.current = note.title;
            e.target.select();
          }}
          value={note.title}
          onChange={(e) => s.onRenameLive(note.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            else if (e.key === "Escape") s.stopRename();
          }}
          onBlur={() => {
            s.commitTitleRename(note.id, renameStartRef.current);
            s.stopRename();
          }}
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
      onMouseDown={(e) => onDragStart(e, note)}
      onClick={(e) => onRowClick(e, note.id)}
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
        padding: isMobile ? "11px 9px" : "6px 9px",
        minHeight: isMobile ? 40 : undefined,
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: note.id === curId ? 600 : 400,
        color: note.id === curId ? "var(--ink)" : "var(--text)",
        // Without this, holding and moving the mouse to drag a row
        // highlights its text instead of dragging it.
        userSelect: "none",
        WebkitUserSelect: "none",
        background: s.selectedIds.includes(note.id)
          ? "var(--active)"
          : note.id === curId
            ? "var(--ribbon)"
            : hover && !dragging
              ? "var(--ribbon)"
              : "transparent",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{note.title || "Untitled"}</span>
    </div>
  );
}

function FolderHeader({
  name,
  depth,
  count,
  open,
  onDragStart,
}: {
  name: string;
  depth: number;
  count: number;
  open: boolean;
  onDragStart: (e: React.MouseEvent, name: string) => void;
}) {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const [hover, setHover] = useState(false);
  const dragging = !!s.draggingId || !!s.draggingFolder;
  const isRenaming = s.folderRenaming === name;
  if (isRenaming) {
    return (
      <div style={{ padding: `2px ${9 + depth * 13}px 2px ${8 + depth * 13}px` }}>
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
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
      onMouseDown={(e) => onDragStart(e, name)}
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
        padding: `${isMobile ? 11 : 6}px ${9 + depth * 13}px ${isMobile ? 11 : 6}px ${8 + depth * 13}px`,
        minHeight: isMobile ? 40 : undefined,
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        color: "var(--text)",
        userSelect: "none",
        WebkitUserSelect: "none",
        background: hover && !dragging ? "var(--ribbon)" : "transparent",
      }}
    >
      <ChevronRightIcon size={10} style={{ transform: open ? "rotate(90deg)" : "none", flex: "0 0 auto", transition: "transform .1s" }} />
      <span style={{ flex: 1 }}>{name}</span>
      <span style={{ fontSize: 10, color: "var(--faint)", fontWeight: 500 }}>{count}</span>
    </div>
  );
}

export function Sidebar() {
  const s = useVaultStore();
  const { accent } = useDerivedTheme();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // The dropdown used to anchor via right:0 off a wrapper sitting near the
  // *right* edge of the (often narrow) sidebar — with a 220px-wide menu and
  // not much room to its left, that pushed it past the left edge of the
  // window entirely on a narrow sidebar/viewport, clipping it. Measuring
  // the button and clamping into the visible viewport fixes that
  // regardless of how little room there is on either side.
  const sortBtnRef = useRef<HTMLDivElement | null>(null);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);
  const isMobile = useIsMobile();
  const closeIfMobile = () => {
    if (isMobile) s.toggleLeft();
  };

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

  // Native HTML5 drag-and-drop (draggable + dragstart/dragover/drop) turned
  // out to be unreliable for at least one real user on macOS Chrome with a
  // trackpad — dragstart simply never fired, even with dataTransfer set up
  // correctly and every OS/browser-level cause (extensions, trackpad
  // dragging setting, tablet mode) ruled out. That class of native-DnD +
  // trackpad incompatibility is common enough elsewhere on the web that
  // it's not worth chasing further; this reimplements drag-and-drop on
  // plain mouse events instead, which don't depend on the browser/OS
  // recognizing a "drag gesture" at all — just an ordinary click-hold-move.
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);

  function dropTargetAt(x: number, y: number): { folder: string | null; root: boolean } {
    const el = document.elementFromPoint(x, y);
    const folderEl = el?.closest("[data-drop-folder]") as HTMLElement | null;
    if (folderEl) return { folder: folderEl.getAttribute("data-drop-folder"), root: false };
    return { folder: null, root: !!el?.closest("[data-drop-root]") };
  }

  function startNoteDrag(e: React.MouseEvent, note: Note) {
    if (e.button !== 0) return;
    const startX = e.clientX,
      startY = e.clientY;
    let dragging = false;
    function onMove(ev: MouseEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragging = true;
        s.setDraggingId(note.id);
      }
      setGhost({ x: ev.clientX, y: ev.clientY, label: note.title || "Untitled" });
      const t = dropTargetAt(ev.clientX, ev.clientY);
      s.setDragOverFolder(t.folder);
    }
    function onUp(ev: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragging) {
        const t = dropTargetAt(ev.clientX, ev.clientY);
        if (t.folder) s.moveNoteTo(note.id, t.folder);
        else if (t.root) s.moveNoteTo(note.id, "");
        s.setDraggingId(null);
        s.setDragOverFolder(null);
        setGhost(null);
      }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startFolderDrag(e: React.MouseEvent, name: string) {
    if (e.button !== 0) return;
    const startX = e.clientX,
      startY = e.clientY;
    let dragging = false;
    function onMove(ev: MouseEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragging = true;
        s.setDraggingFolder(name);
      }
      setGhost({ x: ev.clientX, y: ev.clientY, label: name });
      const t = dropTargetAt(ev.clientX, ev.clientY);
      const target = t.folder && t.folder !== name ? t.folder : null;
      s.setDragOverFolder(target);
    }
    function onUp(ev: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragging) {
        const t = dropTargetAt(ev.clientX, ev.clientY);
        if (t.folder && t.folder !== name) s.reparentFolder(name, t.folder);
        else if (t.root) s.reparentFolder(name, null);
        s.setDraggingFolder(null);
        s.setDragOverFolder(null);
        setGhost(null);
      }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleRowClick(e: React.MouseEvent, id: string) {
    s.rowClick(id, { meta: e.metaKey || e.ctrlKey, shift: e.shiftKey }, visibleOrder);
    closeIfMobile();
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
      <div style={{ width: isMobile ? "100%" : s.leftWidth, height: isMobile ? "100%" : undefined, flex: "0 0 auto", background: "var(--panel)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "10px 10px 8px" }}>
          <ToolButton
            title="New note"
            onClick={() => {
              s.newNote();
              closeIfMobile();
            }}
          >
            <NewNoteIcon size={20} />
          </ToolButton>
          <ToolButton title="New folder" onClick={() => s.newFolder()}>
            <NewFolderIcon size={20} />
          </ToolButton>
          <ToolButton title="Search" active={s.sideMode === "search"} onClick={() => s.toggleSearchMode()}>
            <SearchIcon size={19} />
          </ToolButton>
          <div style={{ flex: 1 }} />
          <div ref={sortBtnRef} style={{ position: "relative" }}>
            <ToolButton
              title="Sort"
              onClick={() => {
                setSortMenuOpen((v) => {
                  const next = !v;
                  if (next && sortBtnRef.current) {
                    const r = sortBtnRef.current.getBoundingClientRect();
                    const MENU_W = 220;
                    const MARGIN = 8;
                    setSortMenuPos({
                      top: r.bottom + 4,
                      left: Math.min(Math.max(MARGIN, r.right - MENU_W), Math.max(MARGIN, window.innerWidth - MENU_W - MARGIN)),
                    });
                  }
                  return next;
                });
              }}
            >
              <SortIcon size={20} />
            </ToolButton>
            {sortMenuOpen && sortMenuPos && (
              <div
                style={{
                  position: "fixed",
                  top: sortMenuPos.top,
                  left: sortMenuPos.left,
                  zIndex: 30,
                  minWidth: 220,
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
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
            <RevealIcon size={20} />
          </ToolButton>
          <ToolButton title="Collapse / expand all" onClick={() => s.toggleAllFolders()}>
            <CollapseAllIcon size={20} />
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
                  style={{ border: "none", background: "transparent", fontSize: 13, color: "var(--ink)", flex: 1, minWidth: 0, fontFamily: "inherit" }}
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
                        onClick={() => {
                          s.navigate(note.id);
                          closeIfMobile();
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px", cursor: "pointer", borderRadius: 6, minHeight: isMobile ? 40 : undefined }}
                      >
                        <span style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontSize: 14, color: "var(--ink)", flex: 1, minWidth: 0, overflowWrap: "break-word" }}>{note.title}</span>
                      </div>
                      <div
                        onClick={() => {
                          s.navigate(note.id);
                          closeIfMobile();
                        }}
                        style={{ cursor: "pointer", margin: "4px 6px 0 18px", background: "var(--bg)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 11px", fontSize: 12, color: "var(--text)", lineHeight: 1.5, overflowWrap: "break-word", wordBreak: "break-word" }}
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
              <div
                key={row.name}
                data-drop-folder={row.name}
                style={{
                  borderRadius: 6,
                  background: s.dragOverFolder === row.name ? "var(--active)" : "transparent",
                  boxShadow: s.dragOverFolder === row.name ? `inset 0 0 0 1px ${accent}` : "none",
                }}
              >
                <FolderHeader name={row.name} depth={row.depth} count={row.count} open={row.open} onDragStart={startFolderDrag} />
                {row.open && (
                  <div>
                    {row.notes.map((n) => (
                      <div key={n.id} style={{ paddingLeft: 18 + row.depth * 13 }}>
                        <NoteRow note={n} onDragStart={startNoteDrag} onRowClick={handleRowClick} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div
              data-drop-root="1"
              style={{
                minHeight: 24,
                borderRadius: 8,
              }}
            >
              {rNotes.map((n) => (
                <NoteRow key={n.id} note={n} onDragStart={startNoteDrag} onRowClick={handleRowClick} />
              ))}
            </div>
          </div>
        )}
      </div>
      {!isMobile && (
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
      )}
      {ghost && (
        <div
          style={{
            position: "fixed",
            left: ghost.x + 14,
            top: ghost.y + 10,
            zIndex: 999,
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            background: "var(--panel)",
            border: `1px solid ${accent}`,
            borderRadius: 7,
            padding: "5px 10px",
            fontSize: 12.5,
            color: "var(--ink)",
            boxShadow: "0 6px 18px -4px rgba(0,0,0,.35)",
            pointerEvents: "none",
          }}
        >
          {ghost.label}
        </div>
      )}
    </>
  );
}
