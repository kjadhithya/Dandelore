"use client";
import React, { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { THEME_KEY, FONTS } from "@/lib/theme/tokens";
import { hexToRgb } from "@/lib/theme/color";
import { hydrateFromLocalDb, startLocalPersistence } from "@/lib/db/persistence";
import { startSyncWorker } from "@/lib/sync/syncWorker";
import { getCurrentVaultId } from "@/lib/supabase/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadAttachment } from "@/lib/supabase/attachments";
import { Ribbon } from "./Ribbon";
import { Sidebar } from "./Sidebar";
import { MainPane } from "./MainPane";
import { RightPanel } from "./RightPanel";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { QuickSwitcher } from "@/components/palette/QuickSwitcher";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { NoteContextMenu, BulkContextMenu, FolderContextMenu, CategoryContextMenu } from "@/components/menus/ContextMenus";

export function VaultShell() {
  const s = useVaultStore();
  const { theme, accent, accentText, accentFadedRgba, accentSelRgba } = useDerivedTheme();
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stopPersistence: (() => void) | null = null;
    let stopSync: (() => void) | null = null;
    hydrateFromLocalDb().then(() => {
      setHydrated(true);
      stopPersistence = startLocalPersistence();
      stopSync = startSyncWorker();
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
    } catch {}
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
          "--accent-sel": `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.32)`,
          fontFamily: FONTS[s.appFont] || FONTS.Sans,
        } as React.CSSProperties
      }
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Ribbon />
        {s.leftOpen && <Sidebar />}
        <MainPane />
        <RightPanel />
      </div>

      <NoteContextMenu />
      <BulkContextMenu />
      <FolderContextMenu />
      <CategoryContextMenu />
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
        id="attachInput"
        ref={attachInputRef}
        type="file"
        accept="image/*,application/pdf,video/*,audio/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          Promise.all(
            files.map(
              (f) =>
                new Promise<{ name: string; type: string; dataUrl: string }>((resolve) => {
                  const r = new FileReader();
                  r.onload = () => resolve({ name: f.name, type: f.type || "", dataUrl: String(r.result) });
                  r.readAsDataURL(f);
                }),
            ),
          ).then((results) => {
            const noteId = s.curId();
            s.attachFiles(results);
            const vaultId = getCurrentVaultId();
            if (vaultId && noteId && isSupabaseConfigured()) {
              results.forEach((f) => uploadAttachment(vaultId, noteId, f));
            }
          });
          e.target.value = "";
        }}
      />
    </div>
  );
}
