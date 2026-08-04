"use client";
import React, { useState } from "react";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export function ConfirmDialog() {
  const s = useVaultStore();
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState(false);
  const dlg = s.confirmDialog;

  if (!dlg) return null;

  function handleCancel() {
    dlg!.onCancel?.();
    s.closeConfirm();
  }

  async function handleConfirm() {
    setBusy(true);
    await dlg!.onConfirm();
    setBusy(false);
    s.closeConfirm();
  }

  const cancelBtn: React.CSSProperties = {
    flex: 1,
    textAlign: "center",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
    fontSize: 13.5,
    color: "var(--ink)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: "10px 14px",
  };
  const confirmBtn: React.CSSProperties = {
    flex: 1,
    textAlign: "center",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
    fontSize: 13.5,
    fontWeight: 500,
    color: "#fff",
    background: "#c15a3d",
    borderRadius: 9,
    padding: "10px 14px",
  };

  const card = (
    <>
      <div style={{ fontFamily: "var(--font-title, var(--font-spectral))", fontWeight: 600, fontSize: 17, color: "var(--ink)", marginBottom: 8 }}>{dlg.title}</div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>{dlg.message}</div>
      <div style={{ display: "flex", gap: 9 }}>
        <div onClick={busy ? undefined : handleCancel} style={cancelBtn}>
          Cancel
        </div>
        <div onClick={busy ? undefined : handleConfirm} style={confirmBtn}>
          {busy ? "…" : dlg.confirmLabel}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div onClick={() => !busy && handleCancel()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: "flex-end" }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            background: "var(--bg)",
            borderRadius: "16px 16px 0 0",
            padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -18px 44px -12px rgba(25,20,12,.4)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "0 0 12px" }}>
            <span style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
          </div>
          {card}
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => !busy && handleCancel()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: "90vw", background: "var(--bg)", borderRadius: 14, boxShadow: "0 30px 70px -18px rgba(50,40,25,.6)", padding: 20 }}
      >
        {card}
      </div>
    </div>
  );
}
