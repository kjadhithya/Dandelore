"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { updatePassword } from "@/lib/supabase/vaultAuth";

type Stage = "checking" | "ready" | "invalid" | "done";

const card: React.CSSProperties = {
  width: 400,
  maxWidth: "92vw",
  background: "#faf5ea",
  borderRadius: 14,
  boxShadow: "0 30px 70px -18px rgba(0,0,0,.6)",
  overflow: "hidden",
  padding: "32px 28px",
  fontFamily: "var(--font-ibm-plex-sans), system-ui, sans-serif",
};
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #ddd2bb",
  background: "#f7f1e4",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13.5,
  color: "#3c3324",
  marginBottom: 10,
};
const primaryBtn: React.CSSProperties = {
  cursor: "pointer",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 500,
  color: "#fff",
  background: "#b0623b",
  borderRadius: 9,
  padding: "12px 16px",
  marginTop: 4,
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStage("invalid");
      return;
    }
    const supabase = getSupabase()!;
    supabase.auth.getSession().then(({ data }) => {
      setStage(data.session ? "ready" : "invalid");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("ready");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit() {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Could not update your password.");
      return;
    }
    setStage("done");
    setTimeout(() => router.push("/"), 1500);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#1d1b17", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={card}>
        {stage === "checking" && (
          <div style={{ fontSize: 13.5, color: "#6f6552" }}>Checking your reset link…</div>
        )}
        {stage === "invalid" && (
          <>
            <div style={{ fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 20, color: "#3c3324", marginBottom: 8 }}>
              This link isn&apos;t valid
            </div>
            <div style={{ fontSize: 13.5, color: "#6f6552", lineHeight: 1.6 }}>
              Reset links expire after a while, or may have already been used. Go back and request a new one from the
              sign-in screen.
            </div>
          </>
        )}
        {stage === "ready" && (
          <>
            <div style={{ fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 20, color: "#3c3324", marginBottom: 16 }}>
              Set a new password
            </div>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              style={input}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Confirm new password"
              style={input}
            />
            {error && <div style={{ fontSize: 12.5, color: "#c15a3d", marginBottom: 10 }}>{error}</div>}
            <div onClick={busy ? undefined : handleSubmit} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
              {busy ? "Updating…" : "Update password"}
            </div>
          </>
        )}
        {stage === "done" && (
          <div style={{ fontSize: 13.5, color: "#7d8a5f" }}>Password updated — taking you back to the app…</div>
        )}
      </div>
    </div>
  );
}
