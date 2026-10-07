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
import { CategoryDeleteDialog } from "@/components/categories/CategoryDeleteDialog";
import { FolderDeleteDialog } from "@/components/shell/FolderDeleteDialog";
import { NewNoteIcon } from "@/components/icons/Icons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export function VaultShell() {
  const s = useVaultStore();
  const { theme, accent, accentText, accentFadedRgba, accentFadedBorderRgba, accentSelRgba, accentButtonText } = useDerivedTheme();
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // A browser that has never opened this vault (a new account, or a new
  // device) doesn't know its theme until the first settings pull lands, and
  // painting the vault before that showed the Light Warm fallback for a
  // moment before switching. In that case hold a plain Dark screen (the
  // default for new accounts) until the initial sync is ready. Safe to read
  // localStorage here: AuthGate never renders this on the server.
  const [themeReady, setThemeReady] = useState(() => {
    try {
      return !!localStorage.getItem("kv-theme");
    } catch {
      return true;
    }
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    let stopPersistence: (() => void) | null = null;
    let stopSync: (() => void) | null = null;
    function ensureDefaultNote() {
      if (useVaultStore.getState().notes.length === 0) useVaultStore.getState().newNote();
    }
    function onSyncReady() {
      ensureDefaultNote();
      setThemeReady(true);
    }
    // Never leave the placeholder up if the first sync is slow or fails.
    const themeTimeout = setTimeout(() => setThemeReady(true), 6000);
    hydrateFromLocalDb().then(() => {
      setHydrated(true);
      stopPersistence = startLocalPersistence();
      // Wait for the initial Supabase pull (if any) before deciding the
      // vault is truly empty, so we don't spawn a spurious note alongside
      // notes that are about to arrive from the cloud.
      stopSync = startSyncWorker(onSyncReady);
    });
    return () => {
      clearTimeout(themeTimeout);
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
      const r = localStorage.getItem("kv-backlinksOpen");
      if (r !== null) useVaultStore.setState({ showRight: r === "1" });
      const af = localStorage.getItem("kv-appFont");
      if (af) useVaultStore.setState({ appFont: af as never });
      const nf = localStorage.getItem("kv-noteFont");
      if (nf) useVaultStore.setState({ noteFont: nf as never });
      const tf = localStorage.getItem("kv-titleFont");
      if (tf) useVaultStore.setState({ titleFont: tf as never });
      const pc = localStorage.getItem("kv-pinnedCategories");
      if (pc) useVaultStore.setState({ pinnedCategories: JSON.parse(pc) });
    } catch {}
  }, []);

  // Backlinks visibility is a layout preference, not vault data — persist it
  // like theme/accent so opening/closing it sticks across reloads. Backlinks
  // start closed until the user opens them; the key was renamed from
  // kv-showRight because that one was written as "1" for everyone back when
  // the panel defaulted to open, which would otherwise keep it open.
  useEffect(() => {
    try {
      localStorage.setItem("kv-backlinksOpen", s.showRight ? "1" : "0");
    } catch {}
  }, [s.showRight]);

  useEffect(() => {
    try {
      localStorage.setItem("kv-pinnedCategories", JSON.stringify(s.pinnedCategories));
    } catch {}
  }, [s.pinnedCategories]);

  // setTheme/setAccent write to localStorage themselves, but that only
  // covers a change made *from this device*. A theme/accent pulled in from
  // Supabase (another device changed it, or the initial sync after a
  // reload) goes through applySettingsRow's plain setState instead, which
  // never touched localStorage — so the stale cached value kept getting
  // painted first on every subsequent reload, then visibly replaced once
  // the Supabase pull corrected it again a moment later, forever, since
  // the correction itself was never written back to the cache that
  // caused it. Watching the values directly (like appFont/noteFont/
  // titleFont above) persists a sync-sourced change same as a local one.
  useEffect(() => {
    try {
      if (s.themeOverride) localStorage.setItem("kv-theme", s.themeOverride);
      if (s.accentOverride) localStorage.setItem("kv-accent", s.accentOverride);
    } catch {}
  }, [s.themeOverride, s.accentOverride]);

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

  // The sidebar defaults to open on desktop; on phones it and backlinks are
  // overlays that should start closed so the note content is visible first.
  useEffect(() => {
    if (isMobile) useVaultStore.setState({ showRight: false, leftOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated) return null;
  if (!themeReady) return <div style={{ position: "fixed", inset: 0, background: THEME_BG["Dark"] }} />;

  const rgb = hexToRgb(accent);

  return (
    <div
      className="vault"
      data-vtheme={THEME_KEY(theme)}
      style={
        {
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
      <CategoryDeleteDialog />
      <FolderDeleteDialog />
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
