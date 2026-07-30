"use client";
import React, { useEffect, useState } from "react";
import {
  generateVaultKey,
  getLocalVaultKey,
  setLocalVaultKey,
  isValidVaultKeyFormat,
  normalizeVaultKey,
  setLocalVaultId,
} from "@/lib/vaultkey/vaultKey";
import { ensureSupabaseVault } from "@/lib/supabase/vaultAuth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { copyText } from "@/lib/store/useVaultStore";
import { CloseIcon } from "@/components/icons/Icons";

type Stage = "loading" | "choose" | "reveal" | "restore" | "ready";

export function VaultKeyGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [vaultKey, setVaultKey] = useState<string>("");
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = getLocalVaultKey();
    if (existing) {
      setVaultKey(existing);
      setStage("ready");
      if (isSupabaseConfigured()) {
        ensureSupabaseVault(existing, "restore")
          .then((res) => {
            if (res.ok && res.vaultId) setLocalVaultId(res.vaultId);
          })
          .catch(() => {});
      }
    } else {
      setStage("choose");
    }
  }, []);

  async function handleCreateNew() {
    const key = generateVaultKey();
    setVaultKey(key);
    setStage("reveal");
    if (isSupabaseConfigured()) {
      setBusy(true);
      const res = await ensureSupabaseVault(key, "create").catch(() => null);
      if (res?.ok && res.vaultId) setLocalVaultId(res.vaultId);
      setBusy(false);
    }
  }

  async function handleRestore() {
    const key = normalizeVaultKey(restoreInput);
    if (!isValidVaultKeyFormat(key)) {
      setRestoreError("That doesn't look like a valid Vault Key.");
      return;
    }
    setRestoreError(null);
    setBusy(true);
    if (isSupabaseConfigured()) {
      const res = await ensureSupabaseVault(key, "restore");
      setBusy(false);
      if (!res.ok) {
        setRestoreError("Vault Key not recognized. Check for typos.");
        return;
      }
      if (res.vaultId) setLocalVaultId(res.vaultId);
    } else {
      setBusy(false);
    }
    setLocalVaultKey(key);
    setVaultKey(key);
    setStage("ready");
  }

  function finishReveal() {
    setLocalVaultKey(vaultKey);
    setStage("ready");
  }

  if (stage === "loading") return null;

  if (stage === "ready") return <>{children}</>;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#1d1b17",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-ibm-plex-sans), system-ui, sans-serif",
      }}
    >
      <div style={{ width: 480, maxWidth: "92vw", background: "#faf5ea", borderRadius: 14, boxShadow: "0 30px 70px -18px rgba(0,0,0,.6)", overflow: "hidden" }}>
        {stage === "choose" && (
          <div style={{ padding: "32px 28px" }}>
            <div style={{ fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 22, color: "#3c3324", marginBottom: 8 }}>
              Welcome to Knowledge Vault
            </div>
            <div style={{ fontSize: 13.5, color: "#6f6552", lineHeight: 1.6, marginBottom: 24 }}>
              There are no accounts here — just a Vault Key. Create a new vault, or restore one you already have.
            </div>
            <div
              onClick={handleCreateNew}
              style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 500, color: "#fff", background: "#b0623b", borderRadius: 9, padding: "12px 16px", marginBottom: 10 }}
            >
              Create a new vault
            </div>
            <div
              onClick={() => setStage("restore")}
              style={{ cursor: "pointer", textAlign: "center", fontSize: 14, color: "#3c3324", border: "1px solid #ddd2bb", borderRadius: 9, padding: "12px 16px" }}
            >
              Restore with Vault Key
            </div>
          </div>
        )}

        {stage === "restore" && (
          <div style={{ padding: "32px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 22, color: "#3c3324" }}>Restore your vault</div>
              <div onClick={() => setStage("choose")} style={{ cursor: "pointer", color: "#8a7f6a" }}>
                <CloseIcon />
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: "#6f6552", lineHeight: 1.6, marginBottom: 18 }}>
              Enter the Vault Key you saved when you first created this vault.
            </div>
            <input
              autoFocus
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRestore();
              }}
              placeholder="vk_..."
              style={{
                width: "100%",
                border: `1px solid ${restoreError ? "#c15a3d" : "#ddd2bb"}`,
                background: "#f7f1e4",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13.5,
                color: "#3c3324",
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                marginBottom: 8,
              }}
            />
            {restoreError && <div style={{ fontSize: 12.5, color: "#c15a3d", marginBottom: 10 }}>{restoreError}</div>}
            <div
              onClick={busy ? undefined : handleRestore}
              style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, textAlign: "center", fontSize: 14, fontWeight: 500, color: "#fff", background: "#b0623b", borderRadius: 9, padding: "12px 16px", marginTop: 10 }}
            >
              {busy ? "Restoring…" : "Restore vault"}
            </div>
          </div>
        )}

        {stage === "reveal" && (
          <div style={{ padding: "32px 28px" }}>
            <div style={{ fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 22, color: "#3c3324", marginBottom: 8 }}>
              Your Vault Key
            </div>
            <div style={{ fontSize: 13.5, color: "#6f6552", lineHeight: 1.6, marginBottom: 18 }}>
              This is the <strong>only</strong> way to get back into this vault on another device. There is no
              password reset, no email recovery — if you lose it, your notes are unrecoverable. Save it somewhere safe
              now.
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#efe6d3",
                border: "1px solid #ddd2bb",
                borderRadius: 9,
                padding: "12px 14px",
                marginBottom: 18,
              }}
            >
              <code style={{ flex: 1, fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 13, color: "#3c3324", wordBreak: "break-all" }}>
                {vaultKey}
              </code>
              <div
                onClick={() => {
                  copyText(vaultKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }}
                style={{ cursor: "pointer", flex: "0 0 auto", fontSize: 12, fontWeight: 500, color: "#fff", background: "#b0623b", borderRadius: 6, padding: "6px 10px" }}
              >
                {copied ? "Copied!" : "Copy"}
              </div>
            </div>
            <div
              onClick={finishReveal}
              style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 500, color: "#fff", background: "#7d8a5f", borderRadius: 9, padding: "12px 16px" }}
            >
              I've saved my Vault Key — continue
            </div>
            {busy && <div style={{ fontSize: 11.5, color: "#a2977f", textAlign: "center", marginTop: 10 }}>Setting up cloud sync…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
