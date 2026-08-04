"use client";
import React, { useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import type { TabState } from "@/types/vault";

function viewLabel(t: TabState, notes: ReturnType<typeof useVaultStore.getState>["notes"], accent: string, sage: string) {
  const v = t.hist[t.hi];
  if (!v) return { label: "New tab", dot: "var(--edge)" };
  if (v.kind === "note") {
    const n = notes.find((x) => x.id === v.id);
    return { label: n ? n.title || "Untitled" : "(deleted)", dot: accent };
  }
  if (v.kind === "graph") return { label: "Graph view", dot: "#6f92a0" };
  if (v.kind === "journal") return { label: "Calendar", dot: accent };
  if (v.kind === "categories") return { label: "Categories", dot: sage };
  if (v.kind === "bookmarks") return { label: "Bookmarks", dot: accent };
  return { label: "New tab", dot: "var(--edge)" };
}

export function TabBar({ split }: { split?: boolean }) {
  const s = useVaultStore();
  const { accent } = useDerivedTheme();
  const tabs = split ? s.split?.tabs || [] : s.tabs;
  const active = split ? s.split?.active ?? 0 : s.active;

  const onSelect = (i: number) => (split ? s.splitSelect(i) : s.selectTab(i));
  const onClose = (i: number) => (split ? s.splitCloseTab(i) : s.closeTab(i));
  const onNew = () => (split ? s.splitNewTab() : s.newTab());

  return (
    <div
      className="vscroll"
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        padding: "6px 8px 0",
        background: "var(--chrome)",
        borderBottom: "1px solid var(--border-soft)",
        overflowX: "auto",
      }}
    >
      {tabs.map((t, i) => {
        const isActive = i === active;
        const vl = viewLabel(t, s.notes, accent, "var(--sage)");
        const dot = isActive ? vl.dot : "var(--edge)";
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              minWidth: 110,
              maxWidth: 200,
              padding: "7px 8px 7px 12px",
              borderRadius: "9px 9px 0 0",
              cursor: "pointer",
              fontSize: 12.5,
              borderTop: `1px solid ${isActive ? "var(--border-soft)" : "transparent"}`,
              borderLeft: `1px solid ${isActive ? "var(--border-soft)" : "transparent"}`,
              borderRight: `1px solid ${isActive ? "var(--border-soft)" : "transparent"}`,
              borderBottom: "none",
              background: isActive ? "var(--bg)" : "transparent",
              color: isActive ? "var(--ink)" : "var(--muted)",
              fontWeight: isActive ? 500 : 400,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "0 0 auto" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{vl.label}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
              title="Close"
              style={{ flex: "0 0 auto", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: "var(--faint)", fontSize: 14, lineHeight: 1 }}
            >
              ×
            </span>
          </div>
        );
      })}
      <div
        onClick={onNew}
        title="New tab"
        style={{ flex: "0 0 auto", width: 26, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)", fontSize: 16, cursor: "pointer", borderRadius: 6, marginBottom: 2 }}
      >
        +
      </div>
    </div>
  );
}
