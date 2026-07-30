import { getSupabase } from "./client";
import { sha256Hex, vaultKeyToEmail } from "@/lib/vaultkey/vaultKey";

export interface VaultAuthResult {
  ok: boolean;
  vaultId: string | null;
  error?: string;
}

/**
 * Creates (or signs into) a Supabase-backed vault for the given Vault Key.
 *
 * There's no real login UI in this app — the Vault Key itself is the only
 * credential the user ever sees. Under the hood we use Supabase's normal
 * email/password auth so Postgres RLS can key off `auth.uid()` without any
 * custom Postgres wiring: the "email" is a deterministic hash of the vault
 * key (never a real address) and the "password" is the vault key itself.
 * This is transparent to the user and only touches this file.
 */
export async function ensureSupabaseVault(vaultKey: string, mode: "create" | "restore"): Promise<VaultAuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, vaultId: null, error: "Supabase not configured" };

  const email = await vaultKeyToEmail(vaultKey);
  const password = vaultKey;

  if (mode === "restore") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, vaultId: null, error: error?.message || "Vault Key not found" };
    return resolveVaultId(data.user.id, vaultKey);
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) return { ok: false, vaultId: null, error: error?.message || "Could not create vault" };
  return resolveVaultId(data.user.id, vaultKey);
}

async function resolveVaultId(ownerId: string, vaultKey: string): Promise<VaultAuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, vaultId: null, error: "Supabase not configured" };

  const { data: existing, error: selErr } = await supabase.from("vaults").select("id").eq("owner_id", ownerId).maybeSingle();
  if (selErr) return { ok: false, vaultId: null, error: selErr.message };
  if (existing) return { ok: true, vaultId: existing.id };

  const vaultKeyHash = await sha256Hex(vaultKey);
  const { data: created, error: insErr } = await supabase
    .from("vaults")
    .insert({ owner_id: ownerId, vault_key_hash: vaultKeyHash })
    .select("id")
    .single();
  if (insErr || !created) return { ok: false, vaultId: null, error: insErr?.message || "Could not create vault row" };
  return { ok: true, vaultId: created.id };
}

export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
