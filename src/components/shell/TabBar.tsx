"use client";
import React, { useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import type { TabState } from "@/types/vault";

function viewLabel(t: TabState, notes: ReturnType<typeof useVaultStore.getState>["notes"]) {
  const v = t.hist[t.hi];
  if (!v) return "New tab";
  if (v.kind === "note") {
    const n = notes.find((x) => x.id === v.id);
    return n ? n.title || "Untitled" : "(deleted)";
  }
  if (v.kind === "graph") return "Graph view";
  if (v.kind === "journal") return "Calendar";
  if (v.kind === "categories") return "Categories";
  if (v.kind === "category") return v.id || "Category";
  if (v.kind === "bookmarks") return "Bookmarks";
  return "New tab";
}

export function TabBar({ split }: { split?: boolean }) {
  const s = useVaultStore();
  const tabs = split ? s.split?.tabs || [] : s.tabs;
  const active = split ? s.split?.active ?? 0 : s.active;

  const onSelect = (i: number) => (split ? s.splitSelect(i) : s.selectTab(i));
  const onClose = (i: number) => (split ? s.splitCloseTab(i) : s.closeTab(i));
  const onNew = () => (split ? s.splitNewTab() : s.newTab());

  // Drag to reorder: `drop` is the gap the dragged tab would land in
  // (0 = before the first tab, tabs.length = after the last), shown as an
  // accent bar on that edge.
  const [drag, setDrag] = useState<{ from: number; drop: number } | null>(null);
  const dropGap = (e: React.DragEvent, i: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? i : i + 1;
  };
  const finishDrag = () => {
    if (drag) {
      const to = drag.drop > drag.from ? drag.drop - 1 : drag.drop;
      if (to !== drag.from) s.moveTab(drag.from, to, split);
    }
    setDrag(null);
  };

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
        const label = viewLabel(t, s.notes);
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              // Firefox won't start a drag without some data set.
              e.dataTransfer.setData("text/plain", label);
              setDrag({ from: i, drop: i });
            }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const g = dropGap(e, i);
              if (g !== drag.drop) setDrag({ ...drag, drop: g });
            }}
            onDrop={(e) => {
              e.preventDefault();
              finishDrag();
            }}
            onDragEnd={() => setDrag(null)}
            style={{
              opacity: drag && drag.from === i ? 0.45 : 1,
              boxShadow:
                drag && drag.drop === i && drag.drop !== drag.from && drag.drop !== drag.from + 1
                  ? "inset 2px 0 0 var(--accent-text, var(--accent, #b0623b))"
                  : drag && i === tabs.length - 1 && drag.drop === tabs.length && drag.from !== tabs.length - 1
                    ? "inset -2px 0 0 var(--accent-text, var(--accent, #b0623b))"
                    : "none",
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
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{label}</span>
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
