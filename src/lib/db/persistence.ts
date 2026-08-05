import { localDb, isLocalDbEmpty } from "./localDb";
import { useVaultStore, mkTab } from "@/lib/store/useVaultStore";
import { normalizeLineEndings } from "@/lib/text";
import type { TabState } from "@/types/vault";

let persistenceStarted = false;

/** Drops history entries pointing at notes that no longer exist, and falls
 * back to a single home tab if nothing valid survives — used to restore the
 * last-open tab(s) on reload without resurrecting dangling note references. */
function sanitizeTabs(rawTabs: unknown, rawActive: unknown, validIds: Set<string>): { tabs: TabState[]; active: number } {
  const fallback = { tabs: [mkTab({ kind: "home" })], active: 0 };
  if (!Array.isArray(rawTabs) || !rawTabs.length) return fallback;
  const wantActive = typeof rawActive === "number" ? rawActive : 0;
  const cleaned: TabState[] = [];
  let mappedActive = 0;
  rawTabs.forEach((t, i) => {
    const hist = t && Array.isArray((t as TabState).hist) ? (t as TabState).hist : null;
    if (!hist) return;
    const validHist = hist.filter((v) => v && v.kind && (v.kind !== "note" || (v.id && validIds.has(v.id))));
    if (!validHist.length) return;
    const hi = Math.min(Math.max(0, (t as TabState).hi ?? 0), validHist.length - 1);
    if (i === wantActive) mappedActive = cleaned.length;
    cleaned.push({ hist: validHist, hi });
  });
  if (!cleaned.length) return fallback;
  return { tabs: cleaned, active: Math.min(mappedActive, cleaned.length - 1) };
}

export async function hydrateFromLocalDb(): Promise<void> {
  const empty = await isLocalDbEmpty();
  if (empty) return; // first run on this device: nothing to load, vault starts blank

  const [notes, folders, categories, settingsRows] = await Promise.all([
    localDb.notes.toArray(),
    localDb.folders.toArray(),
    localDb.categories.toArray(),
    localDb.settings.toArray(),
  ]);

  const folderParents: Record<string, string | null> = {};
  folders.forEach((f) => {
    folderParents[f.name] = f.parent;
  });
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const { tabs, active } = sanitizeTabs(settings.tabs, settings.active, new Set(notes.map((n) => n.id)));

  // Imported .md files (and some paste sources) can carry CRLF line
  // endings, which silently break the live editor's per-line regexes —
  // clean any pre-existing notes once here, on top of normalizing new
  // writes at the source, so already-imported notes self-heal.
  const dirty: typeof notes = [];
  const cleanNotes = notes.map((n) => {
    if (!n.content.includes("\r")) return n;
    const cleaned = { ...n, content: normalizeLineEndings(n.content) };
    dirty.push(cleaned);
    return cleaned;
  });
  if (dirty.length) localDb.notes.bulkPut(dirty).catch(() => {});

  useVaultStore.setState({
    notes: cleanNotes,
    folderList: folders.map((f) => f.name),
    folderParents,
    categories: categories.map((c) => c.name),
    tabs,
    active,
    ...(typeof settings.sort === "string" ? { sort: settings.sort as never } : {}),
    ...(typeof settings.leftWidth === "number" ? { leftWidth: settings.leftWidth } : {}),
  });
}

// A plain setTimeout-backed debounce has no durability — if the tab is
// refreshed or closed before the timer fires, the pending write is lost.
// hydrateFromLocalDb() reads IndexedDB synchronously on the very next
// load, before any network pull, so losing a write here means a
// just-created note can appear to vanish on refresh even though the
// network sync succeeded. .flush() lets callers force it through
// immediately (wired to visibilitychange/pagehide below).
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): { run: T; flush: () => void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  let pending: never[] | null = null;
  const run = ((...args: never[]) => {
    pending = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      const args2 = pending!;
      pending = null;
      fn(...args2);
    }, ms);
  }) as T;
  const flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };
  return { run, flush };
}

async function persistNotes(notes: ReturnType<typeof useVaultStore.getState>["notes"]) {
  await localDb.notes.bulkPut(notes);
  const currentIds = new Set(notes.map((n) => n.id));
  const existing = await localDb.notes.toArray();
  const toDelete = existing.filter((n) => !currentIds.has(n.id)).map((n) => n.id);
  if (toDelete.length) await localDb.notes.bulkDelete(toDelete);
}

async function persistFolders(folderList: string[], folderParents: Record<string, string | null>) {
  await localDb.folders.clear();
  await localDb.folders.bulkPut(folderList.map((name) => ({ name, parent: folderParents[name] ?? null })));
}

async function persistCategories(categories: string[]) {
  await localDb.categories.clear();
  await localDb.categories.bulkPut(categories.map((name) => ({ name })));
}

async function persistSettings(sort: string, leftWidth: number) {
  await localDb.settings.bulkPut([
    { key: "sort", value: sort },
    { key: "leftWidth", value: leftWidth },
  ]);
}

async function persistTabs(tabs: TabState[], active: number) {
  await localDb.settings.bulkPut([
    { key: "tabs", value: tabs },
    { key: "active", value: active },
  ]);
}

export function startLocalPersistence(): () => void {
  if (persistenceStarted) return () => {};
  persistenceStarted = true;

  const debouncedPersistNotes = debounce(persistNotes, 500);
  const debouncedPersistFolders = debounce(persistFolders, 500);
  const debouncedPersistCategories = debounce(persistCategories, 500);
  const debouncedPersistSettings = debounce(persistSettings, 500);
  const debouncedPersistTabs = debounce(persistTabs, 500);

  let prev = useVaultStore.getState();
  const unsub = useVaultStore.subscribe((state) => {
    if (state.notes !== prev.notes) debouncedPersistNotes.run(state.notes);
    if (state.folderList !== prev.folderList || state.folderParents !== prev.folderParents) {
      debouncedPersistFolders.run(state.folderList, state.folderParents);
    }
    if (state.categories !== prev.categories) debouncedPersistCategories.run(state.categories);
    if (state.sort !== prev.sort || state.leftWidth !== prev.leftWidth) {
      debouncedPersistSettings.run(state.sort, state.leftWidth);
    }
    if (state.tabs !== prev.tabs || state.active !== prev.active) {
      debouncedPersistTabs.run(state.tabs, state.active);
    }
    prev = state;
  });

  const flushPending = () => {
    debouncedPersistNotes.flush();
    debouncedPersistFolders.flush();
    debouncedPersistCategories.flush();
    debouncedPersistSettings.flush();
    debouncedPersistTabs.flush();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flushPending();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushPending);

  return () => {
    flushPending();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flushPending);
    unsub();
    persistenceStarted = false;
  };
}
