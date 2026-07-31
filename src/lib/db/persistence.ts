import { localDb, isLocalDbEmpty } from "./localDb";
import { useVaultStore } from "@/lib/store/useVaultStore";

let persistenceStarted = false;

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

  useVaultStore.setState({
    notes,
    folderList: folders.map((f) => f.name),
    folderParents,
    categories: categories.map((c) => c.name),
    ...(typeof settings.sort === "string" ? { sort: settings.sort as never } : {}),
    ...(typeof settings.leftWidth === "number" ? { leftWidth: settings.leftWidth } : {}),
  });
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
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

export function startLocalPersistence(): () => void {
  if (persistenceStarted) return () => {};
  persistenceStarted = true;

  const debouncedPersistNotes = debounce(persistNotes, 500);
  const debouncedPersistFolders = debounce(persistFolders, 500);
  const debouncedPersistCategories = debounce(persistCategories, 500);
  const debouncedPersistSettings = debounce(persistSettings, 500);

  let prev = useVaultStore.getState();
  const unsub = useVaultStore.subscribe((state) => {
    if (state.notes !== prev.notes) debouncedPersistNotes(state.notes);
    if (state.folderList !== prev.folderList || state.folderParents !== prev.folderParents) {
      debouncedPersistFolders(state.folderList, state.folderParents);
    }
    if (state.categories !== prev.categories) debouncedPersistCategories(state.categories);
    if (state.sort !== prev.sort || state.leftWidth !== prev.leftWidth) {
      debouncedPersistSettings(state.sort, state.leftWidth);
    }
    prev = state;
  });

  return () => {
    unsub();
    persistenceStarted = false;
  };
}
