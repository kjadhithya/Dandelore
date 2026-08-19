"use client";
import React, { useEffect, useRef, useState } from "react";
import { EditorEngine, type PopupState, type CtxMenuState, type BlockKind } from "@/lib/editor/EditorEngine";
import { useVaultStore, noteTags, copyText } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { FONTS } from "@/lib/theme/tokens";
import { attachFilesToCurrentNote } from "@/lib/vault/attachFiles";
import { Item, Divider, menuWrapStyle } from "@/components/menus/ContextMenus";
import type { Note } from "@/types/vault";

const BLOCK_LABELS: { kind: BlockKind; label: string }[] = [
  { kind: "bullet", label: "Bullet list" },
  { kind: "ol", label: "Numbered list" },
  { kind: "task", label: "Task list" },
];
const HEADING_LABELS: { kind: BlockKind; label: string }[] = [
  { kind: "h1", label: "Heading 1" },
  { kind: "h2", label: "Heading 2" },
  { kind: "h3", label: "Heading 3" },
  { kind: "h4", label: "Heading 4" },
  { kind: "h5", label: "Heading 5" },
  { kind: "h6", label: "Heading 6" },
  { kind: "body", label: "Body" },
];

function ParagraphMenuItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 13px",
        fontSize: 13,
        color: "var(--ink)",
        cursor: "pointer",
        borderRadius: 6,
        background: hover ? "var(--active)" : "transparent",
      }}
    >
      <span style={{ width: 12, flex: "0 0 auto", color: "var(--muted)" }}>{active ? "✓" : ""}</span>
      <span>{children}</span>
    </div>
  );
}

// On a narrow (mobile-width) screen the flyout can fail to fit on *either*
// side of the row that opens it — flipping it left doesn't help if there
// isn't 190px to spare there either. "below" drops it into normal flow
// under the row instead of beside it, which always fits since it's no
// wider than the parent menu it's already nested in.
type SubmenuPlacement = "left" | "right" | "below";
const submenuStyle = (placement: SubmenuPlacement): React.CSSProperties =>
  placement === "below"
    ? {
        position: "absolute",
        left: 0,
        top: "100%",
        marginTop: 4,
        minWidth: 190,
        maxHeight: 260,
        overflowY: "auto",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 18px 44px -12px rgba(0,0,0,.45)",
        padding: 5,
        zIndex: 63,
      }
    : {
        position: "absolute",
        [placement === "left" ? "right" : "left"]: "100%",
        top: -6,
        minWidth: 190,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 18px 44px -12px rgba(0,0,0,.45)",
        padding: 5,
        zIndex: 63,
      };

/** Right-click "Paragraph" flyout — mirrors the block-type submenu shown in
 * native rich-text editors (Bullet/Numbered/Task list, headings, Body,
 * Quote), but drives EditorEngine.setBlockType against markdown line
 * prefixes instead of native execCommand formatting. */
function ParagraphSubmenu({ blockKind, onApply, placement }: { blockKind: BlockKind; onApply: (kind: BlockKind) => void; placement: SubmenuPlacement }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={submenuStyle(placement)}>
      {BLOCK_LABELS.map(({ kind, label }) => (
        <ParagraphMenuItem key={kind} active={blockKind === kind} onClick={() => onApply(kind)}>
          {label}
        </ParagraphMenuItem>
      ))}
      <Divider />
      {HEADING_LABELS.map(({ kind, label }) => (
        <ParagraphMenuItem key={kind} active={blockKind === kind} onClick={() => onApply(kind)}>
          {label}
        </ParagraphMenuItem>
      ))}
      <Divider />
      <ParagraphMenuItem active={blockKind === "quote"} onClick={() => onApply("quote")}>
        Quote
      </ParagraphMenuItem>
    </div>
  );
}

function ParaMenu({ blockKind, onApply, placement }: { blockKind: BlockKind; onApply: (kind: BlockKind) => void; placement: SubmenuPlacement }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      // Hover opens it for mouse users; a tap has no hover state at all, so
      // the row is also click-toggled — otherwise this submenu would be
      // unreachable on touch devices.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6, background: open ? "var(--active)" : "transparent" }}
    >
      <span style={{ flex: 1 }}>Paragraph</span>
      <span style={{ color: "var(--faint)" }}>›</span>
      {open && <ParagraphSubmenu blockKind={blockKind} onApply={onApply} placement={placement} />}
    </div>
  );
}

function LinkMenu({ title, onOpenNewTab, onOpenSplit }: { title: string; onOpenNewTab: () => void; onOpenSplit: () => void }) {
  return (
    <>
      <div style={{ padding: "6px 13px 4px", fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </div>
      <Item onClick={onOpenNewTab}>Open in new tab</Item>
      <Item onClick={onOpenSplit}>Open in split view</Item>
    </>
  );
}

export function LiveEditor({ note }: { note: Note }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EditorEngine | null>(null);
  const [popup, setPopup] = useState<PopupState>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState>(null);
  const { accentText } = useDerivedTheme();
  const noteFont = useVaultStore((s) => s.noteFont);
  const byTitle = useVaultStore((s) => s.byTitle);
  const allTags = useVaultStore((s) => s.allTags);
  const setNoteContent = useVaultStore((s) => s.setNoteContent);
  const undo = useVaultStore((s) => s.undo);
  const redo = useVaultStore((s) => s.redo);
  const openOrCreate = useVaultStore((s) => s.openOrCreate);
  const ensureNote = useVaultStore((s) => s.ensureNote);
  const openSearch = useVaultStore((s) => s.openSearch);
  const openNoteNewTab = useVaultStore((s) => s.openNoteNewTab);
  const openNoteInSplit = useVaultStore((s) => s.openNoteInSplit);

  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;

  // Tracks the content this editor instance itself last serialized to the
  // store, so the content-watching effect below can tell "I just typed
  // this, the DOM already matches" apart from "something external changed
  // this note's content while I had it open" (undo/redo, a realtime sync
  // update, the same note edited in a split pane) — only the latter needs
  // a DOM refresh; re-rendering on every keystroke would clobber the caret.
  const lastEditorContentRef = useRef(note.content);

  if (!engineRef.current) {
    engineRef.current = new EditorEngine({
      hasNote: (t) => !!byTitle(t),
      getLinkSuggestions: (query) => {
        const dq = query.toLowerCase();
        const titles = useVaultStore
          .getState()
          .notes.map((n) => n.title)
          .filter((t) => !dq || t.toLowerCase().includes(dq))
          .slice(0, 8);
        const sug = titles.map((t) => ({ label: t }));
        if (dq && !useVaultStore.getState().notes.some((n) => n.title.toLowerCase() === dq)) {
          sug.push({ label: `Create "${query}"`, isCreate: true } as { label: string; isCreate: boolean });
        }
        return sug;
      },
      getTagSuggestions: (query) => {
        const dq = query.toLowerCase();
        return allTags()
          .filter((t) => !dq || t.toLowerCase().includes(dq))
          .slice(0, 8);
      },
      onContentChange: (content) => {
        lastEditorContentRef.current = content;
        setNoteContent(noteIdRef.current, content);
      },
      onPopupChange: setPopup,
      onCtxMenuChange: setCtxMenu,
      onLinkInsert: (title) => ensureNote(title),
      onLinkClick: (title) => openOrCreate(title),
      onOpenSearch: openSearch,
      onUndo: undo,
      onRedo: redo,
      onPasteFiles: (files) => attachFilesToCurrentNote(files),
      copyText,
      accentText,
      codeColor: "var(--code)",
      mutColor: "var(--muted)",
      inkColor: "var(--ink)",
    });
  }

  useEffect(() => {
    const engine = engineRef.current!;
    engine.deps.accentText = accentText;
  }, [accentText]);

  const lastNoteId = useRef(note.id);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = engineRef.current!;
    engine.mount(hostRef.current);
    engine.ed!.style.fontFamily = FONTS[noteFont] || FONTS.Serif;
    engine.ed!.style.fontSize = "15.5px";
    engine.ed!.style.color = "var(--ink)";
    engine.renderFull(note.content);
    return () => {
      engine.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current!;
    if (!engine.ed) return;
    engine.ed.style.fontFamily = FONTS[noteFont] || FONTS.Serif;
  }, [noteFont]);

  useEffect(() => {
    const engine = engineRef.current!;
    if (!engine.ed) return;
    // Always re-render on switching to a different note. For the SAME note,
    // only re-render when the content didn't come from this editor's own
    // typing (tracked via lastEditorContentRef in onContentChange) — i.e.
    // undo/redo, a remote sync update, or the same note edited in a split
    // pane. A plain in-place keystroke already kept the DOM in sync via
    // serialize(), so re-rendering there would just clobber the caret.
    if (note.id !== lastNoteId.current || note.content !== lastEditorContentRef.current) {
      engine.renderFull(note.content);
      lastEditorContentRef.current = note.content;
    }
    lastNoteId.current = note.id;
  }, [note.id, note.content]);

  const suggestions =
    popup?.type === "link"
      ? popup.suggestions
      : popup?.type === "tag"
        ? popup.suggestions.map((label) => ({ label }))
        : [];

  const POPUP_MAX_W = 360;
  const POPUP_MAX_H = 280;
  const MARGIN = 8;
  // window.innerHeight is the layout viewport, which on mobile Safari
  // stays at its largest size and doesn't shrink for the virtual
  // keyboard — clamping against it left the popup positioned as if the
  // keyboard-covered area were still visible. visualViewport tracks what's
  // actually on screen.
  const vvw = typeof window !== "undefined" ? window.visualViewport?.width ?? window.innerWidth : 0;
  const vvh = typeof window !== "undefined" ? window.visualViewport?.height ?? window.innerHeight : 0;
  const popupLeft = popup ? Math.min(Math.max(MARGIN, popup.pos.x), Math.max(MARGIN, vvw - POPUP_MAX_W - MARGIN)) : 0;
  const popupTop = popup ? Math.min(popup.pos.y, Math.max(MARGIN, vvh - POPUP_MAX_H - MARGIN)) : 0;
  const CTX_MENU_W = 194;
  const SUBMENU_W = 190;
  // ctxMenu.x comes straight from a click/selection coordinate (e.clientX or
  // a selection rect's left edge) with no regard for viewport width — on a
  // narrow screen, text selected near the right edge pushed the whole menu
  // half off-screen. Clamped the same way popupLeft already is above.
  const ctxMenuLeft = ctxMenu ? Math.min(Math.max(MARGIN, ctxMenu.x), Math.max(MARGIN, vvw - CTX_MENU_W - MARGIN)) : 0;
  const submenuPlacement: SubmenuPlacement =
    ctxMenuLeft + CTX_MENU_W + SUBMENU_W <= vvw ? "right" : ctxMenuLeft - SUBMENU_W >= 0 ? "left" : "below";

  return (
    <div style={{ position: "relative" }}>
      <div ref={hostRef} />
      {popup && suggestions.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: popupLeft,
            top: popupTop,
            zIndex: 70,
            width: `min(${POPUP_MAX_W}px, calc(100vw - ${MARGIN * 2}px))`,
            minWidth: 220,
            maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
            maxHeight: POPUP_MAX_H,
            overflowY: "auto",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
            padding: 5,
          }}
        >
          {suggestions.map((sug, i) => (
            <div
              key={sug.label + i}
              onMouseDown={(e) => {
                e.preventDefault();
                if (popup.type === "link") engineRef.current!.pickLink((sug as { label: string; isCreate?: boolean }).isCreate ? popup.query : sug.label);
                else engineRef.current!.pickTag(sug.label);
              }}
              style={{
                padding: "8px 11px",
                borderRadius: 7,
                cursor: "pointer",
                fontFamily: popup.type === "link" ? "var(--font-title, var(--font-spectral))" : "var(--font-ibm-plex-mono)",
                fontSize: popup.type === "link" ? 14 : 13,
                color:
                  popup.type === "link"
                    ? (sug as { isCreate?: boolean }).isCreate
                      ? "var(--sage)"
                      : "var(--ink)"
                    : accentText,
                background: i === popup.activeIdx ? "var(--panel)" : "transparent",
              }}
            >
              {popup.type === "tag" ? "#" : ""}
              {sug.label}
            </div>
          ))}
          {popup.type === "link" && (
            <div style={{ padding: "6px 11px 3px", borderTop: "1px solid var(--border-soft)", marginTop: 4, fontSize: 11, color: "var(--faint)" }}>
              ↵ to link · Esc to cancel
            </div>
          )}
        </div>
      )}
      {ctxMenu && (
        <div
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...menuWrapStyle(ctxMenu.x, ctxMenu.y, 194),
              position: "fixed",
              left: ctxMenuLeft,
              top: Math.min(ctxMenu.y, Math.max(8, vvh - (ctxMenu.kind === "para" ? 636 : 130) - 8)),
            }}
          >
            {ctxMenu.kind === "para" ? (
              <>
                <Item
                  onClick={() => {
                    engineRef.current!.cutSelection();
                    setCtxMenu(null);
                  }}
                >
                  Cut
                </Item>
                <Item
                  onClick={() => {
                    engineRef.current!.copySelection();
                    setCtxMenu(null);
                  }}
                >
                  Copy
                </Item>
                <Item
                  onClick={() => {
                    engineRef.current!.pasteFromClipboard();
                    setCtxMenu(null);
                  }}
                >
                  Paste
                </Item>
                <Divider />
                <Item
                  onClick={() => {
                    engineRef.current!.selectAllContent();
                    setCtxMenu(null);
                  }}
                >
                  Select all
                </Item>
                <Divider />
                <ParaMenu
                  blockKind={ctxMenu.blockKind}
                  onApply={(kind) => {
                    engineRef.current!.setBlockType(ctxMenu.line, kind);
                    setCtxMenu(null);
                  }}
                  placement={submenuPlacement}
                />
              </>
            ) : (
              <LinkMenu
                title={ctxMenu.title}
                onOpenNewTab={() => {
                  const existing = byTitle(ctxMenu.title);
                  const id = existing ? existing.id : ensureNote(ctxMenu.title);
                  openNoteNewTab(id);
                  setCtxMenu(null);
                }}
                onOpenSplit={() => {
                  const existing = byTitle(ctxMenu.title);
                  const id = existing ? existing.id : ensureNote(ctxMenu.title);
                  openNoteInSplit(id);
                  setCtxMenu(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function noteTagsOf(n: Note) {
  return noteTags(n);
}
