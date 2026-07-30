"use client";
import React, { useEffect, useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useDerivedTheme } from "@/lib/theme/useDerivedTheme";
import { THEMES, THEME_SWATCH, ACCENT_SWATCHES, FONT_OPTS } from "@/lib/theme/tokens";
import { CloseIcon, ChevronDownSmall } from "@/components/icons/Icons";
import { CheatsheetModal } from "./CheatsheetModal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { signOutSupabase } from "@/lib/supabase/vaultAuth";
import { clearLocalDb } from "@/lib/db/localDb";
import type { ThemeName } from "@/types/vault";

export function SettingsModal() {
  const s = useVaultStore();
  const { accent, theme } = useDerivedTheme();
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

  return (
    <div
      onClick={() => s.closeSettings()}
      style={{ position: "fixed", inset: 0, background: "rgba(58,48,32,0.34)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: "92vw", background: "var(--bg)", borderRadius: 14, boxShadow: "0 30px 70px -18px rgba(50,40,25,.6)", overflow: "hidden" }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, fontFamily: "var(--font-spectral)", fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>Settings</span>
          <div onClick={() => s.closeSettings()} title="Close" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, cursor: "pointer", color: "var(--muted)" }}>
            <CloseIcon />
          </div>
        </div>
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>Appearance</span>
            <div style={{ display: "flex", gap: 14 }}>
              {THEMES.map((name) => {
                const sw = THEME_SWATCH[name];
                const on = theme === name;
                return (
                  <div key={name} onClick={() => s.setTheme(name)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                    <div
                      style={{
                        width: 78,
                        height: 54,
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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>App font</span>
            <select
              value={s.appFont}
              onChange={(e) => s.onAppFont(e.target.value as never)}
              style={{ border: "1px solid var(--border)", background: "var(--input)", color: "var(--ink)", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }}
            >
              {FONT_OPTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>Note font</span>
            <select
              value={s.noteFont}
              onChange={(e) => s.onNoteFont(e.target.value as never)}
              style={{ border: "1px solid var(--border)", background: "var(--input)", color: "var(--ink)", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "inherit" }}
            >
              {FONT_OPTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>Primary color</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {ACCENT_SWATCHES.map((hex) => {
                const sel = accent.toLowerCase() === hex;
                return (
                  <div
                    key={hex}
                    onClick={() => s.setAccent(hex)}
                    style={{ width: 26, height: 26, borderRadius: "50%", cursor: "pointer", background: hex, boxShadow: sel ? `0 0 0 2px var(--bg),0 0 0 4px ${hex}` : "0 0 0 1px var(--border)" }}
                  />
                );
              })}
              <label style={{ width: 26, height: 26, borderRadius: "50%", cursor: "pointer", position: "relative", overflow: "hidden", boxShadow: "0 0 0 1px var(--border)", background: "conic-gradient(from 0deg,#e35,#fb3,#3c6,#38f,#83f,#e35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 14, textShadow: "0 0 2px rgba(0,0,0,.5)" }}>+</span>
                <input type="color" value={accent} onChange={(e) => s.setAccent(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </label>
            </div>
          </div>
          {email && (
            <>
              <div style={{ height: 1, background: "var(--border-soft)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)" }}>Account</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--muted)" }}>{email}</span>
                  <div
                    onClick={signingOut ? undefined : handleSignOut}
                    style={{ cursor: signingOut ? "default" : "pointer", opacity: signingOut ? 0.6 : 1, fontSize: 13, color: "#c15a3d", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px" }}
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </div>
                </div>
              </div>
            </>
          )}
          <div style={{ height: 1, background: "var(--border-soft)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)" }}>Vault data</span>
            <div style={{ display: "flex", gap: 9 }}>
              <div onClick={() => document.getElementById("importInput")?.click()} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}>
                Import Markdown…
              </div>
              <div onClick={() => s.exportJson()} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, color: "#fff", background: accent, borderRadius: 9, padding: 10 }}>
                Export vault (JSON)
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: "var(--border-soft)" }} />
          <div
            onClick={() => s.openCheat()}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}
          >
            <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>Markdown cheatsheet</span>
            <ChevronDownSmall size={16} />
          </div>
        </div>
      </div>
      <CheatsheetModal />
    </div>
  );
}
