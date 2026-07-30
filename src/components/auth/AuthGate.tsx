"use client";
import React, { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { signUpWithEmail, signInWithEmail, requestPasswordReset, ensureVaultRow } from "@/lib/supabase/vaultAuth";
import { setCurrentVaultId } from "@/lib/supabase/session";

type Stage = "loading" | "signedOut" | "ready" | "unconfigured";
type Mode = "signin" | "signup" | "forgot";

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

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStage("unconfigured");
      return;
    }
    const supabase = getSupabase()!;

    async function resolve(userId: string) {
      const res = await ensureVaultRow(userId);
      if (res.ok && res.vaultId) {
        setCurrentVaultId(res.vaultId);
        setStage("ready");
      } else {
        setError(res.error || "Could not set up your vault.");
        setStage("signedOut");
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) resolve(data.session.user.id);
      else setStage("signedOut");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) resolve(session.user.id);
      else if (event === "SIGNED_OUT") {
        setCurrentVaultId(null);
        setStage("signedOut");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit() {
    setError(null);
    if (mode === "forgot") {
      if (!email.trim()) {
        setError("Enter your email first.");
        return;
      }
      setBusy(true);
      const res = await requestPasswordReset(email.trim());
      setBusy(false);
      if (!res.ok) {
        setError(res.error || "Could not send reset email.");
        return;
      }
      setNotice("Check your email for a password reset link.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const res = mode === "signup" ? await signUpWithEmail(email.trim(), password) : await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Something went wrong.");
      return;
    }
    if (mode === "signup" && !res.user?.confirmed_at && !res.user?.email_confirmed_at) {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signin");
    }
    // onAuthStateChange handles the transition to "ready" if a session was returned.
  }

  if (stage === "loading") return null;
  if (stage === "ready") return <>{children}</>;

  if (stage === "unconfigured") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#1d1b17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={card}>
          <div style={{ fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 20, color: "#3c3324", marginBottom: 8 }}>
            Supabase isn&apos;t configured
          </div>
          <div style={{ fontSize: 13.5, color: "#6f6552", lineHeight: 1.6 }}>
            Sign-in needs a Supabase project connected via <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#1d1b17", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={card}>
        <div style={{ fontFamily: "var(--font-spectral), serif", fontWeight: 600, fontSize: 22, color: "#3c3324", marginBottom: 8 }}>
          {mode === "signin" && "Sign in"}
          {mode === "signup" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
        </div>
        {mode === "forgot" && (
          <div style={{ fontSize: 13.5, color: "#6f6552", lineHeight: 1.6, marginBottom: 16 }}>
            Enter your email and we&apos;ll send you a link to set a new password.
          </div>
        )}

        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={input}
        />
        {mode !== "forgot" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Password"
            style={input}
          />
        )}
        {mode === "signup" && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Confirm password"
            style={input}
          />
        )}

        {error && <div style={{ fontSize: 12.5, color: "#c15a3d", marginBottom: 10 }}>{error}</div>}
        {notice && <div style={{ fontSize: 12.5, color: "#7d8a5f", marginBottom: 10 }}>{notice}</div>}

        <div onClick={busy ? undefined : handleSubmit} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12.5, color: "#8a7f6a" }}>
          {mode === "signin" && (
            <>
              <span
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setNotice(null);
                }}
                style={{ cursor: "pointer" }}
              >
                Create an account
              </span>
              <span
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setNotice(null);
                }}
                style={{ cursor: "pointer" }}
              >
                Forgot password?
              </span>
            </>
          )}
          {mode !== "signin" && (
            <span
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              style={{ cursor: "pointer" }}
            >
              ← Back to sign in
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
