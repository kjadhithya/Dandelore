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

const SYNCED_IDS_KEY = "syncedNoteIds";

/** Note ids this device has confirmed exist remotely at least once — lets
 * pullAndMerge tell "never synced yet, push it up" apart from "was synced,
 * now missing remotely because another device deleted it, don't resurrect
 * it" for local notes that have no remote counterpart. */
async function getSyncedIds(): Promise<Set<string>> {
  const row = await localDb.settings.get(SYNCED_IDS_KEY);
  return new Set(Array.isArray(row?.value) ? (row!.value as string[]) : []);
}

async function addSyncedIds(ids: string[]) {
  if (!ids.length) return;
  const current = await getSyncedIds();
  ids.forEach((id) => current.add(id));
  await localDb.settings.put({ key: SYNCED_IDS_KEY, value: [...current] });
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
    // else: local is newer or equal — keep local, it will be pushed up below.
  }

  if (changed) {
    useVaultStore.setState({ notes: merged });
  }
  for (const note of toBackfill) {
    await backfillAttachments(vaultId, note);
  }

  // A local note missing from the remote set is either (a) never synced —
  // e.g. created offline, or dropped by the old debounce-loses-pending-push
  // bug — and needs pushing up now, since the normal push path only fires
  // on an in-session content change, not on "this note has no remote
  // counterpart"; or (b) was synced before and has since been deleted on
  // another device, in which case pushing it back up would resurrect a
  // deletion the user made elsewhere. getSyncedIds() tells these apart.
  const remoteIds = new Set(((remoteNotes || []) as RemoteNoteRow[]).map((r) => r.id));
  await addSyncedIds([...remoteIds]);
  const syncedIds = await getSyncedIds();
  const deletedElsewhere: string[] = [];
  const neverSynced: Note[] = [];
  for (const note of localNotes) {
    if (remoteIds.has(note.id)) continue;
    if (syncedIds.has(note.id)) deletedElsewhere.push(note.id);
    else neverSynced.push(note);
  }
  if (deletedElsewhere.length) {
    const removeSet = new Set(deletedElsewhere);
    useVaultStore.setState((s) => ({ notes: s.notes.filter((n) => !removeSet.has(n.id)) }));
  }
  for (const note of neverSynced) {
    await pushNote(vaultId, note);
  }
  await addSyncedIds(neverSynced.map((n) => n.id));

  if (remoteFolders) {
    const folderList = remoteFolders.map((f) => f.name);
    const folderParents: Record<string, string | null> = {};
    remoteFolders.forEach((f) => {
      folderParents[f.name] = f.parent;
    });
    useVaultStore.setState({ folderList, folderParents });
  }

  if (remoteCategories) {
    useVaultStore.setState({ categories: remoteCategories.map((c) => c.name) });
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

async function pushNoteDelete(vaultId: string, noteId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("notes").delete().eq("vault_id", vaultId).eq("id", noteId);
  if (error) {
    await localDb.mutationQueue.add({
      table: "notes",
      op: "delete",
      rowId: noteId,
      payload: null,
      createdAt: Date.now(),
    });
  }
}

/** Makes the remote `folders` table exactly match `folderList` — deletes rows
 * for folders no longer present locally, then upserts the rest. Folders have
 * no per-row modified timestamp, so unlike notes this sync is "local always
 * wins" rather than last-write-wins. */
async function pushFolders(vaultId: string, folderList: string[], folderParents: Record<string, string | null>) {
  const supabase = getSupabase();
  if (!supabase) return;
  if (folderList.length) {
    await supabase.from("folders").delete().eq("vault_id", vaultId).not("name", "in", `(${folderList.map((n) => `"${n}"`).join(",")})`);
    await supabase.from("folders").upsert(
      folderList.map((name) => ({ vault_id: vaultId, name, parent: folderParents[name] ?? null })),
      { onConflict: "vault_id,name" },
    );
  } else {
    await supabase.from("folders").delete().eq("vault_id", vaultId);
  }
}

async function pushCategories(vaultId: string, categories: string[]) {
  const supabase = getSupabase();
  if (!supabase) return;
  if (categories.length) {
    await supabase.from("categories").delete().eq("vault_id", vaultId).not("name", "in", `(${categories.map((n) => `"${n}"`).join(",")})`);
    await supabase.from("categories").upsert(
      categories.map((name) => ({ vault_id: vaultId, name })),
      { onConflict: "vault_id,name" },
    );
  } else {
    await supabase.from("categories").delete().eq("vault_id", vaultId);
  }
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
    if (m.table === "notes" && m.op === "delete") {
      const { error } = await supabase.from("notes").delete().eq("vault_id", vaultId).eq("id", m.rowId);
      if (error) continue;
    }
    if (m.id != null) await localDb.mutationQueue.delete(m.id);
  }
}

/** A debounced fn backed by a plain setTimeout has no durability — if the
 * tab is backgrounded or navigated away before the timer fires, the pending
 * call is silently lost. `.flush()` lets callers force it through right
 * away (wired to visibilitychange/pagehide below) instead of losing edits
 * whenever a device switches apps or closes the tab mid-debounce. */
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): { run: T; flush: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  let pending: never[] | null = null;
  const run = ((...args: never[]) => {
    pending = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      const a = pending;
      pending = null;
      if (a) fn(...a);
    }, ms);
  }) as T;
  const flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
    if (pending) {
      const a = pending;
      pending = null;
      fn(...a);
    }
  };
  return { run, flush };
}

/** No-ops entirely when Supabase isn't configured or no vault has been
 * resolved yet — the app must keep working purely local-first in that case.
 * `onReady` fires once the initial pull-and-merge from Supabase completes,
 * so callers can tell "no notes locally" apart from "haven't checked yet". */
export function startSyncWorker(onReady?: () => void): () => void {
  if (!isSupabaseConfigured()) {
    onReady?.();
    return () => {};
  }
  const vaultId = getCurrentVaultId();
  if (!vaultId) {
    onReady?.();
    return () => {};
  }

  let cancelled = false;
  let channel: RealtimeChannel | null = null;

  // One shared debounce instance would have its single pending call
  // overwritten every time a different note pushes in the same window —
  // exactly what happens importing several files at once, where every new
  // note fires a push synchronously in the same loop. Debounce per note id
  // instead so pushing note A then note B doesn't cancel A's push.
  const noteDebouncers = new Map<string, { run: (note: Note) => void; flush: () => void }>();
  const debouncedPushNote = {
    run(note: Note) {
      let d = noteDebouncers.get(note.id);
      if (!d) {
        d = debounce((n: Note) => pushNote(vaultId, n), 600);
        noteDebouncers.set(note.id, d);
      }
      d.run(note);
    },
    flush() {
      noteDebouncers.forEach((d) => d.flush());
    },
  };
  const debouncedPushFolders = debounce((folderList: string[], folderParents: Record<string, string | null>) => {
    pushFolders(vaultId, folderList, folderParents);
  }, 600);
  const debouncedPushCategories = debounce((categories: string[]) => {
    pushCategories(vaultId, categories);
  }, 600);

  let prevNotes = useVaultStore.getState().notes;
  let prevFolderList = useVaultStore.getState().folderList;
  let prevCategories = useVaultStore.getState().categories;
  let prevDeleteEvent = useVaultStore.getState().noteDeleteEvent;

  const unsubscribeStore = useVaultStore.subscribe((state) => {
    if (state.notes !== prevNotes) {
      const prevById = new Map(prevNotes.map((n) => [n.id, n]));
      state.notes.forEach((n) => {
        if (prevById.get(n.id) !== n) debouncedPushNote.run(n);
      });
      prevNotes = state.notes;
    }
    // Deletion is pushed off an explicit event from deleteNote/bulkDelete,
    // never inferred from the notes array getting shorter — pull, realtime
    // adds, and re-hydration all replace/shrink-then-grow that array too,
    // and diffing against it previously pushed phantom deletes to Supabase
    // for notes that were never actually deleted by the user.
    if (state.noteDeleteEvent !== prevDeleteEvent) {
      prevDeleteEvent = state.noteDeleteEvent;
      state.noteDeleteEvent?.ids.forEach((id) => pushNoteDelete(vaultId, id));
    }
    if (state.folderList !== prevFolderList) {
      debouncedPushFolders.run(state.folderList, state.folderParents);
      prevFolderList = state.folderList;
    }
    if (state.categories !== prevCategories) {
      debouncedPushCategories.run(state.categories);
      prevCategories = state.categories;
    }
  });

  // Backgrounding the tab (switching apps on mobile, switching tabs, closing)
  // must not silently drop a pending debounced push — flush it immediately.
  const flushPending = () => {
    debouncedPushNote.flush();
    debouncedPushFolders.flush();
    debouncedPushCategories.flush();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flushPending();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushPending);

  async function init() {
    await pullAndMerge(vaultId!);
    onReady?.();
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
    flushPending();
    unsubscribeStore();
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flushPending);
    if (channel) getSupabase()?.removeChannel(channel);
  };
}
