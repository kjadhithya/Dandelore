import { getSupabase } from "./client";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Uploads an attachment already stored locally (as a base64 data URL) to
 * Supabase Storage, and records it in the `attachments` table. Fire-and-forget
 * from the caller's perspective — local rendering never depends on this
 * succeeding, since the data URL already works fully offline. */
export async function uploadAttachment(
  vaultId: string,
  noteId: string,
  file: { name: string; type: string; dataUrl: string },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const path = `${vaultId}/${noteId}/${file.name}`;
  const blob = dataUrlToBlob(file.dataUrl);
  const { error: uploadError } = await supabase.storage.from("attachments").upload(path, blob, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (uploadError) return;
  await supabase.from("attachments").upsert(
    { vault_id: vaultId, note_id: noteId, storage_path: path, type: file.type || "", filename: file.name },
    { onConflict: "vault_id,note_id,storage_path" },
  );
}

/** Fetches an attachment back down as a data URL — used to backfill a note's
 * attachments on a fresh device where the local IndexedDB cache is empty. */
export async function downloadAttachment(storagePath: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("attachments").download(storagePath);
  if (error || !data) return null;
  return blobToDataUrl(data);
}

export async function listNoteAttachments(
  vaultId: string,
  noteId: string,
): Promise<{ filename: string; type: string; storage_path: string }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("attachments").select("filename, type, storage_path").eq("vault_id", vaultId).eq("note_id", noteId);
  if (error || !data) return [];
  return data;
}
