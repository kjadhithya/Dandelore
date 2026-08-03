"use client";
import React, { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { ChevronDownSmall, EditIcon, TrashIcon } from "@/components/icons/Icons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

function rowIconBtnStyle(isMobile: boolean): React.CSSProperties {
  const size = isMobile ? 36 : 24;
  return {
    flex: "0 0 auto",
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    cursor: "pointer",
    color: "var(--faint)",
  };
}

/** Category picker for the note meta panel — a custom dropdown (not a
 * native <select>) so it can also create, rename, and delete categories
 * inline instead of only offering ones that already exist. */
export function CategoryDropdown({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const categories = useVaultStore((s) => s.categories);
  const addCategoryGlobal = useVaultStore((s) => s.addCategoryGlobal);
  const renameCategory = useVaultStore((s) => s.renameCategory);
  const deleteCategory = useVaultStore((s) => s.deleteCategory);
  const openConfirm = useVaultStore((s) => s.openConfirm);
  const { accentText } = useDerivedTheme();
  const isMobile = useIsMobile();
  const rowIconBtn = rowIconBtnStyle(isMobile);

  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [newDraft, setNewDraft] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function commitNew() {
    const name = newDraft.trim();
    if (!name) return;
    addCategoryGlobal(name);
    onSelect(name);
    setNewDraft("");
    setOpen(false);
  }

  function commitRename(oldName: string) {
    const name = renameDraft.trim();
    if (name && name !== oldName) renameCategory(oldName, name);
    setRenaming(null);
  }

  function handleDelete(name: string) {
    openConfirm({
      title: "Delete category?",
      message: `"${name}" will be removed. Notes in this category are kept, just uncategorized.`,
      confirmLabel: "Delete category",
      onConfirm: () => deleteCategory(name),
    });
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flex: 1 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          border: "1px solid var(--border)",
          background: "var(--input)",
          color: "var(--ink)",
          borderRadius: 7,
          padding: "5px 8px 5px 10px",
          fontSize: 12.5,
          cursor: "pointer",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{value || "None"}</span>
        <ChevronDownSmall size={13} />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            right: 0,
            zIndex: 45,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 16px 40px -12px rgba(25,20,12,.5)",
            padding: 5,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          <div
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              minHeight: isMobile ? 40 : undefined,
              padding: "8px 10px",
              fontSize: 12.5,
              borderRadius: 6,
              cursor: "pointer",
              color: !value ? accentText : "var(--ink)",
              fontWeight: !value ? 600 : 400,
            }}
          >
            None
          </div>
          {categories.map((c) =>
            renaming === c ? (
              <div key={c} style={{ padding: "4px 4px" }}>
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(c);
                    else if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={() => commitRename(c)}
                  style={{ width: "100%", border: "1px solid var(--accent, #b0623b)", background: "var(--input)", borderRadius: 6, padding: "6px 8px", fontSize: 12.5, color: "var(--ink)" }}
                />
              </div>
            ) : (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 6 }}>
                <span
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    minHeight: isMobile ? 40 : undefined,
                    padding: "8px 4px 8px 10px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: value === c ? accentText : "var(--ink)",
                    fontWeight: value === c ? 600 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c}
                </span>
                <div
                  title="Rename"
                  onClick={() => {
                    setRenaming(c);
                    setRenameDraft(c);
                  }}
                  style={rowIconBtn}
                >
                  <EditIcon size={13} />
                </div>
                <div title="Delete" onClick={() => handleDelete(c)} style={{ ...rowIconBtn, marginRight: 4, color: "#c15a3d" }}>
                  <TrashIcon size={13} />
                </div>
              </div>
            ),
          )}
          <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: 4, paddingTop: 6 }}>
            <input
              value={newDraft}
              onChange={(e) => setNewDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNew();
              }}
              placeholder="+ New category"
              style={{ width: "100%", border: "1px solid var(--border)", background: "var(--input)", borderRadius: 6, padding: "7px 9px", fontSize: 12.5, color: "var(--ink)", fontFamily: "inherit" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
