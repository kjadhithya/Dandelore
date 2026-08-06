"use client";
import React, { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { THEME_KEY, THEME_BG, FONTS } from "@/lib/theme/tokens";
import { hexToRgb } from "@/lib/theme/color";
import { hydrateFromLocalDb, startLocalPersistence } from "@/lib/db/persistence";
import { startSyncWorker } from "@/lib/sync/syncWorker";
import { attachFilesToCurrentNote } from "@/lib/vault/attachFiles";
import { Ribbon } from "./Ribbon";
import { Sidebar } from "./Sidebar";
import { MainPane } from "./MainPane";
import { RightPanel } from "./RightPanel";
import { BottomTabBar } from "./BottomTabBar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { QuickSwitcher } from "@/components/palette/QuickSwitcher";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { NoteContextMenu, BulkContextMenu, FolderContextMenu, CategoryContextMenu } from "@/components/menus/ContextMenus";
import { ConfirmDialog } from "@/components/menus/ConfirmDialog";
import { NewNoteIcon } from "@/components/icons/Icons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export function VaultShell() {
  const s = useVaultStore();
  const { theme, accent, accentText, accentFadedRgba, accentFadedBorderRgba, accentSelRgba, accentButtonText } = useDerivedTheme();
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    let stopPersistence: (() => void) | null = null;
    let stopSync: (() => void) | null = null;
    function ensureDefaultNote() {
      if (useVaultStore.getState().notes.length === 0) useVaultStore.getState().newNote();
    }
    hydrateFromLocalDb().then(() => {
      setHydrated(true);
      stopPersistence = startLocalPersistence();
      // Wait for the initial Supabase pull (if any) before deciding the
      // vault is truly empty, so we don't spawn a spurious note alongside
      // notes that are about to arrive from the cloud.
      stopSync = startSyncWorker(ensureDefaultNote);
    });
    return () => {
      stopPersistence?.();
      stopSync?.();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (k === "o" || k === "k")) {
        e.preventDefault();
        useVaultStore.getState().toggleQuick();
      } else if ((e.metaKey || e.ctrlKey) && k === "p") {
        e.preventDefault();
        useVaultStore.getState().openCmd();
      } else if (e.key === "Escape") {
        useVaultStore.getState().closeAllMenus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("kv-theme");
      if (t) useVaultStore.setState({ themeOverride: t as never });
      const a = localStorage.getItem("kv-accent");
      if (a) useVaultStore.setState({ accentOverride: a });
      const r = localStorage.getItem("kv-showRight");
      if (r !== null) useVaultStore.setState({ showRight: r === "1" });
      const af = localStorage.getItem("kv-appFont");
      if (af) useVaultStore.setState({ appFont: af as never });
      const nf = localStorage.getItem("kv-noteFont");
      if (nf) useVaultStore.setState({ noteFont: nf as never });
      const tf = localStorage.getItem("kv-titleFont");
      if (tf) useVaultStore.setState({ titleFont: tf as never });
    } catch {}
  }, []);

  // Backlinks visibility is a layout preference, not vault data — persist it
  // like theme/accent so closing it sticks across reloads instead of always
  // reopening from the store's static initial state.
  useEffect(() => {
    try {
      localStorage.setItem("kv-showRight", s.showRight ? "1" : "0");
    } catch {}
  }, [s.showRight]);

  // Font choices were never saved anywhere, so a reload silently reverted
  // them to the hardcoded defaults regardless of what was picked in Settings.
  useEffect(() => {
    try {
      localStorage.setItem("kv-appFont", s.appFont);
      localStorage.setItem("kv-noteFont", s.noteFont);
      localStorage.setItem("kv-titleFont", s.titleFont);
    } catch {}
  }, [s.appFont, s.noteFont, s.titleFont]);

  // document.body sits outside .vault, so it can't see --bg via CSS
  // variables — without this it stays whatever static color globals.css
  // sets regardless of theme, which flashes on overscroll bounce (iOS
  // Safari) and in the margins if the vault doesn't fully cover the tab.
  useEffect(() => {
    document.body.style.background = THEME_BG[theme] || THEME_BG["Light Warm"];
  }, [theme]);

  // Sidebar and backlinks default to open on desktop; on phones they're
  // overlays that should start closed so the note content is visible first.
  useEffect(() => {
    if (isMobile) useVaultStore.setState({ showRight: false, leftOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated) return null;

  const rgb = hexToRgb(accent);

  return (
    <div
      className="vault"
      data-vtheme={THEME_KEY(theme)}
      style={
        {
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          "--accent": accent,
          "--accent-text": accentText,
          "--accent-faded": accentFadedRgba,
          "--accent-faded-border": accentFadedBorderRgba,
          "--accent-sel": `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`,
          "--font-title": FONTS[s.titleFont] || FONTS.Serif,
          fontFamily: FONTS[s.appFont] || FONTS.Sans,
        } as React.CSSProperties
      }
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {!isMobile && <Ribbon />}
        {!isMobile && s.leftOpen && <Sidebar />}
        <MainPane />
        <RightPanel />
      </div>

      {isMobile && s.leftOpen && (
        <>
          <div onClick={() => s.toggleLeft()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 70 }} />
          <div
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
              zIndex: 71,
              width: "min(86vw, 340px)",
              display: "flex",
              boxShadow: "0 0 40px rgba(0,0,0,.3)",
            }}
          >
            <Sidebar />
          </div>
        </>
      )}

      {isMobile && <BottomTabBar />}

      {isMobile && !s.leftOpen && (
        <div
          onClick={() => s.newNote()}
          title="New note"
          style={{
            position: "fixed",
            right: 16,
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
            zIndex: 64,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: accent,
            color: accentButtonText,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 24px -6px rgba(0,0,0,.4)",
            cursor: "pointer",
          }}
        >
          <NewNoteIcon size={22} />
        </div>
      )}

      <NoteContextMenu />
      <BulkContextMenu />
      <FolderContextMenu />
      <CategoryContextMenu />
      <ConfirmDialog />
      <SettingsModal />
      <QuickSwitcher />
      <CommandPalette />

      <input
        id="importInput"
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          Promise.all(
            files.map(
              (f) =>
                new Promise<{ name: string; text: string }>((resolve) => {
                  const r = new FileReader();
                  r.onload = () => resolve({ name: f.name, text: String(r.result) });
                  r.readAsText(f);
                }),
            ),
          ).then((results) => s.importMarkdown(results));
          e.target.value = "";
        }}
      />
      <input
        id="importJsonInput"
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const r = new FileReader();
          r.onload = () => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(String(r.result));
            } catch {
              alert("That file isn't valid JSON.");
              return;
            }
            const res = s.importJson(parsed);
            if (!res.ok) alert(res.error || "Import failed.");
          };
          r.readAsText(file);
        }}
      />
      <input
        id="attachInput"
        ref={attachInputRef}
        type="file"
        accept="image/*,application/pdf,video/*,audio/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          attachFilesToCurrentNote(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
