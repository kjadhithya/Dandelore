const STORAGE_KEY = "kv-vault-key";
const VAULT_ID_KEY = "kv-vault-id";

export function generateVaultKey(): string {
  return "vk_" + crypto.randomUUID().replace(/-/g, "");
}

export function normalizeVaultKey(input: string): string {
  return input.trim();
}

export function isValidVaultKeyFormat(input: string): boolean {
  const v = normalizeVaultKey(input);
  return /^vk_[a-f0-9]{32}$/i.test(v);
}

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Deterministic, non-reversible synthetic email used only to authenticate
 * the vault key against Supabase's real email/password auth — never shown
 * to the user and never used for actual email delivery. */
export async function vaultKeyToEmail(vaultKey: string): Promise<string> {
  const hash = await sha256Hex(vaultKey);
  return `${hash.slice(0, 32)}@vault.local`;
}

export function getLocalVaultKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLocalVaultKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {}
}

export function clearLocalVaultKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** Ensures a vault key exists locally, generating one silently on first run
 * — no UI, nothing for the user to save. If Supabase is configured, also
 * links it to a Supabase-backed vault in the background so cross-device
 * sync works transparently if/when it's ever needed. */
export async function ensureVaultKeySilently(): Promise<string> {
  let key = getLocalVaultKey();
  if (!key) {
    key = generateVaultKey();
    setLocalVaultKey(key);
  }
  if (!getLocalVaultId()) {
    try {
      const { ensureSupabaseVault } = await import("@/lib/supabase/vaultAuth");
      const { isSupabaseConfigured } = await import("@/lib/supabase/client");
      if (isSupabaseConfigured()) {
        const res = await ensureSupabaseVault(key, "restore").catch(() => null);
        const created = res?.ok ? res : await ensureSupabaseVault(key, "create").catch(() => null);
        if (created?.ok && created.vaultId) setLocalVaultId(created.vaultId);
      }
    } catch {}
  }
  return key;
}

export function getLocalVaultId(): string | null {
  try {
    return localStorage.getItem(VAULT_ID_KEY);
  } catch {
    return null;
  }
}

export function setLocalVaultId(id: string): void {
  try {
    localStorage.setItem(VAULT_ID_KEY, id);
  } catch {}
}
