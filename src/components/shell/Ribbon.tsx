"use client";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import {
  GraphIcon,
  CategoriesIcon,
  JournalIcon,
  CommandIcon,
  SettingsIcon,
  SidebarToggleIcon,
} from "@/components/icons/Icons";
import React from "react";

function RibbonButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { accent } = useDerivedTheme();
  const [hover, setHover] = React.useState(false);
  const style: React.CSSProperties = {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    cursor: "pointer",
    color: active ? "#fff" : hover ? "var(--ink)" : "var(--muted)",
    background: active ? accent : hover ? "var(--active)" : "transparent",
  };
  return (
    <div
      title={title}
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </div>
  );
}

export function Ribbon() {
  const curView = useVaultStore((s) => s.curView());
  const sideMode = useVaultStore((s) => s.sideMode);
  const leftOpen = useVaultStore((s) => s.leftOpen);
  const goGraph = useVaultStore((s) => s.goGraph);
  const goCategories = useVaultStore((s) => s.goCategories);
  const goJournal = useVaultStore((s) => s.goJournal);
  const openCmd = useVaultStore((s) => s.openCmd);
  const openSettings = useVaultStore((s) => s.openSettings);
  const toggleLeft = useVaultStore((s) => s.toggleLeft);

  const kind = curView?.kind ?? "home";

  return (
    <div
      style={{
        width: 46,
        flex: "0 0 auto",
        background: "var(--ribbon)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 4,
      }}
    >
      <RibbonButton title="Graph view" active={kind === "graph"} onClick={goGraph}>
        <GraphIcon />
      </RibbonButton>
      <RibbonButton title="Categories" active={kind === "categories"} onClick={goCategories}>
        <CategoriesIcon />
      </RibbonButton>
      <RibbonButton title="Calendar / daily notes" active={kind === "journal"} onClick={goJournal}>
        <JournalIcon />
      </RibbonButton>
      <RibbonButton title="Command palette (⌘P)" onClick={openCmd}>
        <CommandIcon />
      </RibbonButton>
      <div style={{ marginTop: "auto" }} />
      <RibbonButton title="Settings" onClick={openSettings}>
        <SettingsIcon />
      </RibbonButton>
      <RibbonButton title="Toggle sidebar" active={leftOpen && sideMode === "files" && false} onClick={toggleLeft}>
        <SidebarToggleIcon />
      </RibbonButton>
    </div>
  );
}
