"use client";
import React, { useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { TabBar } from "./TabBar";
import { EditorPane, useMainSide, useSplitSide } from "@/components/editor/EditorPane";
import { GraphView } from "@/components/graph/GraphView";
import { JournalView } from "@/components/journal/JournalView";
import { CategoriesView } from "@/components/categories/CategoriesView";
import { CategoryPage } from "@/components/categories/CategoryPage";
import { BookmarksView } from "@/components/bookmarks/BookmarksView";
import { BackIcon, ForwardIcon, NewNoteIcon, GripIcon } from "@/components/icons/Icons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

function NavBar({ split }: { split?: boolean }) {
  const s = useVaultStore();
  const tab = split ? s.split?.tabs[s.split.active] : s.tabs[s.active];
  const canBack = !!(tab && tab.hi > 0);
  const canFwd = !!(tab && tab.hi < tab.hist.length - 1);
  const goBack = split ? s.splitBack : s.goBack;
  const goForward = split ? s.splitForward : s.goForward;
  const navBtn = (en: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...(en ? { cursor: "pointer", color: "var(--muted)" } : { color: "var(--border)", pointerEvents: "none" }),
  });
  return (
    <div style={{ flex: "0 0 auto", padding: "7px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 2 }}>
      <div onClick={goBack} title="Back" style={navBtn(canBack)}>
        <BackIcon />
      </div>
      <div onClick={goForward} title="Forward" style={navBtn(canFwd)}>
        <ForwardIcon />
      </div>
    </div>
  );
}

function HomeView({ split }: { split?: boolean }) {
  const s = useVaultStore();
  const { accent } = useDerivedTheme();
  const newNote = split ? s.splitHomeEdit : s.newNote;
  const openSwitcher = split ? s.splitHomeSearch : s.toggleQuick;
  const close = split ? s.splitHomeClose : () => s.closeTab(s.active);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <svg width={split ? 120 : 150} height={split ? 120 : 150} viewBox="0 0 24 24" fill="var(--border-soft)" style={{ opacity: 0.9 }}>
        <path d="M12.83 2.18a1 1 0 00-1.2.24L6.3 8.9a1 1 0 00-.22.5l-1.05 7.3a1 1 0 00.43.98l5.72 3.9a1 1 0 001.3-.16l4.9-5.6a1 1 0 00.24-.8l-1.4-9.4a1 1 0 00-.55-.75l-2.84-1.9z" />
      </svg>
      <div style={{ display: "flex", gap: 8, marginTop: split ? 28 : 34 }}>
        <div
          onClick={newNote}
          title="New note"
          style={{ width: split ? 40 : 44, height: split ? 36 : 40, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: "9px 0 0 9px", color: "var(--muted)", cursor: "pointer", background: "var(--bg)" }}
        >
          <NewNoteIcon size={split ? 17 : 19} />
        </div>
        <div
          onClick={openSwitcher}
          title="Open a note"
          style={{ width: split ? 40 : 44, height: split ? 36 : 40, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", background: "var(--bg)" }}
        >
          <svg width={split ? 17 : 19} height={split ? 17 : 19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
            <circle cx="11.5" cy="12.5" r="2.5" />
            <line x1="15" y1="16" x2="13.4" y2="14.4" />
          </svg>
        </div>
        <div
          onClick={close}
          title="Close tab"
          style={{ width: split ? 40 : 44, height: split ? 36 : 40, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", borderRadius: "0 9px 9px 0", color: "var(--muted)", cursor: "pointer", background: "var(--bg)" }}
        >
          <svg width={split ? 17 : 19} height={split ? 17 : 19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function EmptyView() {
  const s = useVaultStore();
  const { accent, accentButtonText } = useDerivedTheme();
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 96, height: 96, borderRadius: 22, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 34, height: 34, display: "block", background: "linear-gradient(145deg,#a7b17e,#7f8a5f)", borderRadius: "7px 16px 7px 16px", opacity: 0.5 }} />
      </div>
      <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontSize: 18, color: "var(--muted)" }}>No note open</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div onClick={() => s.newNote()} style={{ cursor: "pointer", fontSize: 13, color: accentButtonText, background: accent, padding: "9px 18px", borderRadius: 8, fontWeight: 500 }}>
          New note
        </div>
        <div onClick={() => s.toggleQuick()} style={{ cursor: "pointer", fontSize: 13, color: "var(--text)", border: "1px solid var(--border)", padding: "9px 18px", borderRadius: 8 }}>
          Quick switcher
        </div>
      </div>
    </div>
  );
}

function PaneContent({ split }: { split?: boolean }) {
  const s = useVaultStore();
  const tab = split ? s.split?.tabs[s.split.active] : s.tabs[s.active];
  const view = tab ? tab.hist[tab.hi] : null;
  const kind = view?.kind ?? "empty";
  const mainSide = useMainSide();
  const splitSide = useSplitSide();

  if (kind === "note") {
    const note = s.notes.find((n) => n.id === view!.id);
    if (!note) return <EmptyView />;
    return <EditorPane note={note} side={split ? splitSide : mainSide} />;
  }
  // Notes get back/forward built into their own toolbar; every other view
  // needs the standalone NavBar since it has no toolbar of its own.
  if (kind === "graph") return (<><NavBar split={split} /><GraphView split={split} /></>);
  if (kind === "journal") return (<><NavBar split={split} /><JournalView /></>);
  if (kind === "categories") return (<><NavBar split={split} /><CategoriesView /></>);
  if (kind === "category") return (<><NavBar split={split} /><CategoryPage name={view!.id || ""} /></>);
  if (kind === "bookmarks") return (<><NavBar split={split} /><BookmarksView /></>);
  if (kind === "home") return (<><NavBar split={split} /><HomeView split={split} /></>);
  return (<><NavBar split={split} /><EmptyView /></>);
}

export function MainPane() {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const isDown = s.split?.dir === "down";
  const showSplit = !!s.split && !isMobile;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: isDown ? "column" : "row",
        background: "var(--bg)",
        paddingBottom: isMobile ? "calc(56px + env(safe-area-inset-bottom, 0px))" : 0,
      }}
    >
      <div onClick={() => s.setMainPane()} style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <TabBar />
        <PaneContent />
      </div>

      {showSplit && (
        <>
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              const container = (e.currentTarget as HTMLElement).parentElement!;
              const rect = container.getBoundingClientRect();
              const move = (ev: MouseEvent) => {
                let pct: number;
                if (isDown) pct = ((ev.clientY - rect.top) / rect.height) * 100;
                else pct = ((ev.clientX - rect.left) / rect.width) * 100;
                s.setSplitSize(pct);
              };
              const up = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
              };
              document.addEventListener("mousemove", move);
              document.addEventListener("mouseup", up);
            }}
            className="resizer"
            title="Drag to resize"
            style={
              isDown
                ? { height: 1, flex: "0 0 auto", cursor: "row-resize", background: "var(--border)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }
                : { width: 1, flex: "0 0 auto", cursor: "col-resize", background: "var(--border)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }
            }
          >
            <span
              className="grip"
              style={
                isDown
                  ? { position: "absolute", width: 34, height: 13, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, background: "var(--panel)", boxShadow: "0 1px 4px rgba(40,32,20,.22)", color: "var(--muted)" }
                  : { position: "absolute", width: 13, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, background: "var(--panel)", boxShadow: "0 1px 4px rgba(40,32,20,.22)", color: "var(--muted)" }
              }
            >
              <GripIcon />
            </span>
          </div>
          <div
            onClick={() => s.setSplitPane()}
            style={{ flex: `0 0 ${100 - s.splitSize}%`, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}
          >
            <TabBar split />
            <PaneContent split />
          </div>
        </>
      )}
    </div>
  );
}
