"use client";
import { create } from "zustand";

// Graph view settings, modelled on Obsidian's graph settings panel (same
// sections, controls, ranges and defaults), shared by every open graph view.
// Like the theme and fonts, they (and graph bookmarks) sync across devices
// through vault_settings (see syncWorker); localStorage is just this
// device's copy so the graph opens with them before the sync has loaded.

export interface GraphGroup {
  query: string;
  color: string;
}

export interface GraphSettings {
  // Filters
  search: string;
  showTags: boolean;
  showAttachments: boolean;
  existingOnly: boolean;
  showOrphans: boolean;
  // Groups
  groups: GraphGroup[];
  // Display
  arrows: boolean;
  textFade: number; // -3 … 3
  nodeSize: number; // 0.1 … 5
  linkThickness: number; // 0.1 … 5
  // Forces
  centerForce: number; // 0 … 1
  repelForce: number; // 0 … 20
  linkForce: number; // 0 … 1
  linkDistance: number; // 30 … 500
}

export type GraphSection = "filters" | "groups" | "display" | "forces";

export const GRAPH_DEFAULTS: GraphSettings = {
  search: "",
  showTags: false,
  showAttachments: false,
  existingOnly: false,
  showOrphans: true,
  groups: [],
  arrows: false,
  textFade: 0,
  nodeSize: 1,
  linkThickness: 1,
  centerForce: 0.52,
  repelForce: 10,
  linkForce: 1,
  linkDistance: 250,
};

/** A saved graph view (from the graph's ⋯ → Bookmark…). */
export interface GraphBookmark {
  id: string;
  title: string;
  settings: GraphSettings;
  created: string;
}

// The device copy is kept per vault (account), so signing into a different
// account on the same browser never shows — or syncs — the first account's
// graph settings and bookmarks. Panel open/closed state is just a device UI
// preference and stays shared.
let vaultKey = "";
const settingsKey = () => "kv-graph" + vaultKey;
const bookmarksKey = () => "kv-graphBookmarks" + vaultKey;
const COLLAPSED_KEY = "kv-graphCollapsed";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the setting just won't be remembered */
  }
}

interface GraphSettingsStore {
  settings: GraphSettings;
  collapsed: Record<GraphSection, boolean>;
  bookmarks: GraphBookmark[];
  hydrated: boolean;
  hydrate: () => void;
  /** Switch to the signed-in vault's device copy (called by the sync). */
  setVault: (vaultId: string) => void;
  set: (patch: Partial<GraphSettings>) => void;
  reset: () => void;
  toggleSection: (s: GraphSection) => void;
  setGroup: (i: number, patch: Partial<GraphGroup>) => void;
  addGroup: () => void;
  removeGroup: (i: number) => void;
  addBookmark: (title: string) => void;
  removeBookmark: (id: string) => void;
  applyBookmark: (id: string) => void;
  /** Values that arrived from another device (via the sync). */
  applyRemote: (remote: { settings?: Partial<GraphSettings> | null; bookmarks?: GraphBookmark[] | null }) => void;
}

// Obsidian gives each new group a random colour; these are picked to stay
// readable on both light and dark themes.
const GROUP_COLORS = ["#e05252", "#e0a252", "#c9c94a", "#5fb85f", "#4ab5c9", "#5a7fe0", "#a35ae0", "#e05aa8"];

export const useGraphSettings = create<GraphSettingsStore>((set, get) => ({
  settings: GRAPH_DEFAULTS,
  collapsed: { filters: false, groups: false, display: false, forces: false },
  bookmarks: [],
  hydrated: false,
  setVault: (vaultId) => {
    const key = ":" + vaultId;
    if (vaultKey === key && get().hydrated) return;
    vaultKey = key;
    set({ hydrated: false, settings: GRAPH_DEFAULTS, bookmarks: [] });
    get().hydrate();
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({
      settings: { ...GRAPH_DEFAULTS, ...load<Partial<GraphSettings>>(settingsKey(), {}) },
      collapsed: { ...get().collapsed, ...load<Partial<Record<GraphSection, boolean>>>(COLLAPSED_KEY, {}) },
      bookmarks: load<GraphBookmark[]>(bookmarksKey(), []),
      hydrated: true,
    });
  },
  set: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    save(settingsKey(), settings);
  },
  reset: () => {
    // Obsidian's "Restore default settings" leaves groups alone.
    const settings = { ...GRAPH_DEFAULTS, groups: get().settings.groups };
    set({ settings });
    save(settingsKey(), settings);
  },
  toggleSection: (s) => {
    const collapsed = { ...get().collapsed, [s]: !get().collapsed[s] };
    set({ collapsed });
    save(COLLAPSED_KEY, collapsed);
  },
  setGroup: (i, patch) => {
    const groups = get().settings.groups.map((g, k) => (k === i ? { ...g, ...patch } : g));
    get().set({ groups });
  },
  addGroup: () => {
    const used = get().settings.groups.length;
    get().set({ groups: [...get().settings.groups, { query: "", color: GROUP_COLORS[used % GROUP_COLORS.length] }] });
  },
  removeGroup: (i) => get().set({ groups: get().settings.groups.filter((_, k) => k !== i) }),
  addBookmark: (title) => {
    const b: GraphBookmark = {
      id: "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim() || "Graph view",
      settings: get().settings,
      created: new Date().toISOString(),
    };
    const bookmarks = [...get().bookmarks, b];
    set({ bookmarks });
    save(bookmarksKey(), bookmarks);
  },
  removeBookmark: (id) => {
    const bookmarks = get().bookmarks.filter((b) => b.id !== id);
    set({ bookmarks });
    save(bookmarksKey(), bookmarks);
  },
  applyRemote: ({ settings, bookmarks }) => {
    get().hydrate();
    if (settings) {
      const merged = { ...GRAPH_DEFAULTS, ...settings };
      set({ settings: merged });
      save(settingsKey(), merged);
    }
    if (bookmarks) {
      set({ bookmarks });
      save(bookmarksKey(), bookmarks);
    }
  },
  applyBookmark: (id) => {
    const b = get().bookmarks.find((x) => x.id === id);
    if (b) get().set({ ...GRAPH_DEFAULTS, ...b.settings });
  },
}));
