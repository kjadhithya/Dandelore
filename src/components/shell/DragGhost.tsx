"use client";
import React from "react";
import { createPortal } from "react-dom";

/** What's being dragged: the pointer position plus the original block's
 * size (captured at mousedown) so the chip roughly matches it. */
export interface GhostState {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: "note" | "folder" | "tab";
}

export function ghostFrom(e: React.MouseEvent | MouseEvent, el: HTMLElement, label: string, kind: GhostState["kind"]): GhostState {
  const r = el.getBoundingClientRect();
  return { x: e.clientX, y: e.clientY, w: r.width, h: r.height, label, kind };
}

/** A floating chip for the dragged note / folder / tab that follows the
 * cursor. Rendered into <body> through a portal so no ancestor's overflow
 * or stacking can hide it. */
export function DragGhost({ g }: { g: GhostState | null }) {
  if (!g || typeof document === "undefined") return null;
  const icon =
    g.kind === "folder" ? (
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    ) : (
      <>
        <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
        <path d="M14 3v5h5" />
      </>
    );
  // Styled after the file-manager convention (Drive, Finder): a translucent
  // grey chip with the item's icon and name, just below-right of the cursor
  // so it never covers the drop target under the pointer.
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: g.x + 10,
        top: g.y + 8,
        width: Math.min(Math.max(g.w, 150), 280),
        height: Math.max(g.h, 34),
        zIndex: 1000,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 9,
        boxSizing: "border-box",
        padding: "0 14px",
        background: "rgba(128,128,128,.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderRadius: 9,
        boxShadow: "0 8px 24px -6px rgba(0,0,0,.35)",
        fontSize: 13.5,
        fontWeight: 500,
        color: "#fff",
      }}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" style={{ flex: "0 0 auto", opacity: 0.9 }}>
        {icon}
      </svg>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
    </div>,
    document.body,
  );
}
