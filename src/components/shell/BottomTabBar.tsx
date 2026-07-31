"use client";
import React, { useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { SidebarToggleIcon, SearchIcon, GraphIcon, MoreIcon } from "@/components/icons/Icons";
import { MoreSheet } from "./MoreSheet";

function TabButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { accent } = useDerivedTheme();
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        cursor: "pointer",
        color: active ? accent : "var(--muted)",
      }}
    >
      {children}
      <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 400 }}>{label}</span>
    </div>
  );
}

export function BottomTabBar() {
  const s = useVaultStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const kind = s.curView()?.kind ?? "home";

  const filesActive = s.leftOpen && s.sideMode === "files";
  const searchActive = s.leftOpen && s.sideMode === "search";
  const graphActive = !s.leftOpen && kind === "graph";

  function onFiles() {
    if (filesActive) {
      s.toggleLeft();
      return;
    }
    useVaultStore.setState({ leftOpen: true, sideMode: "files" });
  }
  function onSearch() {
    if (searchActive) {
      s.toggleLeft();
      return;
    }
    useVaultStore.setState({ leftOpen: true, sideMode: "search" });
  }
  function onGraph() {
    if (s.leftOpen) s.toggleLeft();
    s.goGraph();
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 65,
          display: "flex",
          background: "var(--ribbon)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <TabButton label="Files" active={filesActive} onClick={onFiles}>
          <SidebarToggleIcon size={20} />
        </TabButton>
        <TabButton label="Search" active={searchActive} onClick={onSearch}>
          <SearchIcon size={20} />
        </TabButton>
        <TabButton label="Graph" active={graphActive} onClick={onGraph}>
          <GraphIcon size={20} />
        </TabButton>
        <TabButton label="More" active={moreOpen} onClick={() => setMoreOpen(true)}>
          <MoreIcon size={20} />
        </TabButton>
      </div>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
