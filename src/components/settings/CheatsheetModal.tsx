"use client";
import React from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { MD_HELP_GROUPS } from "@/lib/theme/tokens";
import { CloseIcon } from "@/components/icons/Icons";

export function CheatsheetModal() {
  const s = useVaultStore();
  if (!s.cheatOpen) return null;
  return (
    <div
      onClick={() => s.closeCheat()}
      style={{ position: "fixed", inset: 0, background: "rgba(58,48,32,0.34)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 58 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, maxWidth: "92vw", maxHeight: "78vh", display: "flex", flexDirection: "column", background: "var(--bg)", borderRadius: 14, boxShadow: "0 30px 70px -18px rgba(50,40,25,.6)", overflow: "hidden" }}
      >
        <div style={{ flex: "0 0 auto", padding: "16px 20px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>Markdown cheatsheet</span>
          <div onClick={() => s.closeCheat()} title="Close" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, cursor: "pointer", color: "var(--muted)" }}>
            <CloseIcon />
          </div>
        </div>
        <div className="vscroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 22px" }}>
          {MD_HELP_GROUPS.map((grp) => (
            <div key={grp.group} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>{grp.group}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {grp.items.map((h) => (
                  <div key={h.label} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--border-soft)" }}>
                    <span style={{ flex: "0 0 120px", fontSize: 12.5, color: "var(--muted)" }}>{h.label}</span>
                    <code style={{ flex: 1, fontFamily: "var(--font-ibm-plex-mono)", fontSize: 11.5, color: "var(--ink)", background: "var(--code)", borderRadius: 5, padding: "3px 7px", whiteSpace: "pre-wrap" }}>
                      {h.syntax}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
