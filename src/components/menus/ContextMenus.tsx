"use client";
import React from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";

const menuItemStyle: React.CSSProperties = { padding: "8px 13px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6 };
export const menuWrapStyle = (x: number, y: number, minWidth = 194): React.CSSProperties => ({
  position: "fixed",
  left: x,
  top: y,
  minWidth,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 18px 44px -12px rgba(0,0,0,.45)",
  padding: 5,
  zIndex: 62,
});

export function Item({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...menuItemStyle, color: danger ? "#c15a3d" : "var(--ink)", background: hover ? (danger ? "#cf7a6322" : "var(--active)") : "transparent" }}
    >
      {children}
    </div>
  );
}
export function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "5px 8px" }} />;
}

export function NoteContextMenu() {
  const s = useVaultStore();
  if (!s.ctxMenu) return null;
  return (
    <div onClick={() => s.closeCtx()} onContextMenu={(e) => e.preventDefault()} style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={menuWrapStyle(s.ctxMenu.x, s.ctxMenu.y, 194)}>
        {!s.ctxMove ? (
          <>
            <Item onClick={() => s.ctxOpenNote()}>Open in new tab</Item>
            <Item
              onClick={() => {
                s.toggleBookmark(s.ctxMenu!.id);
                s.closeCtx();
              }}
            >
              {s.notes.find((n) => n.id === s.ctxMenu!.id)?.bookmarked ? "Remove bookmark" : "Bookmark"}
            </Item>
            <Item onClick={() => s.ctxDuplicate()}>Duplicate</Item>
            <Item onClick={() => s.ctxMoveStart()}>Move file to…</Item>
            <Item onClick={() => s.ctxRename()}>Rename…</Item>
            <Divider />
            <Item
              danger
              onClick={() => {
                const note = s.notes.find((n) => n.id === s.ctxMenu!.id);
                s.openConfirm({
                  title: "Delete note?",
                  message: `"${note?.title || "Untitled"}" will be permanently deleted. This can't be undone.`,
                  confirmLabel: "Delete",
                  onConfirm: () => s.ctxDelete(),
                  onCancel: () => s.closeCtx(),
                });
              }}
            >
              Delete
            </Item>
          </>
        ) : (
          <>
            <div style={{ padding: "6px 13px 4px", fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)" }}>Move to folder</div>
            {[...s.folderList, "(no folder)"].map((f) => (
              <Item key={f} onClick={() => s.moveCtx(f === "(no folder)" ? "" : f)}>
                {f}
              </Item>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function BulkContextMenu() {
  const s = useVaultStore();
  if (!s.bulkCtx) return null;
  return (
    <div onClick={() => s.closeBulkCtx()} onContextMenu={(e) => e.preventDefault()} style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={menuWrapStyle(s.bulkCtx.x, s.bulkCtx.y, 230)}>
        {!s.bulkCtx.move ? (
          <>
            <Item onClick={() => s.bulkNewFolder()}>New folder with selection ({s.selectedIds.length} items)</Item>
            <Item onClick={() => s.bulkCtxMoveStart()}>Move {s.selectedIds.length} items to…</Item>
            <Divider />
            <Item
              danger
              onClick={() => {
                const count = s.selectedIds.length;
                s.closeBulkCtx();
                s.openConfirm({
                  title: `Delete ${count} note${count === 1 ? "" : "s"}?`,
                  message: "This can't be undone.",
                  confirmLabel: "Delete",
                  onConfirm: () => s.bulkDelete(),
                });
              }}
            >
              Delete
            </Item>
          </>
        ) : (
          <>
            <div style={{ padding: "6px 13px 4px", fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)" }}>Move to folder</div>
            {[...s.folderList, "(no folder)"].map((f) => (
              <Item key={f} onClick={() => s.bulkMoveTo(f === "(no folder)" ? "" : f)}>
                {f}
              </Item>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function FolderContextMenu() {
  const s = useVaultStore();
  if (!s.folderCtx) return null;
  return (
    <div onClick={() => s.closeFolderCtx()} onContextMenu={(e) => e.preventDefault()} style={{ position: "fixed", inset: 0, zIndex: 62 }}>
      <div onClick={(e) => e.stopPropagation()} style={menuWrapStyle(s.folderCtx.x, s.folderCtx.y, 150)}>
        <Item onClick={() => s.startFolderRename(s.folderCtx!.name)}>Rename…</Item>
        <Item onClick={() => s.newSubfolder(s.folderCtx!.name)}>New subfolder</Item>
        <Item
          danger
          onClick={() => {
            const name = s.folderCtx!.name;
            s.closeFolderCtx();
            s.requestDeleteFolder(name);
          }}
        >
          Delete folder
        </Item>
      </div>
    </div>
  );
}

export function CategoryContextMenu() {
  const s = useVaultStore();
  if (!s.catCtx) return null;
  return (
    <div onClick={() => s.closeCatCtx()} onContextMenu={(e) => e.preventDefault()} style={{ position: "fixed", inset: 0, zIndex: 62 }}>
      <div onClick={(e) => e.stopPropagation()} style={menuWrapStyle(s.catCtx.x, s.catCtx.y, 150)}>
        <Item onClick={() => s.catCtxRename()}>Rename…</Item>
        <Item danger onClick={() => s.catCtxDelete()}>
          Delete category
        </Item>
      </div>
    </div>
  );
}
