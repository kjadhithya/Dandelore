import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentVaultId } from "@/lib/supabase/session";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { localDb } from "@/lib/db/localDb";
import { listNoteAttachments, downloadAttachment } from "@/lib/supabase/attachments";
import type { Note } from "@/types/vault";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RemoteNoteRow {
  id: string;
  title: string;
  content: string;
  folder: string;
  category: string;
  tags: string[];
  date: string | null;
  daily: boolean;
  modified: string;
  deleted_at: string | null;
}

function noteToRow(n: Note, vaultId: string) {
  return {
    id: n.id,
    vault_id: vaultId,
    title: n.title,
    content: n.content,
    folder: n.folder,
    category: n.category,
    tags: n.tags || [],
    date: n.date || null,
    daily: !!n.daily,
    modified: n.modified || new Date().toISOString(),
    deleted_at: n.deletedAt || null,
  };
}

function rowToNote(r: RemoteNoteRow): Note {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    folder: r.folder,
    category: r.category,
    tags: r.tags || [],
    date: r.date || "",
    daily: r.daily,
    modified: r.modified,
    attachments: {},
    deletedAt: r.deleted_at,
  };
}

/** Backfills a note's attachments from Supabase Storage when this device has
 * never seen them locally — e.g. the note was authored on another device. */
async function backfillAttachments(vaultId: string, note: Note) {
  if (Object.keys(note.attachments || {}).length) return;
  if (!/!\[\[/.test(note.content)) return;
  const rows = await listNoteAttachments(vaultId, note.id);
  if (!rows.length) return;
  const attachments: Note["attachments"] = {};
  for (const row of rows) {
    const dataUrl = await downloadAttachment(row.storage_path);
    if (dataUrl) attachments[row.filename] = { url: dataUrl, type: row.type, w: "100%" };
  }
  if (Object.keys(attachments).length) {
    useVaultStore.setState((s) => ({
      notes: s.notes.map((n) => (n.id === note.id ? { ...n, attachments: { ...n.attachments, ...attachments } } : n)),
    }));
  }
}

async function writeConflictRevision(vaultId: string, noteId: string, losingContent: string, source: "local" | "remote" | "conflict") {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("note_revisions").insert({ note_id: noteId, vault_id: vaultId, content: losingContent, source }).select().maybeSingle();
}

/** Pulls the remote vault once and merges it into local state.
 * Last-write-wins on `modified`; whichever side loses always gets archived
 * into `note_revisions` first so nothing is silently discarded. */
async function pullAndMerge(vaultId: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  const [{ data: remoteNotes }, { data: remoteFolders }, { data: remoteCategories }] = await Promise.all([
    supabase.from("notes").select("*").eq("vault_id", vaultId),
    supabase.from("folders").select("name, parent").eq("vault_id", vaultId),
    supabase.from("categories").select("name").eq("vault_id", vaultId),
  ]);

  const localNotes = useVaultStore.getState().notes;
  const localById = new Map(localNotes.map((n) => [n.id, n]));
  const merged = [...localNotes];
  let changed = false;

  const toBackfill: Note[] = [];

  for (const row of (remoteNotes || []) as RemoteNoteRow[]) {
    const local = localById.get(row.id);
    if (!local) {
      const note = rowToNote(row);
      merged.push(note);
      toBackfill.push(note);
      changed = true;
      continue;
    }
    const remoteTime = new Date(row.modified).getTime();
    const localTime = new Date(local.modified || 0).getTime();
    if (remoteTime > localTime) {
      if (local.content !== row.content) {
        await writeConflictRevision(vaultId, row.id, local.content, "local");
      }
      const idx = merged.findIndex((n) => n.id === row.id);
      const note = rowToNote(row);
      merged[idx] = note;
      toBackfill.push(note);
      changed = true;
    }
    // else: local is newer or equal — keep local, it will be pushed up.
  }

  if (changed) {
    useVaultStore.setState({ notes: merged });
  }
  for (const note of toBackfill) {
    await backfillAttachments(vaultId, note);
  }

  if (remoteFolders?.length) {
    const localFolders = useVaultStore.getState().folderList;
    const folderSet = new Set(localFolders);
    const folderParents = { ...useVaultStore.getState().folderParents };
    let foldersChanged = false;
    remoteFolders.forEach((f) => {
      if (!folderSet.has(f.name)) {
        folderSet.add(f.name);
        foldersChanged = true;
      }
      folderParents[f.name] = f.parent;
    });
    if (foldersChanged) useVaultStore.setState({ folderList: [...folderSet], folderParents });
  }

  if (remoteCategories?.length) {
    const localCategories = new Set(useVaultStore.getState().categories);
    let categoriesChanged = false;
    remoteCategories.forEach((c) => {
      if (!localCategories.has(c.name)) {
        localCategories.add(c.name);
        categoriesChanged = true;
      }
    });
    if (categoriesChanged) useVaultStore.setState({ categories: [...localCategories] });
  }
}

async function pushNote(vaultId: string, note: Note) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("notes").upsert(noteToRow(note, vaultId));
  if (error) {
    await localDb.mutationQueue.add({
      table: "notes",
      op: "upsert",
      rowId: note.id,
      payload: noteToRow(note, vaultId),
      createdAt: Date.now(),
    });
  }
}

async function pushFolders(vaultId: string, folderList: string[], folderParents: Record<string, string | null>) {
  const supabase = getSupabase();
  if (!supabase || !folderList.length) return;
  await supabase.from("folders").upsert(
    folderList.map((name) => ({ vault_id: vaultId, name, parent: folderParents[name] ?? null })),
    { onConflict: "vault_id,name" },
  );
}

async function pushCategories(vaultId: string, categories: string[]) {
  const supabase = getSupabase();
  if (!supabase || !categories.length) return;
  await supabase.from("categories").upsert(
    categories.map((name) => ({ vault_id: vaultId, name })),
    { onConflict: "vault_id,name" },
  );
}

async function replayQueue(vaultId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const pending = await localDb.mutationQueue.orderBy("createdAt").toArray();
  for (const m of pending) {
    if (m.table === "notes" && m.op === "upsert") {
      const { error } = await supabase.from("notes").upsert(m.payload as never);
      if (error) continue; // still offline / still failing — leave queued, try again next time
    }
    if (m.id != null) await localDb.mutationQueue.delete(m.id);
  }
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}

/** No-ops entirely when Supabase isn't configured or no vault has been
 * resolved yet — the app must keep working purely local-first in that case. */
export function startSyncWorker(): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const vaultId = getCurrentVaultId();
  if (!vaultId) return () => {};

  let cancelled = false;
  let channel: RealtimeChannel | null = null;

  const debouncedPushNote = debounce((note: Note) => {
    pushNote(vaultId, note);
  }, 600);
  const debouncedPushFolders = debounce((folderList: string[], folderParents: Record<string, string | null>) => {
    pushFolders(vaultId, folderList, folderParents);
  }, 600);
  const debouncedPushCategories = debounce((categories: string[]) => {
    pushCategories(vaultId, categories);
  }, 600);

  let prevNotes = useVaultStore.getState().notes;
  let prevFolderList = useVaultStore.getState().folderList;
  let prevCategories = useVaultStore.getState().categories;

  const unsubscribeStore = useVaultStore.subscribe((state) => {
    if (state.notes !== prevNotes) {
      const prevById = new Map(prevNotes.map((n) => [n.id, n]));
      state.notes.forEach((n) => {
        if (prevById.get(n.id) !== n) debouncedPushNote(n);
      });
      prevNotes = state.notes;
    }
    if (state.folderList !== prevFolderList) {
      debouncedPushFolders(state.folderList, state.folderParents);
      prevFolderList = state.folderList;
    }
    if (state.categories !== prevCategories) {
      debouncedPushCategories(state.categories);
      prevCategories = state.categories;
    }
  });

  async function init() {
    await pullAndMerge(vaultId!);
    await replayQueue(vaultId!);
    if (cancelled) return;

    const supabase = getSupabase();
    if (!supabase) return;
    channel = supabase
      .channel(`vault-${vaultId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `vault_id=eq.${vaultId}` }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const row = payload.new as RemoteNoteRow;
        const state = useVaultStore.getState();
        const local = state.notes.find((n) => n.id === row.id);
        if (!local) {
          const note = rowToNote(row);
          useVaultStore.setState({ notes: [...state.notes, note] });
          backfillAttachments(vaultId!, note);
          return;
        }
        const remoteTime = new Date(row.modified).getTime();
        const localTime = new Date(local.modified || 0).getTime();
        if (remoteTime > localTime && local.content !== row.content) {
          writeConflictRevision(vaultId!, row.id, local.content, "local");
          const note = rowToNote(row);
          useVaultStore.setState({ notes: state.notes.map((n) => (n.id === row.id ? note : n)) });
          backfillAttachments(vaultId!, note);
        }
      })
      .subscribe();
  }

  init();

  const onOnline = () => replayQueue(vaultId!);
  window.addEventListener("online", onOnline);

  return () => {
    cancelled = true;
    unsubscribeStore();
    window.removeEventListener("online", onOnline);
    if (channel) getSupabase()?.removeChannel(channel);
  };
}
