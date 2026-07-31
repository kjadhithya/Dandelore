"use client";
import React from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { CategoriesIcon, JournalIcon, SettingsIcon, CloseIcon } from "@/components/icons/Icons";

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useVaultStore();

  if (!open) return null;

  function row(icon: React.ReactNode, label: string, onClick: () => void) {
    return (
      <div
        onClick={() => {
          onClick();
          onClose();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 48,
          padding: "10px 6px",
          borderRadius: 10,
          cursor: "pointer",
          color: "var(--ink)",
          fontSize: 15,
        }}
      >
        <span style={{ width: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>{icon}</span>
        {label}
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(58,48,32,0.34)", zIndex: 75, display: "flex", alignItems: "flex-end" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--bg)",
          borderRadius: "16px 16px 0 0",
          padding: "10px 14px calc(14px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -18px 44px -12px rgba(25,20,12,.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "6px 6px 10px" }}>
          <span style={{ flex: 1, fontFamily: "var(--font-spectral)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>More</span>
          <div onClick={onClose} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            <CloseIcon />
          </div>
        </div>
        {row(<CategoriesIcon />, "Categories", () => s.goCategories())}
        {row(<JournalIcon />, "Calendar / daily notes", () => s.goJournal())}
        {row(<SettingsIcon />, "Settings", () => s.openSettings())}
      </div>
    </div>
  );
}
