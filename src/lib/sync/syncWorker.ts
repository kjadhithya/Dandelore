import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentVaultId } from "@/lib/supabase/session";
import { useVaultStore } from "@/lib/store/useVaultStore";
import { localDb } from "@/lib/db/localDb";
import { listNoteAttachments, downloadAttachment } from "@/lib/supabase/attachments";
import { normalizeLineEndings } from "@/lib/text";
import type { Note } from "@/types/vault";
import { useGraphSettings, GRAPH_DEFAULTS, type GraphSettings, type GraphBookmark } from "@/lib/graph/graphSettings";
import type { RealtimeChannel } from "@supabase/supabase-js";

/* Folders/categories are whole-list syncs with no per-row timestamps, which
 * made two things go wrong. Applying a pulled list looked like a local edit,
 * so every pull pushed the same list straight back (with realtime on, that
 * push's own events triggered another pull — an endless loop). And a pull
 * landing between a local edit and its debounced push overwrote the edit
 * and then pushed the stale list, which is how a deleted category kept
 * coming back. `applyingRemoteLists` marks pull-applied lists so the store
 * subscriber doesn't echo them; the version counters keep a pull from
 * clobbering a local edit that hasn't been pushed yet. */
let applyingRemoteLists = false;
let folderVersion = 0;
let folderPushedVersion = 0;
let categoryVersion = 0;
let categoryPushedVersion = 0;

function applyRemoteFolders(remoteFolders: { name: string; parent: string | null }[]) {
  if (folderVersion !== folderPushedVersion) return;
  const folderList = remoteFolders.map((f) => f.name);
  const folderParents: Record<string, string | null> = {};
  remoteFolders.forEach((f) => {
    folderParents[f.name] = f.parent;
  });
  applyingRemoteLists = true;
  try {
    useVaultStore.setState({ folderList, folderParents });
  } finally {
    applyingRemoteLists = false;
  }
}

function applyRemoteCategories(remoteCategories: { name: string }[]) {
  if (categoryVersion !== categoryPushedVersion) return;
  applyingRemoteLists = true;
  try {
    useVaultStore.setState({ categories: remoteCategories.map((c) => c.name) });
  } finally {
    applyingRemoteLists = false;
  }
}

/** PostgREST `in` list with each value double-quoted and escaped, so names
 * containing quotes, commas or parentheses don't break the filter. */
function quotedList(names: string[]): string {
  return `(${names.map((n) => `"${n.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
}

interface RemoteNoteRow {
  id: string;
  title: string;
  content: string;
  folder: string;
  category: string;
  tags: string[];
  date: string | null;
  daily: boolean;
  bookmarked: boolean;
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
    bookmarked: !!n.bookmarked,
    modified: n.modified || new Date().toISOString(),
    deleted_at: n.deletedAt || null,
  };
}

function rowToNote(r: RemoteNoteRow): Note {
  return {
    id: r.id,
    title: r.title,
    content: normalizeLineEndings(r.content),
    folder: r.folder,
    category: r.category,
    tags: r.tags || [],
    date: r.date || "",
    daily: r.daily,
    bookmarked: !!r.bookmarked,
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

  const [notesRes, foldersRes, categoriesRes] = await Promise.all([
    supabase.from("notes").select("*").eq("vault_id", vaultId),
    supabase.from("folders").select("name, parent").eq("vault_id", vaultId),
    supabase.from("categories").select("name").eq("vault_id", vaultId),
  ]);
  const firstError = notesRes.error || foldersRes.error || categoriesRes.error;
  if (firstError) reportSyncError("Loading vault", firstError.message);
  else clearSyncError();
  const { data: remoteNotes } = notesRes;
  const { data: remoteFolders } = foldersRes;
  const { data: remoteCategories } = categoriesRes;

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
  // Only mark a note as "confirmed synced" once its push actually
  // succeeds — marking it unconditionally meant a note whose push kept
  // failing (an RLS rejection, a transient network error, anything)
  // would get treated as "synced, then deleted elsewhere" on the very
  // next pull cycle and be wiped from local state, even though it was
  // never actually deleted anywhere and never made it to the server.
  const actuallySynced: string[] = [];
  for (const note of neverSynced) {
    if (await pushNote(vaultId, note)) actuallySynced.push(note.id);
  }
  await addSyncedIds(actuallySynced);

  if (remoteFolders) applyRemoteFolders(remoteFolders);
  if (remoteCategories) applyRemoteCategories(remoteCategories);
}

/** Re-fetches just folders/categories, for the realtime handlers below —
 * a full pullAndMerge would also re-check every note on a one-row folder
 * rename. Folders/categories have no per-row modified timestamp, so this
 * is a straight overwrite from remote, same as pullAndMerge's own copy of
 * this logic. */
async function pullFoldersAndCategories(vaultId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const [{ data: remoteFolders }, { data: remoteCategories }] = await Promise.all([
    supabase.from("folders").select("name, parent").eq("vault_id", vaultId),
    supabase.from("categories").select("name").eq("vault_id", vaultId),
  ]);
  if (remoteFolders) applyRemoteFolders(remoteFolders);
  if (remoteCategories) applyRemoteCategories(remoteCategories);
}

/** Surfaces the last Supabase push/pull failure in Settings — errors here
 * were previously silent (queued for retry at best), so a persistent
 * schema mismatch or RLS rejection gave no visible signal that anything
 * was wrong at all. */
function reportSyncError(context: string, message: string | undefined | null) {
  useVaultStore.setState({ syncError: `${context}: ${message || "unknown error"}` });
}
function clearSyncError() {
  if (useVaultStore.getState().syncError) useVaultStore.setState({ syncError: null });
}

async function pushNote(vaultId: string, note: Note): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("notes").upsert(noteToRow(note, vaultId));
  if (error) {
    reportSyncError("Saving note", error.message);
    await localDb.mutationQueue.add({
      table: "notes",
      op: "upsert",
      rowId: note.id,
      payload: noteToRow(note, vaultId),
      createdAt: Date.now(),
    });
  } else {
    clearSyncError();
  }
  return !error;
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
async function pushFolders(vaultId: string, folderList: string[], folderParents: Record<string, string | null>): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  let error;
  if (folderList.length) {
    ({ error } = await supabase.from("folders").delete().eq("vault_id", vaultId).not("name", "in", quotedList(folderList)));
    if (!error) {
      ({ error } = await supabase.from("folders").upsert(
        folderList.map((name) => ({ vault_id: vaultId, name, parent: folderParents[name] ?? null })),
        { onConflict: "vault_id,name" },
      ));
    }
  } else {
    ({ error } = await supabase.from("folders").delete().eq("vault_id", vaultId));
  }
  if (error) reportSyncError("Saving folders", error.message);
  return !error;
}

async function pushCategories(vaultId: string, categories: string[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  let error;
  if (categories.length) {
    ({ error } = await supabase.from("categories").delete().eq("vault_id", vaultId).not("name", "in", quotedList(categories)));
    if (!error) {
      ({ error } = await supabase.from("categories").upsert(
        categories.map((name) => ({ vault_id: vaultId, name })),
        { onConflict: "vault_id,name" },
      ));
    }
  } else {
    ({ error } = await supabase.from("categories").delete().eq("vault_id", vaultId));
  }
  if (error) reportSyncError("Saving categories", error.message);
  return !error;
}

interface RemoteSettingsRow {
  theme: string;
  accent_color: string;
  app_font: string;
  note_font: string;
  title_font: string;
  sort: string;
  pinned_categories: string[];
  graph_settings?: Partial<GraphSettings> | null;
  graph_bookmarks?: GraphBookmark[] | null;
}

/** Set while a settings row from the server is being applied, so the store
 * subscription doesn't push that same row straight back. */
let applyingRemoteSettings = false;
/** A local graph change is waiting to be pushed; until it lands, a pull
 * mustn't overwrite it with the older server copy. */
let graphPushPending = false;

function graphIsDefault(g: GraphSettings): boolean {
  return JSON.stringify(g) === JSON.stringify(GRAPH_DEFAULTS);
}

/** Appearance prefs used to live in localStorage only, so they never
 * followed the user across devices — opening the vault on a second device
 * always showed the default theme/fonts. One row per vault, applied on top
 * of (and afterwards keeping in sync with) whatever localStorage already
 * set for this device. */
function settingsToRow(vaultId: string) {
  const s = useVaultStore.getState();
  return {
    vault_id: vaultId,
    theme: s.themeOverride || "Light Warm",
    accent_color: s.accentOverride || "#b0623b",
    app_font: s.appFont,
    note_font: s.noteFont,
    title_font: s.titleFont,
    sort: s.sort,
    pinned_categories: s.pinnedCategories,
    graph_settings: useGraphSettings.getState().settings,
    graph_bookmarks: useGraphSettings.getState().bookmarks,
  };
}

function applySettingsRow(row: RemoteSettingsRow) {
  // pinned_categories has no per-field modified timestamp — it's one column
  // in a whole-row overwrite, same as theme/fonts. That's fine for fields
  // that always have a sensible value, but pinned_categories was a brand
  // new synced field: the very first pull after it shipped (or before the
  // migration adding the column has even been run, where it comes back
  // undefined) sees an empty/missing remote value despite this device
  // already having real, never-yet-pushed pins locally. Applying it
  // unconditionally wiped them on every reload. Only take the remote list
  // when it actually has something in it, or when local has nothing to
  // lose either way — pullSettings below re-pushes to correct a stale
  // remote in the case this skips.
  const remotePinned = row.pinned_categories;
  const pinnedCategories = remotePinned && remotePinned.length > 0 ? remotePinned : useVaultStore.getState().pinnedCategories;
  applyingRemoteSettings = true;
  try {
    useVaultStore.setState({
      themeOverride: row.theme as never,
      accentOverride: row.accent_color,
      appFont: row.app_font as never,
      noteFont: row.note_font as never,
      titleFont: row.title_font as never,
      sort: row.sort as never,
      pinnedCategories,
    });
    // Graph settings/bookmarks are NULL until some device first saves them
    // (and on a server where the columns don't exist yet they're undefined),
    // so only take them when present — same reasoning as pinned_categories.
    if (!graphPushPending) useGraphSettings.getState().applyRemote({ settings: row.graph_settings ?? null, bookmarks: row.graph_bookmarks ?? null });
  } finally {
    applyingRemoteSettings = false;
  }
}

async function pullSettings(vaultId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return "";
  // This device's own copy first, so a missing remote value never wipes it.
  useGraphSettings.getState().setVault(vaultId);
  const { data, error } = await supabase.from("vault_settings").select("*").eq("vault_id", vaultId).maybeSingle();
  if (error) {
    reportSyncError("Loading settings", error.message);
  } else if (data) {
    const row = data as RemoteSettingsRow;
    applySettingsRow(row);
    // The store's change-diff push loop only fires on a local change, so a
    // remote that's stale/missing pinned_categories (see applySettingsRow)
    // needs an explicit push here to actually get corrected — otherwise it
    // stays wrong until the user happens to toggle a pin themselves.
    const localPinned = useVaultStore.getState().pinnedCategories;
    const graph = useGraphSettings.getState();
    const graphMissing = (row.graph_settings == null && !graphIsDefault(graph.settings)) || (row.graph_bookmarks == null && graph.bookmarks.length > 0);
    if ((localPinned.length && (!row.pinned_categories || row.pinned_categories.length === 0)) || graphMissing) {
      await pushSettings(vaultId);
    }
  } else {
    // No settings row yet means a brand-new vault (a new account) — start it
    // on the Dark theme. Existing vaults always have a row, so they keep
    // whatever theme they already have.
    useVaultStore.setState({ themeOverride: "Dark" });
    const { error: upsertErr } = await supabase.from("vault_settings").upsert(settingsToRow(vaultId));
    if (upsertErr) reportSyncError("Saving settings", upsertErr.message);
  }
  return JSON.stringify(settingsToRow(vaultId));
}

async function pushSettings(vaultId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("vault_settings").upsert(settingsToRow(vaultId));
  if (error) reportSyncError("Saving settings", error.message);
  else {
    graphPushPending = false;
    clearSyncError();
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
    const v = folderVersion;
    pushFolders(vaultId, folderList, folderParents).then((ok) => {
      if (ok) folderPushedVersion = Math.max(folderPushedVersion, v);
    });
  }, 600);
  const debouncedPushCategories = debounce((categories: string[]) => {
    const v = categoryVersion;
    pushCategories(vaultId, categories).then((ok) => {
      if (ok) categoryPushedVersion = Math.max(categoryPushedVersion, v);
    });
  }, 600);
  const debouncedPushSettings = debounce(() => pushSettings(vaultId), 600);
  const debouncedPullFoldersCats = debounce(() => pullFoldersAndCategories(vaultId), 300);

  let prevNotes = useVaultStore.getState().notes;
  let prevFolderList = useVaultStore.getState().folderList;
  let prevCategories = useVaultStore.getState().categories;
  let prevDeleteEvent = useVaultStore.getState().noteDeleteEvent;
  let prevSettingsSnapshot = "";

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
      if (!applyingRemoteLists) {
        folderVersion++;
        debouncedPushFolders.run(state.folderList, state.folderParents);
      }
      prevFolderList = state.folderList;
    }
    if (state.categories !== prevCategories) {
      if (!applyingRemoteLists) {
        categoryVersion++;
        debouncedPushCategories.run(state.categories);
      }
      prevCategories = state.categories;
    }
    // Appearance prefs (theme/accent/fonts/sort) are a single row per vault
    // rather than a field-by-field diff, so compare a snapshot instead of
    // each field — cheap given how rarely these change, and it naturally
    // ignores fields (like showRight) that aren't part of the synced row.
    checkSettings();
  });
  // Graph settings and bookmarks live in their own store but sync in the
  // same vault_settings row.
  let prevGraph = useGraphSettings.getState();
  const unsubscribeGraph = useGraphSettings.subscribe((g) => {
    if ((g.settings !== prevGraph.settings || g.bookmarks !== prevGraph.bookmarks) && !applyingRemoteSettings && prevSettingsSnapshot) graphPushPending = true;
    prevGraph = g;
    checkSettings();
  });
  function checkSettings() {
    if (!prevSettingsSnapshot) return;
    const snap = JSON.stringify(settingsToRow(vaultId!));
    if (snap === prevSettingsSnapshot) return;
    prevSettingsSnapshot = snap;
    if (!applyingRemoteSettings) debouncedPushSettings.run();
  }

  // Backgrounding the tab (switching apps on mobile, switching tabs, closing)
  // must not silently drop a pending debounced push — flush it immediately.
  const flushPending = () => {
    debouncedPushNote.flush();
    debouncedPushFolders.flush();
    debouncedPushCategories.flush();
    debouncedPushSettings.flush();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flushPending();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushPending);

  async function init() {
    await pullAndMerge(vaultId!);
    prevSettingsSnapshot = await pullSettings(vaultId!);
    onReady?.();
    await replayQueue(vaultId!);
    if (cancelled) return;

    const supabase = getSupabase();
    if (!supabase) return;
    channel = supabase
      .channel(`vault-${vaultId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `vault_id=eq.${vaultId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const deletedId = (payload.old as { id?: string } | null)?.id;
          if (deletedId) useVaultStore.setState((s) => ({ notes: s.notes.filter((n) => n.id !== deletedId) }));
          return;
        }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_settings", filter: `vault_id=eq.${vaultId}` }, (payload) => {
        if (payload.eventType === "DELETE") return;
        applySettingsRow(payload.new as RemoteSettingsRow);
        prevSettingsSnapshot = JSON.stringify(settingsToRow(vaultId!));
      })
      // pushFolders/pushCategories can emit several row-level events for one
      // rename (a delete plus upserts) — debounced so a single edit doesn't
      // trigger a burst of redundant refetches.
      .on("postgres_changes", { event: "*", schema: "public", table: "folders", filter: `vault_id=eq.${vaultId}` }, () => {
        debouncedPullFoldersCats.run();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `vault_id=eq.${vaultId}` }, () => {
        debouncedPullFoldersCats.run();
      })
      .subscribe();
  }

  init();

  const onOnline = () => replayQueue(vaultId!);
  window.addEventListener("online", onOnline);

  // Realtime is the primary path for picking up other devices' changes
  // live, but a dropped/never-established websocket (flaky network, a
  // browser extension blocking it, a Supabase realtime hiccup) would
  // otherwise fail silently and this device would only catch up on a full
  // page reload. A periodic pull is a cheap self-healing fallback for that.
  const pollInterval = setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    await pullAndMerge(vaultId!);
    prevSettingsSnapshot = await pullSettings(vaultId!);
  }, 45000);

  return () => {
    cancelled = true;
    flushPending();
    unsubscribeStore();
    unsubscribeGraph();
    clearInterval(pollInterval);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flushPending);
    if (channel) getSupabase()?.removeChannel(channel);
  };
}
