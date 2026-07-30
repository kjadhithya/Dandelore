"use client";
import React from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";

const menuItemStyle: React.CSSProperties = { padding: "8px 13px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6 };
const menuWrapStyle = (x: number, y: number, minWidth = 194): React.CSSProperties => ({
  position: "fixed",
  left: x,
  top: y,
  minWidth,
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 18px 44px -12px rgba(25,20,12,.55)",
  padding: 5,
  zIndex: 62,
});

function Item({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
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
function Divider() {
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
            <Item onClick={() => s.ctxDuplicate()}>Duplicate</Item>
            <Item onClick={() => s.ctxMoveStart()}>Move file to…</Item>
            <Item onClick={() => s.ctxRename()}>Rename…</Item>
            <Divider />
            <Item danger onClick={() => s.ctxDelete()}>
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
            <Item danger onClick={() => s.bulkDelete()}>
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
        <Item danger onClick={() => s.deleteFolder(s.folderCtx!.name)}>
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
