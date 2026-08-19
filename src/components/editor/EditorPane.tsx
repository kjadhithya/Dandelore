"use client";
import React, { useEffect, useRef, useState } from "react";
import { useVaultStore, noteTags } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { LiveEditor } from "./LiveEditor";
import { ReadingView } from "./ReadingView";
import { CategoryDropdown } from "./CategoryDropdown";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { formatDate } from "@/lib/date";
import {
  EyeIcon,
  PlusIcon,
  MoreIcon,
  BacklinksIcon,
  SplitRightIcon,
  SplitDownIcon,
  BackIcon,
  ForwardIcon,
  BookmarkIcon,
} from "@/components/icons/Icons";
import type { Note } from "@/types/vault";

const iconBtnStyle: React.CSSProperties = {
  cursor: "pointer",
  width: 37,
  height: 37,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--muted)",
};

function IconBtn({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const isMobile = useIsMobile();
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...iconBtnStyle,
        ...(isMobile ? { width: 42, height: 42 } : {}),
        background: active || hover ? "var(--active)" : "transparent",
        color: active || hover ? "var(--ink)" : "var(--muted)",
      }}
    >
      {children}
    </div>
  );
}

interface Side {
  canBack: boolean;
  canForward: boolean;
  goBack: () => void;
  goForward: () => void;
  reading: boolean;
  toggleReading: () => void;
  metaOpen: boolean;
  openMeta: () => void;
  closeMeta: () => void;
  noteMenuOpen: boolean;
  noteMenuMove: boolean;
  toggleNoteMenu: () => void;
  menuMoveStart: () => void;
  menuMoveTo: (folder: string) => void;
  menuDuplicate: () => void;
  menuExportNote: () => void;
  menuDelete: () => void;
  menuAttach?: () => void;
  showBacklinks: boolean;
  toggleBacklinks: () => void;
  showSplitButtons: boolean;
  splitRight?: () => void;
  splitDown?: () => void;
  onTitle: (v: string) => void;
  onTitleCommit: (oldTitle: string) => void;
  categoryVal: string;
  onCategorySelect: (v: string) => void;
  tagChips: { name: string; onRemove: () => void; onSearch?: () => void }[];
  tagDraft: string;
  onTagDraft: (v: string) => void;
  onTagKey: (key: string, draft: string) => void;
  dateVal: string;
  onDate: (v: string) => void;
}

/** A plain <input> can never wrap — long titles just scroll sideways
 * within it instead of flowing onto a second line. An auto-growing
 * textarea reads and behaves like the same single title field but wraps
 * like the heading it's styled as. Enter blurs rather than inserting a
 * newline, matching how a title field is expected to behave. */
function TitleField({ value, onChange, onCommit }: { value: string; onChange: (v: string) => void; onCommit: (oldTitle: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Captured on focus, used on blur to know what the title was before this
  // edit session — onCommit rewrites [[OldTitle]] references just once,
  // comparing start-of-session to final value, rather than on every
  // keystroke onChange already fires (which would rewrite references to
  // each half-typed intermediate title instead of the finished one).
  const startRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => {
        startRef.current = value;
      }}
      onBlur={() => onCommit(startRef.current)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      placeholder="Untitled"
      rows={1}
      style={{
        border: "none",
        background: "transparent",
        fontFamily: "var(--font-title, var(--font-spectral))",
        fontWeight: 600,
        fontSize: 31,
        color: "var(--ink)",
        width: "100%",
        marginBottom: 8,
        lineHeight: 1.15,
        resize: "none",
        overflow: "hidden",
        display: "block",
      }}
    />
  );
}

/** Free-text tag input with a dropdown of existing tags that match what's
 * typed so far (excluding tags already on this note) — lets you reuse a tag
 * instead of retyping it and risking a near-duplicate. */
function TagsField({
  tags,
  tagDraft,
  onTagDraft,
  onTagKey,
  allTags,
}: {
  tags: { name: string; onRemove: () => void }[];
  tagDraft: string;
  onTagDraft: (v: string) => void;
  onTagKey: (key: string, draft: string) => void;
  allTags: string[];
}) {
  const { accentText } = useDerivedTheme();
  const [focused, setFocused] = useState(false);
  const applied = new Set(tags.map((t) => t.name));
  const filtered = allTags
    .filter((t) => !applied.has(t))
    .filter((t) => !tagDraft || t.toLowerCase().includes(tagDraft.toLowerCase()))
    .slice(0, 8);
  const showDropdown = focused && filtered.length > 0;

  function pick(name: string) {
    onTagKey("Enter", name);
    onTagDraft("");
  }

  // Mobile virtual keyboards are inconsistent about how they signal their
  // Enter/Go/Done key was pressed on a single-line input — a real keydown
  // with key "Enter" on some, a plain input event on others (with
  // inputType "insertLineBreak", or "insertText" carrying the newline as
  // its data — a single-line <input> strips "\n" from .value before any
  // handler sees it, so that can't be checked directly), and a few submit
  // the enclosing <form> without any of the above. All three are wired up
  // below, plus a tap target that needs no keyboard-event guessing at all
  // as the guaranteed fallback.
  function commitDraft() {
    if (tagDraft.trim()) {
      onTagKey("Enter", tagDraft);
      onTagDraft("");
    }
  }

  return (
    <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          border: "1px solid var(--border)",
          background: "var(--input)",
          borderRadius: 8,
          padding: "5px 8px",
        }}
      >
        {tags.map((tc) => (
          <span
            key={tc.name}
            style={{ display: "flex", alignItems: "center", gap: 5, color: accentText, fontFamily: "var(--font-ibm-plex-mono)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 5px 2px 8px", fontSize: 12.5 }}
          >
            #{tc.name}
            <span onClick={tc.onRemove} style={{ cursor: "pointer", color: "var(--faint)" }}>
              ×
            </span>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitDraft();
          }}
          style={{ display: "contents" }}
        >
          <input
            value={tagDraft}
            onChange={(e) => {
              const native = e.nativeEvent as InputEvent;
              if (native.inputType === "insertLineBreak" || native.data?.includes("\n")) {
                commitDraft();
                return;
              }
              onTagDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            placeholder={tags.length ? "Add tag…" : "+ tag"}
            style={{ flex: 1, minWidth: 70, border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--ink)", fontFamily: "var(--font-ibm-plex-mono)", padding: "2px 2px" }}
          />
        </form>
        {tagDraft.trim() && (
          <span
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitDraft}
            title="Add tag"
            style={{
              flex: "0 0 auto",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: accentText,
              color: "var(--input)",
              fontSize: 14,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            +
          </span>
        )}
      </div>
      {showDropdown && (
        <div
          className="vscroll"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 14px 32px -10px rgba(0,0,0,.4)",
            zIndex: 10,
            maxHeight: 180,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {filtered.map((t) => (
            <div
              key={t}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(t)}
              style={{ padding: "6px 9px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer", borderRadius: 5, fontFamily: "var(--font-ibm-plex-mono)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--active)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              #{t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorPane({ note, side }: { note: Note; side: Side }) {
  const { accentText, accent, accentButtonText } = useDerivedTheme();
  const openConfirm = useVaultStore((s) => s.openConfirm);
  const allTagsFn = useVaultStore((s) => s.allTags);
  const toggleBookmark = useVaultStore((s) => s.toggleBookmark);
  const goCategory = useVaultStore((s) => s.goCategory);

  const hasCat = !!note.category;
  const tags = side.tagChips;
  const hasDate = !!note.date;
  const chipsVisible = !side.metaOpen && (hasCat || tags.length > 0 || hasDate);

  const noteMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!side.noteMenuOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (noteMenuRef.current && !noteMenuRef.current.contains(e.target as Node)) side.toggleNoteMenu();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [side.noteMenuOpen, side.toggleNoteMenu]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: "0 0 auto", padding: "7px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 2 }}>
        <div
          onClick={side.canBack ? side.goBack : undefined}
          title="Back"
          style={{ width: 37, height: 37, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", ...(side.canBack ? { cursor: "pointer", color: "var(--muted)" } : { color: "var(--border)", pointerEvents: "none" }) }}
        >
          <BackIcon size={20} />
        </div>
        <div
          onClick={side.canForward ? side.goForward : undefined}
          title="Forward"
          style={{ width: 37, height: 37, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", ...(side.canForward ? { cursor: "pointer", color: "var(--muted)" } : { color: "var(--border)", pointerEvents: "none" }) }}
        >
          <ForwardIcon size={20} />
        </div>
        <div style={{ flex: 1 }} />
        <IconBtn title={side.reading ? "Edit" : "Reading view"} onClick={side.toggleReading}>
          <EyeIcon on={side.reading} size={20} />
        </IconBtn>
        <IconBtn title="Add property" onClick={side.openMeta}>
          <PlusIcon size={20} />
        </IconBtn>
        <div ref={noteMenuRef} style={{ position: "relative", flex: "0 0 auto" }}>
          <IconBtn title="More" onClick={side.toggleNoteMenu}>
            <MoreIcon size={20} />
          </IconBtn>
          {side.noteMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: 36,
                right: 0,
                zIndex: 40,
                minWidth: 200,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
                padding: 5,
              }}
            >
              {!side.noteMenuMove ? (
                <div>
                  <MenuItem
                    onClick={() => {
                      toggleBookmark(note.id);
                      side.toggleNoteMenu();
                    }}
                    icon={<BookmarkIcon size={15} filled={note.bookmarked} />}
                  >
                    {note.bookmarked ? "Remove bookmark" : "Bookmark note"}
                  </MenuItem>
                  <MenuItem onClick={side.menuDuplicate}>Duplicate</MenuItem>
                  <MenuItem onClick={side.menuMoveStart}>
                    <span style={{ flex: 1 }}>Move file to…</span>
                    <span style={{ color: "var(--faint)" }}>›</span>
                  </MenuItem>
                  <Divider />
                  {side.showSplitButtons && (
                    <>
                      <MenuItem onClick={side.splitRight!} icon={<SplitRightIcon />}>
                        Split right
                      </MenuItem>
                      <MenuItem onClick={side.splitDown!} icon={<SplitDownIcon />}>
                        Split down
                      </MenuItem>
                      <Divider />
                    </>
                  )}
                  {side.menuAttach && <MenuItem onClick={side.menuAttach}>Attach file…</MenuItem>}
                  <MenuItem onClick={side.menuExportNote}>Export note (.md)</MenuItem>
                  <Divider />
                  <div
                    onClick={() => {
                      side.toggleNoteMenu();
                      openConfirm({
                        title: "Delete note?",
                        message: `"${note.title || "Untitled"}" will be permanently deleted. This can't be undone.`,
                        confirmLabel: "Delete",
                        onConfirm: side.menuDelete,
                      });
                    }}
                    style={{ padding: "8px 13px", fontSize: 13, color: "#c15a3d", cursor: "pointer", borderRadius: 6 }}
                  >
                    Delete note
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ padding: "6px 13px 4px", fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)" }}>
                    Move to folder
                  </div>
                  {[...useVaultStore.getState().folderList, "(no folder)"].map((f) => (
                    <MenuItem key={f} onClick={() => side.menuMoveTo(f === "(no folder)" ? "" : f)}>
                      {f}
                    </MenuItem>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <IconBtn title="Toggle backlinks" active={side.showBacklinks} onClick={side.toggleBacklinks}>
          <BacklinksIcon size={20} />
        </IconBtn>
      </div>
      <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 30px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <TitleField value={note.title} onChange={side.onTitle} onCommit={side.onTitleCommit} />
          {side.metaOpen ? (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 74, color: "var(--faint)", fontSize: 12, flex: "0 0 auto" }}>Category</span>
                <CategoryDropdown value={side.categoryVal} onSelect={side.onCategorySelect} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 74, color: "var(--faint)", fontSize: 12, flex: "0 0 auto", paddingTop: 5 }}>Tags</span>
                <TagsField tags={tags} tagDraft={side.tagDraft} onTagDraft={side.onTagDraft} onTagKey={side.onTagKey} allTags={allTagsFn()} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 74, color: "var(--faint)", fontSize: 12, flex: "0 0 auto" }}>Created</span>
                <label
                  style={{
                    position: "relative",
                    display: "inline-block",
                    border: "1px solid var(--border)",
                    background: "var(--input)",
                    color: side.dateVal ? "var(--ink)" : "var(--faint)",
                    borderRadius: 7,
                    padding: "4px 9px",
                    fontSize: 12.5,
                    fontFamily: "var(--font-ibm-plex-mono)",
                    cursor: "pointer",
                  }}
                >
                  {side.dateVal ? formatDate(side.dateVal) : "Set date"}
                  <input
                    type="date"
                    className="date-themed"
                    value={side.dateVal}
                    onChange={(e) => side.onDate(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  />
                </label>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  onClick={side.closeMeta}
                  style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: accentButtonText, background: accent, borderRadius: 7, padding: "6px 16px", display: "inline-block" }}
                >
                  Done
                </span>
              </div>
            </div>
          ) : null}
          {chipsVisible && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, fontSize: 12 }}>
              {hasCat && (
                <span
                  onClick={() => goCategory(note.category)}
                  style={{ cursor: "pointer", background: "var(--code)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 11px", color: "var(--text)" }}
                >
                  {note.category}
                </span>
              )}
              {tags.map((tc) => (
                <span
                  key={tc.name}
                  onClick={tc.onSearch}
                  style={{ cursor: "pointer", color: accentText, fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  #{tc.name}
                </span>
              ))}
              {hasDate && <span style={{ color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)" }}>◷ {formatDate(note.date)}</span>}
              <span onClick={side.openMeta} style={{ cursor: "pointer", color: "var(--faint)", fontSize: 12 }}>
                edit
              </span>
            </div>
          )}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--border-soft)" }}>
            <div style={{ position: "relative" }}>{side.reading ? <ReadingView note={note} /> : <LiveEditor note={note} />}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ onClick, children, icon }: { onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: icon ? 9 : 0, padding: "8px 13px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6, background: hover ? "var(--active)" : "transparent" }}
    >
      {icon}
      {children}
    </div>
  );
}
function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "5px 8px" }} />;
}

export function useMainSide(): Side {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const cur = s.cur();
  const tab = s.tabs[s.active];
  return {
    canBack: !!(tab && tab.hi > 0),
    canForward: !!(tab && tab.hi < tab.hist.length - 1),
    goBack: s.goBack,
    goForward: s.goForward,
    reading: s.reading,
    toggleReading: s.toggleReading,
    metaOpen: s.metaOpen,
    openMeta: s.openMeta,
    closeMeta: s.closeMeta,
    noteMenuOpen: s.noteMenuOpen,
    noteMenuMove: s.noteMenuMove,
    toggleNoteMenu: s.toggleNoteMenu,
    menuMoveStart: s.menuMoveStart,
    menuMoveTo: s.menuMoveTo,
    menuDuplicate: s.menuDuplicate,
    menuExportNote: s.exportNote,
    menuDelete: s.deleteCurrent,
    menuAttach: () => document.getElementById("attachInput")?.click(),
    showBacklinks: s.showRight && s.lastPane === "main",
    toggleBacklinks: s.toggleRightMain,
    showSplitButtons: !isMobile,
    splitRight: () => s.splitOpen("right"),
    splitDown: () => s.splitOpen("down"),
    onTitle: s.onTitle,
    onTitleCommit: (oldTitle) => {
      const id = s.curId();
      if (id) s.commitTitleRename(id, oldTitle);
    },
    categoryVal: cur?.category || "",
    onCategorySelect: s.setCategory,
    tagChips: (cur?.tags || []).map((name) => ({ name, onRemove: () => s.removeNoteTag(cur!.id, name), onSearch: () => s.openSearch("tag:" + name) })),
    tagDraft: s.tagDraft,
    onTagDraft: s.onTagDraft,
    onTagKey: (key, draft) => {
      if (key === "Enter") s.addTag(draft);
    },
    dateVal: cur?.date || "",
    onDate: s.onDate,
  };
}

export function useSplitSide(): Side {
  const s = useVaultStore();
  const id = s.splitCurId();
  const n = id ? s.notes.find((x) => x.id === id) : undefined;
  const tab = s.split?.tabs[s.split.active];
  return {
    canBack: !!(tab && tab.hi > 0),
    canForward: !!(tab && tab.hi < tab.hist.length - 1),
    goBack: s.splitBack,
    goForward: s.splitForward,
    reading: s.splitReading,
    toggleReading: s.toggleSplitReading,
    metaOpen: s.splitMetaOpen,
    openMeta: s.splitOpenMeta,
    closeMeta: s.splitCloseMeta,
    noteMenuOpen: s.splitNoteMenuOpen,
    noteMenuMove: s.splitNoteMenuMove,
    toggleNoteMenu: s.splitToggleNoteMenu,
    menuMoveStart: s.splitMenuMoveStart,
    menuMoveTo: s.splitMenuMoveTo,
    menuDuplicate: s.splitMenuDuplicate,
    menuExportNote: s.splitMenuExportNote,
    menuDelete: s.splitMenuDelete,
    showBacklinks: s.showRight && s.lastPane === "split",
    toggleBacklinks: s.toggleRightSplit,
    showSplitButtons: false,
    onTitle: s.onSplitTitle,
    onTitleCommit: (oldTitle) => {
      const id = s.splitCurId();
      if (id) s.commitTitleRename(id, oldTitle);
    },
    categoryVal: n?.category || "",
    onCategorySelect: s.onSplitCategorySelect,
    tagChips: (n?.tags || []).map((name) => ({ name, onRemove: () => s.splitRemoveTag(n!.id, name) })),
    tagDraft: s.splitTagDraft,
    onTagDraft: s.splitOnTagDraft,
    onTagKey: (key, draft) => {
      if (key === "Enter") s.splitAddTag(draft.replace(/^#/, "").trim());
    },
    dateVal: n?.date || "",
    onDate: s.splitOnDate,
  };
}

export { noteTags };
