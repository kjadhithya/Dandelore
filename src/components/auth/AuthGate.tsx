"use client";
import React, { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { signUpWithEmail, signInWithEmail, requestPasswordReset, ensureVaultRow } from "@/lib/supabase/vaultAuth";
import { setCurrentVaultId } from "@/lib/supabase/session";
import { DandelionField } from "./DandelionField";

type Stage = "loading" | "signedOut" | "ready" | "unconfigured";
type Mode = "signin" | "signup" | "forgot";

const SANS = "var(--font-ibm-plex-sans), system-ui, sans-serif";
const SERIF = "var(--font-spectral), Georgia, serif";

const card: React.CSSProperties = {
  position: "relative",
  width: 380,
  maxWidth: "calc(100vw - 32px)",
  background: "rgba(34, 30, 27, 0.93)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderRadius: 14,
  boxShadow: "0 30px 80px -24px rgba(46, 15, 3, 0.55)",
  overflow: "hidden",
  padding: "32px 28px 0",
  fontFamily: SANS,
  color: "#fff",
  textAlign: "center",
};

// Focus ring, placeholder and hover states can't be expressed inline.
const authCss = `
.auth-input {
  display: block; width: 100%; box-sizing: border-box; margin-bottom: 12px;
  padding: 13px 16px; font: 400 14px/1.3 ${SANS}; color: #fff;
  background: rgba(255, 255, 255, 0.09); border: 1.5px solid transparent; border-radius: 12px;
  outline: none; transition: border-color .15s;
}
.auth-input::placeholder { color: rgba(255, 255, 255, 0.4); }
.auth-input:focus { border-color: #b0623b; }
.auth-primary {
  display: block; width: 100%; margin: 8px 0 24px; padding: 12px 16px;
  font: 600 14px/1.2 ${SANS}; color: #fff; background: #cc7a4f; border: 0; border-radius: 8px;
  cursor: pointer; transition: background-color .12s;
}
.auth-primary:hover:not(:disabled) { background: #b86b42; }
.auth-primary:disabled { opacity: .6; cursor: default; }
.auth-link { cursor: pointer; color: #fff; font-weight: 600; }
.auth-link:hover { color: #ffa56b; }
.auth-forgot { cursor: pointer; font-size: 12.5px; color: rgba(255, 255, 255, 0.6); }
.auth-forgot:hover { color: #fff; }
`;

function LogoTile() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="Dandelore" width={42} height={44} />
    </div>
  );
}

function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto" }}>
      <style>{authCss}</style>
      <DandelionField />
      <div style={{ position: "relative", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0", pointerEvents: "none" }}>
        <div style={{ ...card, pointerEvents: "auto" }}>
          {/* Warm glow behind the button, like light through the card. */}
          <div
            aria-hidden
            style={{
              position: "absolute", left: "50%", bottom: -60, width: 300, height: 200, transform: "translateX(-50%)",
              background: "radial-gradient(closest-side, rgba(255, 90, 20, 0.32), transparent)", pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const title: React.CSSProperties = { fontFamily: SERIF, fontWeight: 600, fontSize: 26, lineHeight: 1.2, color: "#fff", marginBottom: 10 };
const subtle: React.CSSProperties = { fontSize: 13.5, color: "rgba(255, 255, 255, 0.72)", lineHeight: 1.6, marginBottom: 20 };
const footer: React.CSSProperties = {
  margin: "0 -28px", padding: "16px 20px 18px", borderTop: "1px solid rgba(255, 255, 255, 0.1)",
  display: "flex", justifyContent: "center", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 13.5,
};
const footerMuted: React.CSSProperties = { color: "rgba(255, 255, 255, 0.6)" };

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
      <AuthScreen>
        <LogoTile />
        <div style={title}>Supabase isn&apos;t configured</div>
        <div style={{ ...subtle, marginBottom: 28 }}>
          Sign-in needs a Supabase project connected via <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </div>
      </AuthScreen>
    );
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  return (
    <AuthScreen>
      <LogoTile />
      <div style={{ ...title, marginBottom: mode === "forgot" ? 10 : 24 }}>
        {mode === "signin" && "Welcome back"}
        {mode === "signup" && "Welcome to Dandelore"}
        {mode === "forgot" && "Reset your password"}
      </div>
      {mode === "forgot" && (
        <div style={subtle}>Enter your email and we&apos;ll send you a link to set a new password.</div>
      )}

      <input
        className="auth-input"
        type="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      {mode !== "forgot" && (
        <input
          className="auth-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Password"
        />
      )}
      {mode === "signin" && (
        <div style={{ textAlign: "right", margin: "-4px 2px 10px" }}>
          <span className="auth-forgot" onClick={() => switchMode("forgot")}>
            Forgot password?
          </span>
        </div>
      )}
      {mode === "signup" && (
        <input
          className="auth-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Confirm password"
        />
      )}

      {error && <div style={{ fontSize: 13, color: "#ffab94", margin: "2px 0 10px", textAlign: "left" }}>{error}</div>}
      {notice && <div style={{ fontSize: 13, color: "#c6dd9c", margin: "2px 0 10px", textAlign: "left" }}>{notice}</div>}

      <button type="button" className="auth-primary" disabled={busy} onClick={handleSubmit}>
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
      </button>

      <div style={footer}>
        {mode === "signin" && (
          <>
            <span style={footerMuted}>Don&apos;t have an account?</span>
            <span className="auth-link" onClick={() => switchMode("signup")}>
              Sign up
            </span>
          </>
        )}
        {mode === "signup" && (
          <>
            <span style={footerMuted}>Already have an account?</span>
            <span className="auth-link" onClick={() => switchMode("signin")}>
              Log In
            </span>
          </>
        )}
        {mode === "forgot" && (
          <span className="auth-link" onClick={() => switchMode("signin")}>
            ← Back to sign in
          </span>
        )}
      </div>
    </AuthScreen>
  );
}
