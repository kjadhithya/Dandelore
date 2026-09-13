"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { EditIcon, TrashIcon, PinIcon, DownloadIcon } from "@/components/icons/Icons";

export function CategoryActionsMenu({ name, onClose, onDeleted }: { name: string; onClose: () => void; onDeleted?: () => void }) {
  const s = useVaultStore();
  const ref = useRef<HTMLDivElement | null>(null);
  const pinned = s.pinnedCategories.includes(name);
  // right:0 anchored off this menu's own immediate parent, which on a
  // narrow (mobile-width) card or page header sits close enough to the
  // right edge that the menu's left side ran past x=0 and got clipped by
  // the viewport. Measuring the parent and clamping into the visible
  // viewport keeps it on-screen regardless of how little room there is.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const MENU_W = 150;
    const MARGIN = 8;
    setPos({
      top: r.bottom + 4,
      left: Math.min(Math.max(MARGIN, r.right - MENU_W), Math.max(MARGIN, window.innerWidth - MENU_W - MARGIN)),
    });
  }, []);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 30,
        minWidth: 150,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
        padding: 5,
      }}
    >
      <div
        onClick={() => {
          s.togglePinCategory(name);
          onClose();
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6 }}
      >
        <PinIcon size={14} filled={pinned} />
        {pinned ? "Unpin" : "Pin"}
      </div>
      <div
        onClick={() => {
          useVaultStore.setState({ catRenaming: name });
          onClose();
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6 }}
      >
        <EditIcon size={14} />
        Rename
      </div>
      <div
        onClick={() => {
          onClose();
          s.exportCategoryMarkdownZip(name);
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "var(--ink)", cursor: "pointer", borderRadius: 6 }}
      >
        <DownloadIcon size={14} />
        Export (.zip)
      </div>
      <div
        onClick={() => {
          onClose();
          s.requestDeleteCategory(name, onDeleted);
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "#c15a3d", cursor: "pointer", borderRadius: 6 }}
      >
        <TrashIcon size={14} />
        Delete
      </div>
    </div>
  );
}
