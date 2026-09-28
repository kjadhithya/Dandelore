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
      <svg width={split ? 120 : 150} height={split ? 125 : 156} viewBox="0 0 100 104" fill="var(--border-soft)" style={{ opacity: 0.9 }}>
        <path d="M46.8094 51.7375C46.2173 50.0131 45.844 48.3551 45.2927 46.6832C42.9336 39.5409 40.8242 32.2803 38.9583 25.0013C37.5856 19.8458 36.0746 14.6542 35.5679 9.32991C35.213 5.6006 35.4205 1.65406 39.7008 0.366247C44.0931 -0.955205 47.3833 1.41743 48.5837 5.58199C49.8206 9.57587 49.5515 13.8373 50.0136 17.9326C50.4875 22.1309 50.9244 26.3599 51.4242 30.5588C51.91 34.6393 52.5661 38.636 52.8946 42.7543C53.1068 45.4149 53.697 47.8522 53.6878 50.5943C56.6745 42.2119 58.7573 33.7538 60.8845 25.1399C61.8735 20.9163 62.5716 16.4945 64.0604 12.4105C64.8247 10.3137 65.6366 8.14117 68.0874 7.70976C69.4205 7.47503 70.8566 7.36135 72.2572 7.7992C74.3978 8.46826 76.0649 11.2966 76.0334 13.4946C74.3249 24.5375 69.2039 35.2723 64.459 45.3248C63.3608 47.6516 61.7736 50.2374 60.9762 52.489C69.425 44.5846 77.6213 37.7067 84.5239 28.3193C86.8615 25.14 90.0872 20.6835 94.3722 20.7378C97.9821 20.7827 100.313 23.6323 99.9659 27.2227C99.273 32.3337 91.4765 39.4383 87.7873 42.6924C81.5198 48.22 74.6899 53.0912 67.4071 57.2281C65.046 58.5573 62.6663 59.8541 60.2689 61.1182C58.6969 61.948 56.6821 62.9284 55.2299 63.8826C56.7379 67.3875 57.9208 71.0111 59.2369 74.5881C60.8213 78.8949 68.3631 98.2832 66.877 101.839C66.5176 102.699 65.7689 103.297 64.913 103.641C63.9168 104.041 62.8045 104.154 61.797 103.734C60.5378 103.208 59.8666 102.076 59.3891 100.873C58.7561 99.2783 58.4964 97.5627 58.1653 95.8893C57.665 93.3617 57.2039 90.8483 56.772 88.308C56.3662 85.9217 55.8171 83.5544 55.3568 81.1771C54.9303 78.9731 54.6205 76.7321 54.1407 74.5423C53.8688 73.3008 53.4802 72.0824 53.1416 70.8575C52.6252 68.9887 52.2339 67.0115 51.2882 65.3032C45.6472 67.1215 40.0815 69.1686 34.3397 70.6636C27.7653 72.3754 11.3393 75.2425 5.26388 72.1971C4.01356 71.5704 2.98353 70.5945 2.53455 69.2572C2.12014 68.0231 2.2567 66.7262 2.86202 65.5783C3.56825 64.2387 4.93498 63.1891 6.39683 62.7627C9.96917 61.721 14.998 62.2762 18.6911 62.4353C21.3209 62.5507 23.9525 62.6207 26.5849 62.6452C30.274 62.6699 34.6139 62.363 38.1231 62.5507C34.3228 60.7949 30.7695 60.4244 26.9067 59.1444C19.439 56.6161 12.0296 53.7605 5.2878 49.6541C4.35299 49.043 3.40078 48.4153 2.5657 47.6768C-3.70325 42.1333 2.60312 34.9064 9.82764 38.8549C19.1141 43.9302 27.988 50.5343 37.7979 54.5619C38.0849 54.2405 38.3769 54.7707 38.9627 54.7203C39.1317 54.3657 39.0768 54.4381 39.0469 54.0067C30.8152 47.3886 22.8583 39.4458 15.8029 31.5964C13.1923 28.4744 9.0969 24.8257 8.47832 20.6978C8.02069 17.6439 10.7562 14.2245 13.875 14.1558C20.2494 14.0154 24.4714 23.3286 27.8304 27.6497C30.5891 31.1984 32.3779 34.6587 35.2826 38.0488C38.9194 42.8457 42.5517 47.4561 46.8094 51.7375Z" />
      </svg>
      <div style={{ display: "flex", gap: 8, marginTop: split ? 28 : 34 }}>
        <div
          onClick={() => newNote()}
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
      {/* Capture phase: the pane has to become the "current" one *before* a
          click inside it runs — navigation targets whichever pane is current,
          so with a bubbling onClick the first click in a category page or
          link inside the other pane opened its note in the wrong pane. */}
      <div onMouseDownCapture={() => s.setMainPane()} onFocusCapture={() => s.setMainPane()} style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
            onMouseDownCapture={() => s.setSplitPane()}
            onFocusCapture={() => s.setSplitPane()}
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
