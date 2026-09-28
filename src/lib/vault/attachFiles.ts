import { useVaultStore } from "@/lib/store/useVaultStore";
import { getCurrentVaultId } from "@/lib/supabase/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadAttachment } from "@/lib/supabase/attachments";

function readAsDataUrl(file: File): Promise<{ name: string; type: string; dataUrl: string }> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, type: file.type || "", dataUrl: String(r.result) });
    r.readAsDataURL(file);
  });
}

/** Shared by the "Attach file…" file input and pasting an image directly
 * into the editor — inserts `![[name]]` into the current note and uploads
 * to Supabase Storage when the vault is cloud-synced. `targetId` names the
 * note explicitly (the editor passes its own, which matters in the split
 * pane); without it the main pane's current note is used. */
export async function attachFilesToCurrentNote(files: File[], targetId?: string): Promise<void> {
  if (!files.length) return;
  const results = await Promise.all(files.map(readAsDataUrl));
  const noteId = targetId || useVaultStore.getState().curId();
  useVaultStore.getState().attachFiles(results, noteId || undefined);
  const vaultId = getCurrentVaultId();
  if (vaultId && noteId && isSupabaseConfigured()) {
    results.forEach((f) => uploadAttachment(vaultId, noteId, f));
  }
}
