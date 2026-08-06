"use client";
import React, { useEffect, useRef } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { EditIcon, TrashIcon, PinIcon } from "@/components/icons/Icons";

export function CategoryActionsMenu({ name, onClose, onDeleted }: { name: string; onClose: () => void; onDeleted?: () => void }) {
  const s = useVaultStore();
  const ref = useRef<HTMLDivElement | null>(null);
  const pinned = s.pinnedCategories.includes(name);

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
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
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
          s.openConfirm({
            title: "Delete category?",
            message: `"${name}" will be removed. Notes in this category are kept, just uncategorized.`,
            confirmLabel: "Delete category",
            onConfirm: () => {
              s.deleteCategory(name);
              onDeleted?.();
            },
          });
        }}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "9px 11px", fontSize: 13, color: "#c15a3d", cursor: "pointer", borderRadius: 6 }}
      >
        <TrashIcon size={14} />
        Delete
      </div>
    </div>
  );
}
