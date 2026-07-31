"use client";
import React, { useState } from "react";
import { useVaultStore, noteTags } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { LiveEditor } from "./LiveEditor";
import { ReadingView } from "./ReadingView";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import {
  EyeIcon,
  PlusIcon,
  MoreIcon,
  BacklinksIcon,
  SplitRightIcon,
  SplitDownIcon,
} from "@/components/icons/Icons";
import type { Note } from "@/types/vault";

const iconBtnStyle: React.CSSProperties = {
  cursor: "pointer",
  width: 32,
  height: 32,
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
        ...(isMobile ? { width: 40, height: 40 } : {}),
        background: active || hover ? "var(--active)" : "transparent",
        color: active || hover ? "var(--ink)" : "var(--muted)",
      }}
    >
      {children}
    </div>
  );
}

interface Side {
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
  categoryVal: string;
  onCategorySelect: (v: string) => void;
  tagChips: { name: string; onRemove: () => void; onSearch?: () => void }[];
  tagDraft: string;
  onTagDraft: (v: string) => void;
  onTagKey: (key: string, draft: string) => void;
  dateVal: string;
  onDate: (v: string) => void;
}

export function EditorPane({ note, side }: { note: Note; side: Side }) {
  const { accentText, accent } = useDerivedTheme();
  const categories = useVaultStore((s) => s.categories);

  const hasCat = !!note.category;
  const tags = side.tagChips;
  const hasDate = !!note.date;
  const chipsVisible = !side.metaOpen && (hasCat || tags.length > 0 || hasDate);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: "0 0 auto", padding: "7px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 2 }}>
        <div style={{ flex: 1 }} />
        <IconBtn title={side.reading ? "Edit" : "Reading view"} onClick={side.toggleReading}>
          <EyeIcon on={side.reading} />
        </IconBtn>
        <IconBtn title="Add property" onClick={side.openMeta}>
          <PlusIcon />
        </IconBtn>
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <IconBtn title="More" onClick={side.toggleNoteMenu}>
            <MoreIcon />
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
                boxShadow: "0 16px 40px -12px rgba(25,20,12,.5)",
                padding: 5,
              }}
            >
              {!side.noteMenuMove ? (
                <div>
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
                  <div onClick={side.menuDelete} style={{ padding: "8px 13px", fontSize: 13, color: "#c15a3d", cursor: "pointer", borderRadius: 6 }}>
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
          <BacklinksIcon />
        </IconBtn>
      </div>
      <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 30px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <input
            value={note.title}
            onChange={(e) => side.onTitle(e.target.value)}
            placeholder="Untitled"
            style={{
              border: "none",
              background: "transparent",
              fontFamily: "var(--font-spectral)",
              fontWeight: 600,
              fontSize: 31,
              color: "var(--ink)",
              width: "100%",
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          />
          {side.metaOpen ? (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 74, color: "var(--faint)", fontSize: 12, flex: "0 0 auto" }}>Category</span>
                <select
                  value={side.categoryVal}
                  onChange={(e) => side.onCategorySelect(e.target.value)}
                  style={{ border: "1px solid var(--border)", background: "var(--input)", color: "var(--ink)", borderRadius: 7, padding: "5px 9px", fontSize: 12.5, fontFamily: "inherit", flex: 1 }}
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 74, color: "var(--faint)", fontSize: 12, flex: "0 0 auto", paddingTop: 5 }}>Tags</span>
                <div style={{ flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  {tags.map((tc) => (
                    <span
                      key={tc.name}
                      style={{ display: "flex", alignItems: "center", gap: 5, color: accentText, fontFamily: "var(--font-ibm-plex-mono)", background: "var(--code)", borderRadius: 6, padding: "2px 5px 2px 8px" }}
                    >
                      #{tc.name}
                      <span onClick={tc.onRemove} style={{ cursor: "pointer", color: "var(--faint)" }}>
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    value={side.tagDraft}
                    onChange={(e) => side.onTagDraft(e.target.value)}
                    onKeyDown={(e) => side.onTagKey(e.key, side.tagDraft)}
                    placeholder="+ tag"
                    style={{ width: 80, border: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", fontFamily: "var(--font-ibm-plex-mono)" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 74, color: "var(--faint)", fontSize: 12, flex: "0 0 auto" }}>Created</span>
                <input
                  type="date"
                  value={side.dateVal}
                  onChange={(e) => side.onDate(e.target.value)}
                  style={{ border: "1px solid var(--border)", background: "var(--input)", color: "var(--ink)", borderRadius: 7, padding: "4px 9px", fontSize: 12.5, fontFamily: "inherit" }}
                />
              </div>
              <div style={{ textAlign: "right" }}>
                <span onClick={side.closeMeta} style={{ cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
                  Done
                </span>
              </div>
            </div>
          ) : null}
          {chipsVisible && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 14 }}>
              {hasCat && (
                <span style={{ cursor: "pointer", background: "var(--code)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 11px", color: "var(--text)" }}>
                  {note.category}
                </span>
              )}
              {tags.map((tc) => (
                <span
                  key={tc.name}
                  onClick={tc.onSearch}
                  style={{ cursor: "pointer", color: accentText, fontFamily: "var(--font-ibm-plex-mono)", background: "var(--code)", borderRadius: 6, padding: "2px 8px" }}
                >
                  #{tc.name}
                </span>
              ))}
              {hasDate && <span style={{ color: "var(--faint)", fontFamily: "var(--font-ibm-plex-mono)" }}>◷ {note.date}</span>}
              <span onClick={side.openMeta} style={{ cursor: "pointer", color: "var(--faint)", fontSize: 12 }}>
                edit
              </span>
            </div>
          )}
          <div style={{ position: "relative" }}>{side.reading ? <ReadingView note={note} /> : <LiveEditor note={note} />}</div>
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
  return {
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
  return {
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
