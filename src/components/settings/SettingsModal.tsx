"use client";
import React, { useEffect, useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { THEMES, THEME_SWATCH, ACCENT_SWATCHES, FONT_OPTS } from "@/lib/theme/tokens";
import { CloseIcon, ChevronDownSmall } from "@/components/icons/Icons";
import { CheatsheetModal } from "./CheatsheetModal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { signOutSupabase } from "@/lib/supabase/vaultAuth";
import { clearLocalDb } from "@/lib/db/localDb";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)" }}>{children}</span>;
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border-soft)" }} />;
}

export function SettingsModal() {
  const s = useVaultStore();
  const { accent, theme } = useDerivedTheme();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!s.settingsOpen || !isSupabaseConfigured()) return;
    getSupabase()!
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, [s.settingsOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutSupabase();
    await clearLocalDb();
    window.location.reload();
  }

  if (!s.settingsOpen) return null;

  const themeCards = (
    <div style={{ display: "flex", gap: isMobile ? 10 : 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
      {THEMES.map((name) => {
        const sw = THEME_SWATCH[name];
        const on = theme === name;
        return (
          <div
            key={name}
            onClick={() => s.setTheme(name)}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: isMobile ? "0 0 calc(50% - 5px)" : "0 0 auto" }}
          >
            <div
              style={{
                width: isMobile ? "100%" : 78,
                height: isMobile ? 64 : 54,
                borderRadius: 9,
                overflow: "hidden",
                background: sw.bg,
                boxShadow: on ? `0 0 0 2px ${accent}, 0 0 0 5px ${accent}33` : "0 0 0 1px var(--border)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ height: 12, background: sw.bar, display: "flex", alignItems: "center", gap: 3, padding: "0 6px", flex: "0 0 auto" }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: sw.dot }} />
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: sw.dot }} />
              </div>
            </div>
            <span style={{ fontSize: 12, color: on ? "var(--ink)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>{name}</span>
          </div>
        );
      })}
    </div>
  );

  // Native <select> chrome draws its own dropdown arrow flush to the box
  // edge in some browsers regardless of padding-right on the element, so
  // padding alone can't create breathing room for it. Hiding the native
  // arrow (appearance:none) and drawing our own ChevronDownSmall instead
  // gives full control over its position.
  const fontSelectStyle = (mobile: boolean): React.CSSProperties => ({
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    border: "1px solid var(--border)",
    background: "var(--input)",
    color: "var(--ink)",
    borderRadius: mobile ? 9 : 8,
    padding: mobile ? "11px 34px 11px 12px" : "6px 30px 6px 10px",
    fontSize: mobile ? 14 : 13,
    fontFamily: "inherit",
    width: mobile ? "100%" : undefined,
  });
  const fontRow = (label: string, value: string, onSelect: (v: string) => void) =>
    isMobile ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{label}</span>
        <div style={{ position: "relative" }}>
          <select value={value} onChange={(e) => onSelect(e.target.value)} style={fontSelectStyle(true)}>
            {FONT_OPTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted)" }}>
            <ChevronDownSmall size={14} />
          </div>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{label}</span>
        <div style={{ position: "relative" }}>
          <select value={value} onChange={(e) => onSelect(e.target.value)} style={fontSelectStyle(false)}>
            {FONT_OPTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div style={{ position: "absolute", top: "50%", right: 9, transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted)" }}>
            <ChevronDownSmall size={13} />
          </div>
        </div>
      </div>
    );

  const accentSwatches = (
    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 8, flexWrap: "wrap" }}>
      {ACCENT_SWATCHES.map((hex) => {
        const sel = accent.toLowerCase() === hex;
        const size = isMobile ? 34 : 26;
        return (
          <div
            key={hex}
            onClick={() => s.setAccent(hex)}
            style={{ width: size, height: size, borderRadius: "50%", cursor: "pointer", background: hex, boxShadow: sel ? `0 0 0 2px var(--bg),0 0 0 4px ${hex}` : "0 0 0 1px var(--border)" }}
          />
        );
      })}
      <label
        style={{
          width: isMobile ? 34 : 26,
          height: isMobile ? 34 : 26,
          borderRadius: "50%",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 0 0 1px var(--border)",
          background: "conic-gradient(from 0deg,#e35,#fb3,#3c6,#38f,#83f,#e35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#fff", fontSize: 14, textShadow: "0 0 2px rgba(0,0,0,.5)" }}>+</span>
        <input type="color" value={accent} onChange={(e) => s.setAccent(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
      </label>
    </div>
  );

  const accountSection = email && (
    <>
      <Divider />
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <SectionLabel>Account</SectionLabel>
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
          <span style={{ flex: 1, fontSize: 13, color: "var(--muted)", wordBreak: "break-all" }}>{email}</span>
          <div
            onClick={signingOut ? undefined : handleSignOut}
            style={{
              cursor: signingOut ? "default" : "pointer",
              opacity: signingOut ? 0.6 : 1,
              fontSize: 13,
              color: "#c15a3d",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: isMobile ? "10px 14px" : "6px 12px",
              width: isMobile ? "100%" : undefined,
              textAlign: isMobile ? "center" : undefined,
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </div>
        </div>
      </div>
    </>
  );

  const vaultDataSection = (
    <>
      <Divider />
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <SectionLabel>Vault data</SectionLabel>
        <div style={{ display: "flex", gap: 9, flexDirection: isMobile ? "column" : "row" }}>
          <div
            onClick={() => document.getElementById("importInput")?.click()}
            style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 9, padding: isMobile ? 12 : 10 }}
          >
            Import Markdown…
          </div>
          <div
            onClick={() => s.exportJson()}
            style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, color: "#fff", background: accent, borderRadius: 9, padding: isMobile ? 12 : 10 }}
          >
            Export vault (JSON)
          </div>
        </div>
      </div>
    </>
  );

  const cheatsheetRow = (
    <>
      <Divider />
      <div
        onClick={() => s.openCheat()}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "13px 14px" : "11px 13px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}
      >
        <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>Markdown cheatsheet</span>
        <ChevronDownSmall size={16} />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 55, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 auto", padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 18, color: "var(--ink)" }}>Settings</span>
          <div
            onClick={() => s.closeSettings()}
            title="Close"
            style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, cursor: "pointer", color: "var(--muted)" }}
          >
            <CloseIcon />
          </div>
        </div>
        <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 16px calc(24px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>Appearance</span>
            {themeCards}
          </div>
          {fontRow("App font", s.appFont, (v) => s.onAppFont(v as never))}
          {fontRow("Note font", s.noteFont, (v) => s.onNoteFont(v as never))}
          {fontRow("Title font", s.titleFont, (v) => s.onTitleFont(v as never))}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>Primary color</span>
            {accentSwatches}
          </div>
          {accountSection}
          {vaultDataSection}
          {cheatsheetRow}
        </div>
        <CheatsheetModal />
      </div>
    );
  }

  return (
    <div
      onClick={() => s.closeSettings()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: "92vw", background: "var(--bg)", borderRadius: 14, boxShadow: "0 30px 70px -18px rgba(0,0,0,.5)", overflow: "hidden" }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>Settings</span>
          <div onClick={() => s.closeSettings()} title="Close" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, cursor: "pointer", color: "var(--muted)" }}>
            <CloseIcon />
          </div>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>Appearance</span>
            {themeCards}
          </div>
          {fontRow("App font", s.appFont, (v) => s.onAppFont(v as never))}
          {fontRow("Note font", s.noteFont, (v) => s.onNoteFont(v as never))}
          {fontRow("Title font", s.titleFont, (v) => s.onTitleFont(v as never))}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>Primary color</span>
            {accentSwatches}
          </div>
          {accountSection}
          {vaultDataSection}
          {cheatsheetRow}
        </div>
      </div>
      <CheatsheetModal />
    </div>
  );
}
