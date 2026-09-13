"use client";
import React, { useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { RadioRow } from "@/components/menus/RadioRow";

type Mode = "keep" | "move" | "delete";

// Keyed by category name in the parent below, so switching which category
// is pending deletion remounts this fresh instead of needing an effect to
// reset mode/target back to their defaults.
function CategoryDeleteDialogBody({ name }: { name: string }) {
  const categories = useVaultStore((s) => s.categories);
  const notes = useVaultStore((s) => s.notes);
  const closeCatDeleteRequest = useVaultStore((s) => s.closeCatDeleteRequest);
  const resolveCategoryDelete = useVaultStore((s) => s.resolveCategoryDelete);
  const { accentText } = useDerivedTheme();
  const isMobile = useIsMobile();
  const otherCategories = categories.filter((c) => c !== name);
  const [mode, setMode] = useState<Mode>("keep");
  const [target, setTarget] = useState(otherCategories[0] || "");

  const count = notes.filter((n) => n.category === name).length;

  function confirm() {
    resolveCategoryDelete(mode, mode === "move" ? target : undefined);
  }

  const cancelBtn: React.CSSProperties = {
    flex: 1,
    textAlign: "center",
    cursor: "pointer",
    fontSize: 13.5,
    color: "var(--ink)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: "10px 14px",
  };
  const confirmDisabled = mode === "move" && !target;
  const confirmBtn: React.CSSProperties = {
    flex: 1,
    textAlign: "center",
    cursor: confirmDisabled ? "default" : "pointer",
    opacity: confirmDisabled ? 0.5 : 1,
    fontSize: 13.5,
    fontWeight: 500,
    color: "#fff",
    background: mode === "delete" ? "#c15a3d" : accentText,
    borderRadius: 9,
    padding: "10px 14px",
  };

  const card = (
    <>
      <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 17, color: "var(--ink)", marginBottom: 6 }}>
        Delete “{name}”?
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 16 }}>
        {count === 0 ? "This category has no notes." : `Choose what happens to the ${count} note${count === 1 ? "" : "s"} in this category.`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        <RadioRow
          selected={mode === "keep"}
          onClick={() => setMode("keep")}
          title="Keep notes, remove category"
          subtitle="Notes stay — they just become uncategorized."
          accentText={accentText}
        />
        <RadioRow
          selected={mode === "move"}
          onClick={() => otherCategories.length > 0 && setMode("move")}
          title="Move notes to another category"
          subtitle={otherCategories.length ? "Pick where the notes should go." : "No other categories exist yet."}
          accentText={accentText}
        >
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={!otherCategories.length}
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              background: "var(--input)",
              color: "var(--ink)",
              borderRadius: 7,
              padding: "7px 8px",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            {otherCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </RadioRow>
        <RadioRow
          selected={mode === "delete"}
          onClick={() => setMode("delete")}
          title="Delete all notes in this category"
          subtitle={count ? `Permanently deletes ${count} note${count === 1 ? "" : "s"}. This can't be undone.` : "No notes to delete."}
          danger
          accentText={accentText}
        />
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <div onClick={closeCatDeleteRequest} style={cancelBtn}>
          Cancel
        </div>
        <div onClick={confirmDisabled ? undefined : confirm} style={confirmBtn}>
          {mode === "delete" ? "Delete notes" : mode === "move" ? "Move & delete category" : "Delete category"}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div onClick={closeCatDeleteRequest} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: "flex-end" }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            background: "var(--bg)",
            borderRadius: "16px 16px 0 0",
            padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -18px 44px -12px rgba(0,0,0,.4)",
            maxHeight: "85vh",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "0 0 12px" }}>
            <span style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
          </div>
          {card}
        </div>
      </div>
    );
  }

  return (
    <div onClick={closeCatDeleteRequest} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: "90vw", background: "var(--bg)", borderRadius: 14, boxShadow: "0 30px 70px -18px rgba(0,0,0,.5)", padding: 20 }}
      >
        {card}
      </div>
    </div>
  );
}

export function CategoryDeleteDialog() {
  const req = useVaultStore((s) => s.catDeleteRequest);
  if (!req) return null;
  return <CategoryDeleteDialogBody key={req.name} name={req.name} />;
}
