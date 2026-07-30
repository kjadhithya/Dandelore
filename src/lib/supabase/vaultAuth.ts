import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./client";

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}

export interface VaultResult {
  ok: boolean;
  vaultId: string | null;
  error?: string;
}

function resetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user ?? undefined };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user ?? undefined };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, user: data.user ?? undefined };
}

export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Every signed-in user gets exactly one `vaults` row, created on first
 * sign-in. All other tables key off `vaults.id` via RLS. */
export async function ensureVaultRow(ownerId: string): Promise<VaultResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, vaultId: null, error: "Supabase not configured" };

  const { data: existing, error: selErr } = await supabase.from("vaults").select("id").eq("owner_id", ownerId).maybeSingle();
  if (selErr) return { ok: false, vaultId: null, error: selErr.message };
  if (existing) return { ok: true, vaultId: existing.id };

  const { data: created, error: insErr } = await supabase.from("vaults").insert({ owner_id: ownerId }).select("id").single();
  if (insErr || !created) return { ok: false, vaultId: null, error: insErr?.message || "Could not create vault row" };
  return { ok: true, vaultId: created.id };
}
