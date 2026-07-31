import { useVaultStore } from "@/lib/store/useVaultStore";
import { clearVaultContent } from "@/lib/db/localDb";
import { getCurrentVaultId } from "@/lib/supabase/session";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

/** Permanently deletes every note, folder, and category — locally, and in
 * Supabase too if this vault is synced. Notes cascade-delete their revisions
 * and attachment rows; nothing else in the account (auth, settings) is
 * touched. */
export async function clearVault(): Promise<void> {
  useVaultStore.getState().resetVaultContent();
  await clearVaultContent();

  const vaultId = getCurrentVaultId();
  if (vaultId && isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    await Promise.all([
      supabase.from("notes").delete().eq("vault_id", vaultId),
      supabase.from("folders").delete().eq("vault_id", vaultId),
      supabase.from("categories").delete().eq("vault_id", vaultId),
    ]);
  }
}
