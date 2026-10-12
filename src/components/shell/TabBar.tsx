"use client";
import React, { useRef, useState } from "react";
import { DragGhost, ghostFrom, type GhostState } from "./DragGhost";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useGraphSettings } from "@/lib/graph/graphSettings";
import type { TabState } from "@/types/vault";

function viewLabel(t: TabState, notes: ReturnType<typeof useVaultStore.getState>["notes"]) {
  const v = t.hist[t.hi];
  if (!v) return "New tab";
  if (v.kind === "note") {
    const n = notes.find((x) => x.id === v.id);
    return n ? n.title || "Untitled" : "(deleted)";
  }
  if (v.kind === "graph") return (v.id && useGraphSettings.getState().bookmarks.find((b) => b.id === v.id)?.title) || "Graph view";
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

  // Drag to reorder, on plain mouse events (like the sidebar) so a lifted
  // copy of the tab can follow the cursor. `drop` is the gap the tab would
  // land in (0 = before the first tab, tabs.length = after the last), shown
  // as an accent bar on that edge.
  const barRef = useRef<HTMLDivElement | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ from: number; drop: number } | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);

  function gapAt(x: number): number {
    const els = Array.from(barRef.current?.querySelectorAll<HTMLElement>("[data-tab-index]") || []);
    for (let k = 0; k < els.length; k++) {
      const r = els[k].getBoundingClientRect();
      if (x < r.left + r.width / 2) return k;
    }
    return els.length;
  }

  function startDrag(e: React.MouseEvent, i: number, label: string) {
    if (e.button !== 0) return;
    const startX = e.clientX,
      startY = e.clientY;
    const base = ghostFrom(e, e.currentTarget as HTMLElement, label, "tab");
    let dragging = false;
    let drop = i;
    function onMove(ev: MouseEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragging = true;
      }
      drop = gapAt(ev.clientX);
      setDrag({ from: i, drop });
      setGhost({ ...base, x: ev.clientX, y: ev.clientY });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!dragging) return;
      // The mouseup is followed by a click on whatever tab is under the
      // pointer — don't let that re-select a different tab.
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      const to = drop > i ? drop - 1 : drop;
      if (to !== i) s.moveTab(i, to, split);
      setDrag(null);
      setGhost(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div
      ref={barRef}
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
            data-tab-index={i}
            onClick={() => {
              if (!suppressClick.current) onSelect(i);
            }}
            onMouseDown={(e) => startDrag(e, i, label)}
            style={{
              userSelect: "none",
              opacity: drag && drag.from === i ? 0.35 : 1,
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
      <DragGhost g={ghost} />
    </div>
  );
}
