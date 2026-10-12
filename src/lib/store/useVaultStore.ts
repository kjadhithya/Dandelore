import { create } from "zustand";
import type {
  Note,
  Attachment,
  TabState,
  View,
  VaultState,
  ThemeName,
  AppFontName,
  SortKey,
} from "@/types/vault";
import { TODAY } from "@/lib/seed";
import { normalizeLineEndings } from "@/lib/text";
import { noteToMarkdownFile, parseMarkdownFile } from "@/lib/markdown/frontmatter";
import JSZip from "jszip";

function newId(): string {
  return "n" + Date.now() + Math.random().toString(36).slice(2, 6);
}

export function mkTab(view: View): TabState {
  return { hist: [view], hi: 0 };
}
function mkNoteTab(id: string): TabState {
  return mkTab({ kind: "note", id });
}

export function noteTags(n: Note): string[] {
  const c = (n.content.match(/(^|\s)#([a-z0-9][\w/-]*)/gi) || []).map((x) =>
    x.trim().replace(/^#/, ""),
  );
  return [...new Set([...(n.tags || []), ...c])];
}

export function linksOf(n: Note): string[] {
  const m = n.content.match(/\[\[([^\]]+)\]\]/g) || [];
  return [...new Set(m.map((x) => x.slice(2, -2).trim()))];
}

/** [[Title]] links store the target's title as literal text, not a stable
 * id (see linksOf above, which resolves backlinks the same way) — so
 * renaming a note doesn't retroactively touch anything that already
 * pointed at its old title. Without this, a rename silently breaks every
 * existing [[OldTitle]] reference into a "missing" link. Matches
 * case-insensitively, same as linksOf/hasNote already do when resolving a
 * link, so a rewrite only fires where the app would already have
 * considered the link resolved. */
function renameNoteReferences(notes: Note[], oldTitle: string, newTitle: string): Note[] {
  const old = oldTitle.trim().toLowerCase();
  const next = newTitle.trim();
  if (!old || old === next.toLowerCase()) return notes;
  let changed = false;
  const result = notes.map((n) => {
    const nc = n.content.replace(/\[\[([^\]]+)\]\]/g, (whole, inner: string) =>
      inner.trim().toLowerCase() === old ? "[[" + next + "]]" : whole,
    );
    if (nc === n.content) return n;
    changed = true;
    return { ...n, content: nc };
  });
  return changed ? result : notes;
}

export function sortNotes(arr: Note[], sort: SortKey): Note[] {
  const a = [...arr];
  const by: Record<SortKey, (x: Note, y: Note) => number> = {
    "name-az": (x, y) => x.title.localeCompare(y.title),
    "name-za": (x, y) => y.title.localeCompare(x.title),
    "created-new": (x, y) => (y.date || "").localeCompare(x.date || ""),
    "created-old": (x, y) => (x.date || "").localeCompare(y.date || ""),
    "mod-new": (x, y) =>
      ((y.modified || y.date || "") + "").localeCompare(
        (x.modified || x.date || "") + "",
      ),
    "mod-old": (x, y) =>
      ((x.modified || x.date || "") + "").localeCompare(
        (y.modified || y.date || "") + "",
      ),
  };
  a.sort(by[sort] || by["name-az"]);
  return a;
}

interface UndoEntry {
  stack: string[];
  redo: string[];
  t: number;
}

export interface VaultStore extends VaultState {
  _undo: Record<string, UndoEntry>;

  // selectors
  activeTab: () => TabState | null;
  curView: () => View | null;
  curId: () => string | null;
  cur: () => Note | undefined;
  byTitle: (t: string) => Note | undefined;
  allTags: () => string[];
  splitCurId: () => string | null;
  effTheme: () => ThemeName;
  effAccent: () => string;

  // navigation
  navView: (view: View) => void;
  navigate: (id: string) => void;
  openNote: (id: string) => void;
  openNoteNewTab: (id: string) => void;
  openNoteInSplit: (id: string) => void;
  newTab: () => void;
  goBack: () => void;
  goForward: () => void;
  goGraph: () => void;
  goJournal: () => void;
  goCategories: () => void;
  goCategory: (name: string) => void;
  goBookmarks: () => void;
  goHome: () => void;
  showFiles: () => void;
  selectTab: (i: number) => void;
  closeTab: (i: number) => void;
  /** Drag-reorder a tab in the main pane (split: true for the split pane). */
  moveTab: (from: number, to: number, split?: boolean) => void;

  // split
  splitOpen: (dir: "right" | "down") => void;
  /** Open a non-note view (e.g. the graph) in a new split pane. */
  splitOpenView: (dir: "right" | "down", view: View) => void;
  splitSelect: (i: number) => void;
  splitCloseTab: (i: number) => void;
  splitCloseAll: () => void;
  splitNewTab: () => void;
  setMainPane: () => void;
  setSplitPane: () => void;
  splitOpenNote: (id: string) => void;
  splitToMain: () => void;
  splitOpenNewMain: () => void;
  toggleSplitReading: () => void;
  splitBack: () => void;
  splitForward: () => void;
  onSplitTitle: (v: string) => void;
  splitHomeEdit: () => void;
  splitHomeSearch: () => void;
  splitHomeClose: () => void;
  splitOpenMeta: () => void;
  splitCloseMeta: () => void;
  onSplitCategorySelect: (v: string) => void;
  splitOnTagDraft: (v: string) => void;
  splitAddTag: (t: string) => void;
  splitRemoveTag: (id: string, t: string) => void;
  splitOnDate: (v: string) => void;
  splitToggleNoteMenu: () => void;
  splitMenuMoveStart: () => void;
  splitMenuMoveTo: (folder: string) => void;
  splitMenuDuplicate: () => void;
  splitMenuExportNote: () => void;
  splitMenuDelete: () => void;
  setSplitSize: (pct: number) => void;

  // notes CRUD
  openOrCreate: (title: string, folder?: string) => void;
  ensureNote: (title: string, folder?: string) => string;
  newNote: (category?: string) => void;
  openNewNoteMeta: () => void;
  deleteNote: (id: string) => void;
  duplicateNote: (id: string) => void;
  deleteCurrent: () => void;
  toggleBookmark: (id: string) => void;
  onTitle: (v: string) => void;
  commitTitleRename: (id: string, oldTitle: string) => void;
  setNoteContent: (id: string, content: string) => void;

  // layout toggles
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleRightMain: () => void;
  toggleRightSplit: () => void;
  toggleReading: () => void;
  setLeftWidth: (w: number) => void;

  // folders
  toggleFolder: (name: string) => void;
  toggleAllFolders: () => void;
  toggleReveal: () => void;
  newFolder: () => void;
  reparentFolder: (child: string, parent: string | null) => void;
  startFolderRename: (name: string) => void;
  commitFolderRename: (oldN: string, val: string) => void;
  onFolderRenameDraft: (v: string) => void;
  onFolderContext: (name: string, x: number, y: number) => void;
  closeFolderCtx: () => void;
  newSubfolder: (parent: string) => void;
  requestDeleteFolder: (name: string, onDeleted?: () => void) => void;
  closeFolderDeleteRequest: () => void;
  resolveFolderDelete: (mode: "keep" | "move" | "delete", targetFolder?: string) => void;
  moveNoteTo: (id: string, folder: string) => void;

  // search / sort
  toggleSearchMode: () => void;
  onSearchQuery: (v: string) => void;
  clearSearch: () => void;
  onSearchKey: (key: string) => void;
  clearHistory: () => void;
  openSearch: (q: string) => void;
  toggleSortMenu: () => void;
  setSort: (k: SortKey) => void;

  // meta / category / tags on current note
  openMeta: () => void;
  closeMeta: () => void;
  toggleCatMenu: () => void;
  setCategory: (cat: string) => void;
  clearCategory: () => void;
  addCategoryGlobal: (name: string) => void;
  onCatSearch: (v: string) => void;
  onCatSearchKey: (key: string) => void;
  catCreate: () => void;
  onTagDraft: (v: string) => void;
  addTag: (tag: string) => void;
  removeNoteTag: (id: string, tag: string) => void;
  onDate: (v: string) => void;

  // categories view
  onCatContext: (name: string, x: number, y: number) => void;
  closeCatCtx: () => void;
  catCtxRename: () => void;
  catCtxDelete: () => void;
  requestDeleteCategory: (name: string, onDeleted?: () => void) => void;
  closeCatDeleteRequest: () => void;
  resolveCategoryDelete: (mode: "keep" | "move" | "delete", targetCategory?: string) => void;
  renameCategory: (oldN: string, newN: string) => void;
  addCategoryTop: (name: string) => void;
  togglePinCategory: (name: string) => void;

  // note menu / accent / theme
  toggleNoteMenu: () => void;
  menuDuplicate: () => void;
  menuMoveStart: () => void;
  menuMoveTo: (folder: string) => void;
  setAccent: (hex: string) => void;
  openSettings: () => void;
  closeSettings: () => void;
  openConfirm: (cfg: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel?: () => void }) => void;
  closeConfirm: () => void;
  setTheme: (t: ThemeName) => void;

  // undo/redo
  pushUndo: (id: string, content: string) => void;
  undo: (id: string) => void;
  redo: (id: string) => void;

  // multiselect / bulk
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  rowClick: (id: string, opts: { meta?: boolean; shift?: boolean }, order: string[]) => void;
  openBulkCtx: (x: number, y: number) => void;
  closeBulkCtx: () => void;
  bulkCtxMoveStart: () => void;
  bulkNewFolder: () => void;
  bulkMoveTo: (folder: string) => void;
  bulkDelete: () => void;
  onAppFont: (v: AppFontName) => void;
  onNoteFont: (v: AppFontName) => void;
  onTitleFont: (v: AppFontName) => void;

  // import/export/attach
  exportJson: () => void;
  exportMarkdownZip: () => Promise<void>;
  exportCategoryMarkdownZip: (name: string) => Promise<void>;
  exportNote: () => void;
  importMarkdown: (files: { name: string; text: string }[]) => void;
  importJson: (data: unknown) => { ok: boolean; error?: string };
  attachFiles: (
    files: { name: string; type: string; dataUrl: string }[],
    noteId?: string,
  ) => void;

  // note context menu
  onNoteContext: (id: string, x: number, y: number) => void;
  closeCtx: () => void;
  ctxOpenNote: () => void;
  ctxDuplicate: () => void;
  ctxRename: () => void;
  ctxDelete: () => void;
  ctxMoveStart: () => void;
  moveCtx: (folder: string) => void;
  onRenameLive: (id: string, v: string) => void;
  stopRename: () => void;
  startRenaming: (id: string) => void;

  // drag/drop
  setDraggingId: (id: string | null) => void;
  setDraggingFolder: (name: string | null) => void;
  setDragOverFolder: (name: string | null) => void;

  // journal
  prevMonth: () => void;
  nextMonth: () => void;
  setCalSelected: (iso: string) => void;
  newDaily: () => void;

  // quick switcher / cmd palette
  onQuick: (v: string) => void;
  toggleQuick: () => void;
  closeQuick: () => void;
  onCmd: (v: string) => void;
  openCmd: () => void;
  closeCmd: () => void;

  closeAllMenus: () => void;
  openCheat: () => void;
  closeCheat: () => void;
  resetVaultContent: () => void;
}

export const useVaultStore = create<VaultStore>()((set, get) => ({
  notes: [],
  noteDeleteEvent: null,
  folderList: [],
  folderParents: {},
  folderRenaming: null,
  folderRenameDraft: "",
  folderCtx: null,
  draggingFolder: null,
  folderDeleteRequest: null,

  categories: [],
  pinnedCategories: [],

  tabs: [mkTab({ kind: "home" })],
  active: 0,
  split: null,
  splitReading: false,
  cheatOpen: false,
  lastPane: "main",
  splitSize: 58,
  splitMetaOpen: false,
  splitTagDraft: "",
  splitNoteMenuOpen: false,
  splitNoteMenuMove: false,

  leftOpen: true,
  leftWidth: 256,
  showRight: false,
  syncError: null,

  sideMode: "files",
  expanded: {},

  searchQuery: "",
  searchHistory: [],

  sort: "name-az",
  sortMenuOpen: false,
  autoReveal: false,

  themeOverride: null,
  accentOverride: null,
  settingsOpen: false,
  confirmDialog: null,
  selectedIds: [],
  selectAnchor: null,
  bulkCtx: null,

  appFont: "Sans",
  noteFont: "Serif",
  titleFont: "Serif",

  reading: false,

  metaOpen: false,
  catMenuOpen: false,
  catQuery: "",
  tagDraft: "",

  noteMenuOpen: false,
  noteMenuMove: false,

  catCtx: null,
  catRenaming: null,
  catDeleteRequest: null,

  linkQuery: null,
  tagAcQuery: null,
  linkPos: { x: 0, y: 0 },
  linkActiveIdx: 0,

  ctxMenu: null,
  ctxMove: false,
  renaming: null,
  draggingId: null,
  dragOverFolder: null,

  calYear: new Date(TODAY).getFullYear(),
  calMonth: new Date(TODAY).getMonth(),
  calSelected: TODAY,

  quickOpen: false,
  quickQuery: "",
  cmdOpen: false,
  cmdQuery: "",

  _undo: {},

  // ---------- selectors ----------
  activeTab: () => get().tabs[get().active] || null,
  curView: () => {
    const t = get().activeTab();
    return t ? t.hist[t.hi] : null;
  },
  curId: () => {
    const v = get().curView();
    return v && v.kind === "note" ? v.id ?? null : null;
  },
  cur: () => {
    const id = get().curId();
    return get().notes.find((n) => n.id === id);
  },
  // Trimmed on both sides, not just the search term — a stored title with
  // stray leading/trailing whitespace (the title field never trims on its
  // own) would otherwise silently fail to match an otherwise-identical
  // [[link]] (whose text is trimmed when parsed), making openOrCreate
  // think the note doesn't exist and create a duplicate instead of
  // navigating to it.
  byTitle: (t) =>
    get().notes.find((n) => n.title.trim().toLowerCase() === String(t).trim().toLowerCase()),
  allTags: () => {
    const set2 = new Set<string>();
    get().notes.forEach((n) => noteTags(n).forEach((t) => set2.add(t)));
    return [...set2].sort();
  },
  splitCurId: () => {
    const sp = get().split;
    if (!sp) return null;
    const t = sp.tabs[sp.active];
    const v = t && t.hist[t.hi];
    return v && v.kind === "note" ? v.id ?? null : null;
  },
  effTheme: () => get().themeOverride || "Light Warm",
  effAccent: () => get().accentOverride || "#b0623b",

  // ---------- navigation ----------
  navView: (view) =>
    set((s) => {
      const base = {
        linkQuery: null,
        quickOpen: false,
        cmdOpen: false,
        metaOpen: false,
        noteMenuOpen: false,
        catMenuOpen: false,
      };
      if (s.lastPane === "split" && s.split) {
        const tabs = [...s.split.tabs];
        const t = tabs[s.split.active];
        if (!t) {
          tabs.push(mkTab(view));
          return { ...base, split: { ...s.split, tabs, active: tabs.length - 1 } };
        }
        const hist = t.hist.slice(0, t.hi + 1);
        const last = hist[hist.length - 1];
        const same =
          last && last.kind === view.kind && (view.kind !== "note" || last.id === view.id);
        if (!same) hist.push(view);
        tabs[s.split.active] = { hist, hi: hist.length - 1 };
        return { ...base, split: { ...s.split, tabs } };
      }
      const tabs = [...s.tabs];
      const t = tabs[s.active];
      if (!t) {
        tabs.push(mkTab(view));
        return { ...base, tabs, active: tabs.length - 1 };
      }
      const hist = t.hist.slice(0, t.hi + 1);
      const last = hist[hist.length - 1];
      const same =
        last && last.kind === view.kind && (view.kind !== "note" || last.id === view.id);
      if (!same) hist.push(view);
      tabs[s.active] = { hist, hi: hist.length - 1 };
      return { ...base, tabs };
    }),
  navigate: (id) => get().navView({ kind: "note", id }),
  openNote: (id) => get().navigate(id),
  openNoteNewTab: (id) =>
    set((s) => {
      if (s.lastPane === "split" && s.split) {
        const tabs = [...s.split.tabs, mkNoteTab(id)];
        return {
          split: { ...s.split, tabs, active: tabs.length - 1 },
          ctxMenu: null,
          noteMenuOpen: false,
          linkQuery: null,
        };
      }
      const tabs = [...s.tabs, mkNoteTab(id)];
      return { tabs, active: tabs.length - 1, ctxMenu: null, noteMenuOpen: false, linkQuery: null };
    }),
  openNoteInSplit: (id) =>
    set((s) => {
      if (s.split) {
        const tabs = [...s.split.tabs, mkNoteTab(id)];
        return { split: { ...s.split, tabs, active: tabs.length - 1 }, lastPane: "split", ctxMenu: null };
      }
      return { split: { dir: "right", tabs: [mkNoteTab(id)], active: 0 }, lastPane: "split", ctxMenu: null };
    }),
  newTab: () =>
    set((s) => {
      const tabs = [...s.tabs, mkTab({ kind: "home" })];
      return { tabs, active: tabs.length - 1, linkQuery: null, quickOpen: false, metaOpen: false };
    }),
  goBack: () =>
    set((s) => {
      const tabs = [...s.tabs];
      const t = tabs[s.active];
      if (t && t.hi > 0) {
        tabs[s.active] = { hist: t.hist, hi: t.hi - 1 };
        return { tabs, linkQuery: null, metaOpen: false };
      }
      return {};
    }),
  goForward: () =>
    set((s) => {
      const tabs = [...s.tabs];
      const t = tabs[s.active];
      if (t && t.hi < t.hist.length - 1) {
        tabs[s.active] = { hist: t.hist, hi: t.hi + 1 };
        return { tabs, linkQuery: null, metaOpen: false };
      }
      return {};
    }),
  goGraph: () => get().navView({ kind: "graph" }),
  goJournal: () => get().navView({ kind: "journal" }),
  goCategories: () => get().navView({ kind: "categories" }),
  goCategory: (name) => get().navView({ kind: "category", id: name }),
  goBookmarks: () => get().navView({ kind: "bookmarks" }),
  goHome: () => get().navView({ kind: "home" }),
  showFiles: () => set({ sideMode: "files", leftOpen: true }),
  selectTab: (i) =>
    set({ active: i, catMenuOpen: false, noteMenuOpen: false, metaOpen: false, linkQuery: null, lastPane: "main" }),
  moveTab: (from, to, split) =>
    set((s) => {
      const src = split ? s.split?.tabs : s.tabs;
      if (!src || from === to || from < 0 || to < 0 || from >= src.length || to >= src.length) return {};
      const tabs = [...src];
      const [t] = tabs.splice(from, 1);
      tabs.splice(to, 0, t);
      // Keep the same tab active wherever it (or the dragged tab) ends up.
      const cur = split ? s.split!.active : s.active;
      let active = cur;
      if (cur === from) active = to;
      else if (from < cur && to >= cur) active = cur - 1;
      else if (from > cur && to <= cur) active = cur + 1;
      return split ? { split: { ...s.split!, tabs, active } } : { tabs, active };
    }),
  closeTab: (i) =>
    set((s) => {
      const tabs = s.tabs.filter((_, k) => k !== i);
      let active = s.active;
      if (i < active) active--;
      if (active >= tabs.length) active = tabs.length - 1;
      if (active < 0) active = 0;
      if (!tabs.length) return { tabs: [mkTab({ kind: "home" })], active: 0 };
      return { tabs, active };
    }),

  // ---------- split ----------
  splitOpen: (dir) => {
    const id = get().curId();
    if (!id) return;
    set({ split: { dir, tabs: [mkNoteTab(id)], active: 0 }, noteMenuOpen: false, noteMenuMove: false, lastPane: "split" });
  },
  splitOpenView: (dir, view) => set({ split: { dir, tabs: [mkTab(view)], active: 0 }, noteMenuOpen: false, noteMenuMove: false, lastPane: "split" }),
  splitSelect: (i) => set((s) => (s.split ? { split: { ...s.split, active: i }, lastPane: "split" } : {})),
  splitCloseTab: (i) =>
    set((s) => {
      if (!s.split) return {};
      const tabs = s.split.tabs.filter((_, k) => k !== i);
      if (!tabs.length) return { split: null, lastPane: "main" };
      let active = s.split.active;
      if (i < active) active--;
      if (active >= tabs.length) active = tabs.length - 1;
      return { split: { ...s.split, tabs, active } };
    }),
  splitCloseAll: () => set({ split: null, lastPane: "main" }),
  splitNewTab: () =>
    set((s) => {
      if (!s.split) return {};
      const tabs = [...s.split.tabs, mkTab({ kind: "home" })];
      return { split: { ...s.split, tabs, active: tabs.length - 1 }, lastPane: "split" };
    }),
  setMainPane: () => {
    if (get().lastPane !== "main") set({ lastPane: "main" });
  },
  setSplitPane: () => {
    const s = get();
    if (s.split && s.lastPane !== "split") set({ lastPane: "split" });
  },
  splitOpenNote: (id) =>
    set((s) => {
      if (!s.split) return {};
      const tabs = [...s.split.tabs];
      tabs[s.split.active] = mkNoteTab(id);
      return { split: { ...s.split, tabs } };
    }),
  splitToMain: () => {
    const id = get().splitCurId();
    if (id) {
      set({ lastPane: "main" });
      get().navigate(id);
    }
  },
  splitOpenNewMain: () => {
    const id = get().splitCurId();
    set({ splitNoteMenuOpen: false });
    if (id) {
      set({ lastPane: "main" });
      get().navigate(id);
    }
  },
  toggleSplitReading: () => set((s) => ({ splitReading: !s.splitReading })),
  splitBack: () =>
    set((s) => {
      if (!s.split) return {};
      const t = s.split.tabs[s.split.active];
      if (t && t.hi > 0) {
        const tabs = [...s.split.tabs];
        tabs[s.split.active] = { hist: t.hist, hi: t.hi - 1 };
        return { split: { ...s.split, tabs } };
      }
      return {};
    }),
  splitForward: () =>
    set((s) => {
      if (!s.split) return {};
      const t = s.split.tabs[s.split.active];
      if (t && t.hi < t.hist.length - 1) {
        const tabs = [...s.split.tabs];
        tabs[s.split.active] = { hist: t.hist, hi: t.hi + 1 };
        return { split: { ...s.split, tabs } };
      }
      return {};
    }),
  onSplitTitle: (v) => {
    const id = get().splitCurId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, title: v } : n)) }));
  },
  splitHomeEdit: () => {
    set({ lastPane: "split" });
    get().newNote();
  },
  splitHomeSearch: () => {
    set({ lastPane: "split" });
    get().toggleQuick();
  },
  splitHomeClose: () => {
    const sp = get().split;
    if (sp) get().splitCloseTab(sp.active);
  },
  splitOpenMeta: () => set({ splitMetaOpen: true, splitNoteMenuOpen: false }),
  splitCloseMeta: () => set({ splitMetaOpen: false }),
  onSplitCategorySelect: (v) => {
    const id = get().splitCurId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, category: v } : n)) }));
  },
  splitOnTagDraft: (v) => set({ splitTagDraft: v }),
  splitAddTag: (t) => {
    const id = get().splitCurId();
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, tags: [...new Set([...(n.tags || []), t])] } : n)),
      splitTagDraft: "",
    }));
  },
  splitRemoveTag: (id, t) =>
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, tags: (n.tags || []).filter((x) => x !== t) } : n)) })),
  splitOnDate: (v) => {
    const id = get().splitCurId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, date: v } : n)) }));
  },
  splitToggleNoteMenu: () => set((s) => ({ splitNoteMenuOpen: !s.splitNoteMenuOpen, splitNoteMenuMove: false, splitMetaOpen: false })),
  splitMenuMoveStart: () => set({ splitNoteMenuMove: true }),
  splitMenuMoveTo: (folder) => {
    const id = get().splitCurId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, folder } : n)), splitNoteMenuOpen: false, splitNoteMenuMove: false }));
  },
  splitMenuDuplicate: () => {
    const id = get().splitCurId();
    const o = get().notes.find((n) => n.id === id);
    if (!o) {
      set({ splitNoteMenuOpen: false });
      return;
    }
    const nid = newId();
    const copy: Note = { ...o, id: nid, title: o.title + " copy", tags: [...(o.tags || [])], attachments: { ...(o.attachments || {}) } };
    set((s) => ({ notes: [...s.notes, copy], splitNoteMenuOpen: false }));
    get().splitOpenNote(nid);
  },
  splitMenuExportNote: () => {
    const id = get().splitCurId();
    const o = get().notes.find((n) => n.id === id);
    set({ splitNoteMenuOpen: false });
    if (o) downloadFile((o.title || "note") + ".md", o.content, "text/markdown");
  },
  splitMenuDelete: () => {
    const id = get().splitCurId();
    set({ splitNoteMenuOpen: false });
    if (id) get().deleteNote(id);
  },
  setSplitSize: (pct) => set({ splitSize: Math.max(20, Math.min(80, pct)) }),

  // ---------- notes CRUD ----------
  openOrCreate: (title, folder) => {
    const ex = get().byTitle(title);
    if (ex) {
      get().navigate(ex.id);
      return;
    }
    const id = get().ensureNote(title, folder);
    get().navigate(id!);
    get().openNewNoteMeta();
  },
  // Creates the note a [[wikilink]] points at if it doesn't exist yet,
  // without navigating away — used when a link is *inserted* while typing
  // in another note, as opposed to clicked (which should navigate).
  ensureNote: (title, folder) => {
    const ex = get().byTitle(title);
    if (ex) return ex.id;
    const id = newId();
    const note: Note = {
      id,
      title,
      folder: folder || "",
      date: TODAY,
      modified: new Date().toISOString(),
      category: "",
      tags: [],
      attachments: {},
      content: "",
    };
    set((s) => ({ notes: [...s.notes, note] }));
    return id;
  },
  newNote: (category) => {
    const id = newId();
    const note: Note = {
      id,
      title: "Untitled",
      folder: "",
      date: TODAY,
      modified: new Date().toISOString(),
      category: category || "",
      tags: [],
      attachments: {},
      content: "",
    };
    set((s) => ({ notes: [...s.notes, note], reading: false }));
    get().navigate(id);
    get().openNewNoteMeta();
  },
  deleteNote: (id) =>
    set((s) => {
      const notes = s.notes.filter((n) => n.id !== id);
      const tabs = s.tabs.map((t) => {
        const hist = t.hist.filter((v) => !(v.kind === "note" && v.id === id));
        if (!hist.length) return mkTab({ kind: "home" });
        return { hist, hi: Math.min(t.hi, hist.length - 1) };
      });
      let split = s.split;
      if (split) {
        const st = split.tabs
          .map((t) => ({ hist: t.hist.filter((v) => !(v.kind === "note" && v.id === id)), hi: 0 }))
          .filter((t) => t.hist.length);
        split = st.length ? { ...split, tabs: st, active: Math.min(split.active, st.length - 1) } : null;
      }
      return { notes, tabs, split, noteMenuOpen: false, noteMenuMove: false, noteDeleteEvent: { ids: [id] } };
    }),
  duplicateNote: (id) => {
    const o = get().notes.find((n) => n.id === id);
    if (!o) return;
    const nid = newId();
    const copy: Note = { ...o, id: nid, title: o.title + " copy", tags: [...(o.tags || [])], attachments: { ...(o.attachments || {}) } };
    set((s) => ({ notes: [...s.notes, copy] }));
    get().navigate(nid);
  },
  deleteCurrent: () => {
    const id = get().curId();
    if (id) get().deleteNote(id);
  },
  toggleBookmark: (id) =>
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, bookmarked: !n.bookmarked } : n)) })),
  onTitle: (v) => {
    const id = get().curId();
    const iso = new Date().toISOString();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, title: v, modified: iso } : n)) }));
  },
  // Called once a title edit is done (blur), not per-keystroke like
  // onTitle above — rewriting [[OldTitle]] references on every keystroke
  // would rewrite them to each half-typed intermediate title instead of
  // the final one.
  commitTitleRename: (id, oldTitle) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    set((s) => ({ notes: renameNoteReferences(s.notes, oldTitle, note.title) }));
  },
  setNoteContent: (id, content) => {
    content = normalizeLineEndings(content);
    const old = get().notes.find((n) => n.id === id);
    if (old && old.content !== content) get().pushUndo(id, old.content);
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, content, modified: new Date().toISOString() } : n)) }));
  },

  // ---------- layout ----------
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ showRight: !s.showRight })),
  toggleRightMain: () =>
    set((s) => {
      const focusSplit = s.lastPane === "split" && !!s.split;
      if (s.showRight && !focusSplit) return { showRight: false };
      return { showRight: true, lastPane: "main" };
    }),
  toggleRightSplit: () =>
    set((s) => {
      const focusSplit = s.lastPane === "split" && !!s.split;
      if (s.showRight && focusSplit) return { showRight: false };
      return { showRight: true, lastPane: "split" };
    }),
  toggleReading: () => set((s) => ({ reading: !s.reading, linkQuery: null })),
  setLeftWidth: (w) => set({ leftWidth: Math.max(190, Math.min(460, w)) }),

  // ---------- folders ----------
  toggleFolder: (name) => set((s) => ({ expanded: { ...s.expanded, [name]: !s.expanded[name] } })),
  toggleAllFolders: () =>
    set((s) => {
      const anyOpen = s.folderList.some((f) => s.expanded[f]);
      if (anyOpen) return { expanded: {} };
      const ex: Record<string, boolean> = {};
      s.folderList.forEach((f) => (ex[f] = true));
      return { expanded: ex };
    }),
  toggleReveal: () => set((s) => ({ autoReveal: !s.autoReveal })),
  newFolder: () => {
    let base = "Untitled",
      name = base,
      i = 2;
    while (get().folderList.includes(name)) {
      name = base + " " + i;
      i++;
    }
    set((s) => ({
      folderList: [...s.folderList, name],
      expanded: { ...s.expanded, [name]: true },
      folderRenaming: name,
      folderRenameDraft: name,
    }));
  },
  reparentFolder: (child, parent) => {
    if (child === parent) return;
    let p = get().folderParents[parent || ""];
    while (p) {
      if (p === child) return;
      p = get().folderParents[p];
    }
    set((s) => ({
      folderParents: { ...s.folderParents, [child]: parent || null },
      expanded: { ...s.expanded, [parent || ""]: true },
      draggingFolder: null,
      dragOverFolder: null,
    }));
  },
  startFolderRename: (name) => set({ folderRenaming: name, folderRenameDraft: name, folderCtx: null }),
  commitFolderRename: (oldN, val) => {
    const newN = (val || "").trim();
    set((s) => {
      if (!newN || newN === oldN || s.folderList.includes(newN)) return { folderRenaming: null };
      const folderList = s.folderList.map((f) => (f === oldN ? newN : f));
      const folderParents: Record<string, string | null> = {};
      Object.keys(s.folderParents).forEach((k) => {
        const nk = k === oldN ? newN : k;
        let v = s.folderParents[k];
        if (v === oldN) v = newN;
        folderParents[nk] = v;
      });
      const expanded = { ...s.expanded };
      if (oldN in expanded) {
        expanded[newN] = expanded[oldN];
        delete expanded[oldN];
      }
      const notes = s.notes.map((n) => (n.folder === oldN ? { ...n, folder: newN } : n));
      return { folderList, folderParents, expanded, notes, folderRenaming: null };
    });
  },
  onFolderRenameDraft: (v) => set({ folderRenameDraft: v }),
  onFolderContext: (name, x, y) => set({ folderCtx: { name, x, y } }),
  closeFolderCtx: () => set({ folderCtx: null }),
  newSubfolder: (parent) => {
    let base = "New Folder",
      name = base,
      i = 2;
    while (get().folderList.includes(name)) {
      name = base + " " + i;
      i++;
    }
    set((s) => ({
      folderList: [...s.folderList, name],
      folderParents: { ...s.folderParents, [name]: parent || null },
      expanded: { ...s.expanded, [parent]: true, [name]: true },
      folderRenaming: name,
      folderRenameDraft: name,
      folderCtx: null,
    }));
  },
  requestDeleteFolder: (name, onDeleted) => set({ folderDeleteRequest: { name, onDeleted } }),
  closeFolderDeleteRequest: () => set({ folderDeleteRequest: null }),
  resolveFolderDelete: (mode, targetFolder) => {
    const req = get().folderDeleteRequest;
    if (!req) return;
    const { name, onDeleted } = req;
    set((s) => {
      // Subfolders always move up to this folder's own parent, regardless
      // of what's chosen for the notes directly inside it — only the notes
      // choice (keep/move/delete) is new; child-folder reparenting is the
      // same thing deleting a folder always did.
      const parent = s.folderParents[name] || "";
      const folderList = s.folderList.filter((f) => f !== name);
      const folderParents: Record<string, string | null> = {};
      Object.keys(s.folderParents).forEach((k) => {
        if (k === name) return;
        let v = s.folderParents[k];
        if (v === name) v = parent || null;
        folderParents[k] = v;
      });
      const expanded = { ...s.expanded };
      delete expanded[name];

      if (mode === "delete") {
        const ids = new Set(s.notes.filter((n) => n.folder === name).map((n) => n.id));
        const notes = s.notes.filter((n) => !ids.has(n.id));
        const tabs = s.tabs.map((t) => {
          const hist = t.hist.filter((v) => !(v.kind === "note" && v.id && ids.has(v.id)));
          if (!hist.length) return mkTab({ kind: "home" });
          return { hist, hi: Math.min(t.hi, hist.length - 1) };
        });
        let split = s.split;
        if (split) {
          const st = split.tabs
            .map((t) => ({ hist: t.hist.filter((v) => !(v.kind === "note" && v.id && ids.has(v.id))), hi: 0 }))
            .filter((t) => t.hist.length);
          split = st.length ? { ...split, tabs: st, active: Math.min(split.active, st.length - 1) } : null;
        }
        return {
          folderList,
          folderParents,
          expanded,
          notes,
          tabs,
          split,
          noteDeleteEvent: ids.size ? { ids: [...ids] } : s.noteDeleteEvent,
          folderDeleteRequest: null,
        };
      }
      const dest = mode === "move" && targetFolder ? targetFolder : parent || "";
      const notes = s.notes.map((n) => (n.folder === name ? { ...n, folder: dest } : n));
      return { folderList, folderParents, expanded, notes, folderDeleteRequest: null };
    });
    onDeleted?.();
  },
  moveNoteTo: (id, folder) =>
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, folder } : n)), dragOverFolder: null, draggingId: null })),

  // ---------- search / sort ----------
  toggleSearchMode: () => set((s) => ({ sideMode: s.sideMode === "search" ? "files" : "search" })),
  onSearchQuery: (v) => set({ searchQuery: v }),
  clearSearch: () => set({ searchQuery: "" }),
  onSearchKey: (key) => {
    if (key === "Enter") {
      const q = get().searchQuery.trim();
      if (q) set((s) => ({ searchHistory: [q, ...s.searchHistory.filter((x) => x !== q)].slice(0, 8) }));
    }
  },
  clearHistory: () => set({ searchHistory: [] }),
  openSearch: (q) => set({ sideMode: "search", searchQuery: q, leftOpen: true }),
  toggleSortMenu: () => set((s) => ({ sortMenuOpen: !s.sortMenuOpen })),
  setSort: (k) => set({ sort: k, sortMenuOpen: false }),

  // ---------- meta / category / tags ----------
  openMeta: () => set({ metaOpen: true, noteMenuOpen: false }),
  // A freshly created note opens with its properties panel showing, in
  // whichever pane it was opened in.
  openNewNoteMeta: () => {
    if (get().lastPane === "split" && get().split) get().splitOpenMeta();
    else get().openMeta();
  },
  closeMeta: () => set({ metaOpen: false, catMenuOpen: false }),
  toggleCatMenu: () => set((s) => ({ catMenuOpen: !s.catMenuOpen, catQuery: "" })),
  setCategory: (cat) => {
    const id = get().curId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, category: cat } : n)), catMenuOpen: false, catQuery: "" }));
  },
  clearCategory: () => {
    const id = get().curId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, category: "" } : n)), catMenuOpen: false, catQuery: "" }));
  },
  addCategoryGlobal: (name) => {
    name = name.trim();
    if (!name) return;
    set((s) => (s.categories.includes(name) ? {} : { categories: [...s.categories, name] }));
  },
  onCatSearch: (v) => set({ catQuery: v }),
  onCatSearchKey: (key) => {
    if (key === "Enter") {
      const v = get().catQuery.trim();
      if (!v) return;
      const exact = get().categories.find((c) => c.toLowerCase() === v.toLowerCase());
      if (exact) get().setCategory(exact);
      else {
        get().addCategoryGlobal(v);
        get().setCategory(v);
      }
    } else if (key === "Escape") {
      set({ catMenuOpen: false });
    }
  },
  catCreate: () => {
    const v = get().catQuery.trim();
    if (!v) return;
    get().addCategoryGlobal(v);
    get().setCategory(v);
  },
  onTagDraft: (v) => set({ tagDraft: v }),
  addTag: (tag) => {
    tag = tag.replace(/^#/, "").trim();
    const id = get().curId();
    if (!tag || !id) return;
    set((s) => ({
      notes: s.notes.map((n) => {
        if (n.id !== id) return n;
        const t = n.tags || [];
        return t.includes(tag) ? n : { ...n, tags: [...t, tag] };
      }),
      tagDraft: "",
    }));
  },
  removeNoteTag: (id, tag) =>
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, tags: (n.tags || []).filter((x) => x !== tag) } : n)) })),
  onDate: (v) => {
    const id = get().curId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, date: v } : n)) }));
  },

  // ---------- categories view ----------
  onCatContext: (name, x, y) => set({ catCtx: { name, x, y } }),
  closeCatCtx: () => set({ catCtx: null }),
  catCtxRename: () => {
    const name = get().catCtx?.name;
    set({ catCtx: null, catRenaming: name || null });
  },
  catCtxDelete: () => {
    const name = get().catCtx?.name;
    set({ catCtx: null });
    if (name) get().requestDeleteCategory(name);
  },
  requestDeleteCategory: (name, onDeleted) => set({ catDeleteRequest: { name, onDeleted } }),
  closeCatDeleteRequest: () => set({ catDeleteRequest: null }),
  resolveCategoryDelete: (mode, targetCategory) => {
    const req = get().catDeleteRequest;
    if (!req) return;
    const { name, onDeleted } = req;
    if (mode === "delete") {
      const ids = new Set(get().notes.filter((n) => n.category === name).map((n) => n.id));
      set((s) => {
        const notes = s.notes.filter((n) => !ids.has(n.id));
        const tabs = s.tabs.map((t) => {
          const hist = t.hist.filter((v) => !(v.kind === "note" && v.id && ids.has(v.id)));
          if (!hist.length) return mkTab({ kind: "home" });
          return { hist, hi: Math.min(t.hi, hist.length - 1) };
        });
        let split = s.split;
        if (split) {
          const st = split.tabs
            .map((t) => ({ hist: t.hist.filter((v) => !(v.kind === "note" && v.id && ids.has(v.id))), hi: 0 }))
            .filter((t) => t.hist.length);
          split = st.length ? { ...split, tabs: st, active: Math.min(split.active, st.length - 1) } : null;
        }
        return {
          notes,
          tabs,
          split,
          categories: s.categories.filter((c) => c !== name),
          pinnedCategories: s.pinnedCategories.filter((c) => c !== name),
          noteDeleteEvent: ids.size ? { ids: [...ids] } : s.noteDeleteEvent,
          catDeleteRequest: null,
        };
      });
    } else if (mode === "move" && targetCategory) {
      set((s) => ({
        notes: s.notes.map((n) => (n.category === name ? { ...n, category: targetCategory } : n)),
        categories: s.categories.filter((c) => c !== name),
        pinnedCategories: s.pinnedCategories.filter((c) => c !== name),
        catDeleteRequest: null,
      }));
    } else {
      set((s) => ({
        categories: s.categories.filter((c) => c !== name),
        pinnedCategories: s.pinnedCategories.filter((c) => c !== name),
        notes: s.notes.map((n) => (n.category === name ? { ...n, category: "" } : n)),
        catDeleteRequest: null,
      }));
    }
    onDeleted?.();
  },
  renameCategory: (oldN, newN) => {
    newN = (newN || "").trim();
    set((s) => {
      if (!newN || (s.categories.includes(newN) && newN.toLowerCase() !== oldN.toLowerCase())) return { catRenaming: null };
      return {
        categories: s.categories.map((c) => (c === oldN ? newN : c)),
        pinnedCategories: s.pinnedCategories.map((c) => (c === oldN ? newN : c)),
        notes: s.notes.map((n) => (n.category === oldN ? { ...n, category: newN } : n)),
        catRenaming: null,
      };
    });
  },
  addCategoryTop: (name) => {
    const v = name.trim();
    if (v) get().addCategoryGlobal(v);
  },
  togglePinCategory: (name) =>
    set((s) => ({
      pinnedCategories: s.pinnedCategories.includes(name) ? s.pinnedCategories.filter((c) => c !== name) : [...s.pinnedCategories, name],
    })),

  // ---------- note menu / accent / theme ----------
  toggleNoteMenu: () => set((s) => ({ noteMenuOpen: !s.noteMenuOpen, noteMenuMove: false })),
  menuDuplicate: () => {
    const id = get().curId();
    set({ noteMenuOpen: false });
    if (id) get().duplicateNote(id);
  },
  menuMoveStart: () => set({ noteMenuMove: true }),
  menuMoveTo: (folder) => {
    const id = get().curId();
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, folder } : n)), noteMenuOpen: false, noteMenuMove: false }));
  },
  setAccent: (hex) => {
    set({ accentOverride: hex });
    try {
      localStorage.setItem("kv-accent", hex);
    } catch {}
  },
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openConfirm: (cfg) =>
    set({
      confirmDialog: { title: cfg.title, message: cfg.message, confirmLabel: cfg.confirmLabel || "Delete", onConfirm: cfg.onConfirm, onCancel: cfg.onCancel },
    }),
  closeConfirm: () => set({ confirmDialog: null }),
  setTheme: (t) => {
    set({ themeOverride: t });
    try {
      localStorage.setItem("kv-theme", t);
    } catch {}
  },

  // ---------- undo/redo ----------
  pushUndo: (id, content) => {
    if (!id) return;
    const undo = get()._undo;
    const u = undo[id] || { stack: [], redo: [], t: 0 };
    const now = Date.now();
    if (u.stack.length && u.stack[u.stack.length - 1] === content) return;
    if (u.stack.length && now - u.t < 450) {
      u.t = now;
      return;
    }
    u.stack.push(content);
    if (u.stack.length > 100) u.stack.shift();
    u.redo = [];
    u.t = now;
    set({ _undo: { ...undo, [id]: u } });
  },
  // Takes the note id explicitly (from the LiveEditor instance handling the
  // keypress) rather than reading curId() — that only ever named the main
  // pane's note, so Cmd+Z while typing in the split pane silently undid (or
  // no-opped on) the wrong note's history instead of the one being edited.
  undo: (id) => {
    if (!id) return;
    const u = get()._undo[id];
    if (!u || !u.stack.length) return;
    const n = get().notes.find((x) => x.id === id);
    if (!n) return;
    u.redo.push(n.content);
    const prev = u.stack.pop()!;
    set((s) => ({ notes: s.notes.map((x) => (x.id === id ? { ...x, content: prev } : x)) }));
  },
  redo: (id) => {
    if (!id) return;
    const u = get()._undo[id];
    if (!u || !u.redo.length) return;
    const n = get().notes.find((x) => x.id === id);
    if (!n) return;
    u.stack.push(n.content);
    const next = u.redo.pop()!;
    set((s) => ({ notes: s.notes.map((x) => (x.id === id ? { ...x, content: next } : x)) }));
  },

  // ---------- multiselect / bulk ----------
  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      return { selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id], selectAnchor: id };
    }),
  clearSelection: () => set({ selectedIds: [], selectAnchor: null }),
  rowClick: (id, opts, order) => {
    if (opts.meta) {
      get().toggleSelect(id);
      return;
    }
    if (opts.shift && get().selectAnchor) {
      const a = order.indexOf(get().selectAnchor!);
      const b = order.indexOf(id);
      if (a === -1 || b === -1) {
        get().toggleSelect(id);
        return;
      }
      const lo = Math.min(a, b),
        hi = Math.max(a, b);
      set({ selectedIds: order.slice(lo, hi + 1) });
      return;
    }
    // A plain click also marks where a later Shift-click range starts.
    set({ selectedIds: [], selectAnchor: id });
    get().navigate(id);
  },
  openBulkCtx: (x, y) => set({ bulkCtx: { x, y, move: false } }),
  closeBulkCtx: () => set({ bulkCtx: null }),
  bulkCtxMoveStart: () => set((s) => ({ bulkCtx: s.bulkCtx ? { ...s.bulkCtx, move: true } : null })),
  bulkNewFolder: () => {
    const ids = get().selectedIds;
    let base = "New Folder",
      name = base,
      i = 2;
    while (get().folderList.includes(name)) {
      name = base + " " + i;
      i++;
    }
    set((s) => ({
      folderList: [...s.folderList, name],
      expanded: { ...s.expanded, [name]: true },
      notes: s.notes.map((n) => (ids.includes(n.id) ? { ...n, folder: name } : n)),
      bulkCtx: null,
      selectedIds: [],
      folderRenaming: name,
      folderRenameDraft: name,
    }));
  },
  bulkMoveTo: (folder) => {
    const ids = get().selectedIds;
    set((s) => ({ notes: s.notes.map((n) => (ids.includes(n.id) ? { ...n, folder } : n)), bulkCtx: null, selectedIds: [] }));
  },
  bulkDelete: () => {
    const ids = new Set(get().selectedIds);
    set((s) => {
      const notes = s.notes.filter((n) => !ids.has(n.id));
      const tabs = s.tabs.map((t) => {
        const hist = t.hist.filter((v) => !(v.kind === "note" && v.id && ids.has(v.id)));
        if (!hist.length) return mkTab({ kind: "home" });
        return { hist, hi: Math.min(t.hi, hist.length - 1) };
      });
      let split = s.split;
      if (split) {
        const st = split.tabs
          .map((t) => ({ hist: t.hist.filter((v) => !(v.kind === "note" && v.id && ids.has(v.id))), hi: 0 }))
          .filter((t) => t.hist.length);
        split = st.length ? { ...split, tabs: st, active: Math.min(split.active, st.length - 1) } : null;
      }
      return { notes, tabs, split, selectedIds: [], bulkCtx: null, noteDeleteEvent: { ids: [...ids] } };
    });
  },
  onAppFont: (v) => set({ appFont: v }),
  onNoteFont: (v) => set({ noteFont: v }),
  onTitleFont: (v) => set({ titleFont: v }),

  // ---------- import/export/attach ----------
  exportJson: () => {
    const s = get();
    const data = {
      vault: "My Vault",
      exportedAt: new Date().toISOString(),
      folders: s.folderList,
      categories: s.categories,
      notes: s.notes,
    };
    downloadFile("my-vault.json", JSON.stringify(data, null, 2), "application/json");
    set({ settingsOpen: false, noteMenuOpen: false });
  },
  // Each note becomes its own .md file with the same frontmatter exportNote()
  // uses, laid out in a folder tree (walking folderParents for nested
  // folders) so the zip drops straight into Obsidian (or any other
  // folder-of-markdown-files app) as-is, unlike the JSON export.
  exportMarkdownZip: async () => {
    const s = get();
    const zip = new JSZip();
    const folderPath = (folder: string): string => {
      if (!folder) return "";
      const parts: string[] = [folder];
      let p = s.folderParents[folder];
      while (p) {
        parts.unshift(p);
        p = s.folderParents[p];
      }
      return parts.join("/");
    };
    const usedNames = new Map<string, number>();
    s.notes.forEach((n) => {
      const dir = folderPath(n.folder);
      const base = (n.title || "Untitled").replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";
      const key = dir + "/" + base;
      const count = usedNames.get(key) || 0;
      usedNames.set(key, count + 1);
      const filename = base + (count ? ` ${count + 1}` : "") + ".md";
      const path = dir ? `${dir}/${filename}` : filename;
      zip.file(path, noteToMarkdownFile(n));
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob("vault-markdown.zip", blob);
    set({ settingsOpen: false, noteMenuOpen: false });
  },
  // Same shape as exportMarkdownZip but scoped to one category's notes,
  // flat (no folder tree — category isn't a folder concept) — triggered
  // from a category card's or category page's "..." menu.
  exportCategoryMarkdownZip: async (name) => {
    const notes = get().notes.filter((n) => n.category === name);
    if (!notes.length) return;
    const zip = new JSZip();
    const usedNames = new Map<string, number>();
    notes.forEach((n) => {
      const base = (n.title || "Untitled").replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";
      const count = usedNames.get(base) || 0;
      usedNames.set(base, count + 1);
      const filename = base + (count ? ` ${count + 1}` : "") + ".md";
      zip.file(filename, noteToMarkdownFile(n));
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = (name || "category").replace(/[\\/:*?"<>|]/g, "-").trim() || "category";
    downloadBlob(`${zipName}.zip`, blob);
  },
  exportNote: () => {
    const n = get().cur();
    if (n) downloadFile((n.title || "note") + ".md", noteToMarkdownFile(n), "text/markdown");
    set({ noteMenuOpen: false });
  },
  importMarkdown: (files) => {
    const created: Note[] = files.map((f) => {
      const parsed = parseMarkdownFile(normalizeLineEndings(f.text));
      return {
        id: newId(),
        title: f.name.replace(/\.(md|markdown|txt)$/i, ""),
        folder: parsed.folder ?? "Notes",
        date: parsed.date ?? TODAY,
        modified: new Date().toISOString(),
        category: parsed.category ?? "",
        tags: parsed.tags ?? [],
        attachments: {},
        content: parsed.content,
        bookmarked: parsed.bookmarked,
        daily: parsed.daily,
      };
    });
    if (!created.length) return;
    // A note can carry a folder/category this vault doesn't have yet (e.g.
    // re-importing a note exported from a different vault) — register
    // those too, or the note would exist but never show up in the sidebar/
    // categories view under the name its own frontmatter claims.
    const newFolders = [...new Set(created.map((n) => n.folder).filter(Boolean))];
    const newCats = [...new Set(created.map((n) => n.category).filter(Boolean))];
    set((s) => ({
      notes: [...s.notes, ...created],
      folderList: [...new Set([...s.folderList, ...newFolders])],
      categories: [...new Set([...s.categories, ...newCats])],
      settingsOpen: false,
    }));
    get().navigate(created[0].id);
  },
  // Restores a vault previously exported via exportJson — merges by note
  // id (a note that already exists locally is overwritten with the
  // imported version, a new one is added), so re-importing the same
  // backup is idempotent instead of duplicating everything each time.
  importJson: (data) => {
    if (!data || typeof data !== "object" || !Array.isArray((data as { notes?: unknown }).notes)) {
      return { ok: false, error: "That file doesn't look like a vault export (missing a notes array)." };
    }
    const parsed = data as { notes: Note[]; folders?: string[]; categories?: string[] };
    set((s) => {
      const byId = new Map(s.notes.map((n) => [n.id, n]));
      parsed.notes.forEach((n) => byId.set(n.id, n));
      return {
        notes: [...byId.values()],
        folderList: [...new Set([...s.folderList, ...(parsed.folders || [])])],
        categories: [...new Set([...s.categories, ...(parsed.categories || [])])],
        settingsOpen: false,
      };
    });
    return { ok: true };
  },
  attachFiles: (files, noteId) => {
    const id = noteId || get().curId();
    if (!id || !files.length) return;
    const add: Record<string, Attachment> = {};
    const inserts: string[] = [];
    files.forEach((f) => {
      add[f.name] = { url: f.dataUrl, type: f.type || "", w: "100%" };
      inserts.push("![[" + f.name + "]]");
    });
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id !== id
          ? n
          : {
              ...n,
              attachments: { ...(n.attachments || {}), ...add },
              content: n.content.replace(/\s*$/, "") + "\n\n" + inserts.join("\n\n") + "\n",
            },
      ),
      noteMenuOpen: false,
    }));
  },

  // ---------- note context menu ----------
  onNoteContext: (id, x, y) => {
    if (get().selectedIds.includes(id) && get().selectedIds.length > 1) {
      get().openBulkCtx(x, y);
      return;
    }
    set({ ctxMenu: { id, x, y }, ctxMove: false });
  },
  closeCtx: () => set({ ctxMenu: null, ctxMove: false }),
  ctxOpenNote: () => {
    const id = get().ctxMenu?.id;
    set({ ctxMenu: null });
    if (id) get().openNoteNewTab(id);
  },
  ctxDuplicate: () => {
    const id = get().ctxMenu?.id;
    const o = get().notes.find((n) => n.id === id);
    if (!o) {
      set({ ctxMenu: null });
      return;
    }
    const nid = newId();
    const copy: Note = { ...o, id: nid, title: o.title + " copy", tags: [...(o.tags || [])], attachments: { ...(o.attachments || {}) } };
    set((s) => ({ notes: [...s.notes, copy], ctxMenu: null }));
    get().navigate(nid);
  },
  ctxRename: () => {
    const id = get().ctxMenu?.id;
    set({ ctxMenu: null, renaming: id || null, sideMode: "files" });
  },
  ctxDelete: () => {
    const id = get().ctxMenu?.id;
    set({ ctxMenu: null });
    if (id) get().deleteNote(id);
  },
  ctxMoveStart: () => set({ ctxMove: true }),
  moveCtx: (folder) => {
    const id = get().ctxMenu?.id;
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, folder } : n)), ctxMenu: null, ctxMove: false }));
  },
  onRenameLive: (id, v) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, title: v } : n)) })),
  stopRename: () => set({ renaming: null }),
  startRenaming: (id) => set({ renaming: id }),

  // ---------- drag/drop ----------
  setDraggingId: (id) => set({ draggingId: id, draggingFolder: null }),
  setDraggingFolder: (name) => set({ draggingFolder: name, draggingId: null }),
  setDragOverFolder: (name) => set({ dragOverFolder: name }),

  // ---------- journal ----------
  prevMonth: () =>
    set((s) => {
      let m = s.calMonth - 1,
        y = s.calYear;
      if (m < 0) {
        m = 11;
        y--;
      }
      return { calMonth: m, calYear: y };
    }),
  nextMonth: () =>
    set((s) => {
      let m = s.calMonth + 1,
        y = s.calYear;
      if (m > 11) {
        m = 0;
        y++;
      }
      return { calMonth: m, calYear: y };
    }),
  setCalSelected: (iso) => set({ calSelected: iso }),
  newDaily: () => get().openOrCreate(get().calSelected, "Journal"),

  // ---------- quick switcher / cmd palette ----------
  onQuick: (v) => set({ quickQuery: v }),
  toggleQuick: () => set((s) => ({ quickOpen: !s.quickOpen, cmdOpen: false, quickQuery: "" })),
  closeQuick: () => set({ quickOpen: false }),
  onCmd: (v) => set({ cmdQuery: v }),
  openCmd: () => set((s) => ({ cmdOpen: !s.cmdOpen, quickOpen: false, cmdQuery: "" })),
  closeCmd: () => set({ cmdOpen: false }),

  closeAllMenus: () =>
    set({
      quickOpen: false,
      cmdOpen: false,
      catMenuOpen: false,
      ctxMenu: null,
      catCtx: null,
      catDeleteRequest: null,
      sortMenuOpen: false,
      noteMenuOpen: false,
      noteMenuMove: false,
      settingsOpen: false,
      linkQuery: null,
      tagAcQuery: null,
      folderCtx: null,
      folderDeleteRequest: null,
      bulkCtx: null,
    }),
  openCheat: () => set({ cheatOpen: true }),
  closeCheat: () => set({ cheatOpen: false }),
  resetVaultContent: () =>
    set({
      notes: [],
      folderList: [],
      folderParents: {},
      categories: [],
      pinnedCategories: [],
      tabs: [mkTab({ kind: "home" })],
      active: 0,
      split: null,
      lastPane: "main",
      selectedIds: [],
      selectAnchor: null,
      renaming: null,
      folderRenaming: null,
      ctxMenu: null,
      catCtx: null,
      catDeleteRequest: null,
      folderCtx: null,
      folderDeleteRequest: null,
      bulkCtx: null,
      expanded: {},
      searchQuery: "",
      calSelected: TODAY,
      settingsOpen: false,
    }),
}));

export function downloadFile(name: string, text: string, type?: string) {
  downloadBlob(name, new Blob([text], { type: type || "text/plain" }));
}

export function downloadBlob(name: string, blob: Blob) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {}
}

export function copyText(text: string) {
  let ok = false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {}
  if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
