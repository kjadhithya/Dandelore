export interface Attachment {
  url: string;
  type: string;
  w: string;
}

export interface Note {
  id: string;
  title: string;
  folder: string;
  date: string;
  modified: string;
  category: string;
  tags: string[];
  attachments: Record<string, Attachment>;
  content: string;
  daily?: boolean;
  deletedAt?: string | null;
  bookmarked?: boolean;
}

export type ViewKind = "note" | "graph" | "journal" | "categories" | "category" | "bookmarks" | "home";

export interface View {
  kind: ViewKind;
  id?: string;
}

export interface TabState {
  hist: View[];
  hi: number;
}

export interface SplitState {
  dir: "right" | "down";
  tabs: TabState[];
  active: number;
}

export type ThemeName = "Light" | "Light Warm" | "Dark" | "Dark Warm";
export type AppFontName = "Sans" | "Serif" | "System" | "Lora" | "Mono";

export interface FolderCtx {
  name: string;
  x: number;
  y: number;
}

export interface NoteCtx {
  id: string;
  x: number;
  y: number;
}

export interface BulkCtx {
  x: number;
  y: number;
  move: boolean;
}

export interface CatCtx {
  name: string;
  x: number;
  y: number;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface VaultState {
  notes: Note[];
  // Set to a fresh object (never mutated) whenever deleteNote/bulkDelete
  // actually remove a note — the sync worker watches this by reference to
  // push an explicit delete, instead of inferring deletion from the notes
  // array shrinking (which also happens harmlessly during hydrate/pull and
  // was previously mis-firing deletes against Supabase).
  noteDeleteEvent: { ids: string[] } | null;
  folderList: string[];
  folderParents: Record<string, string | null>;
  folderRenaming: string | null;
  folderRenameDraft: string;
  folderCtx: FolderCtx | null;
  draggingFolder: string | null;

  categories: string[];

  tabs: TabState[];
  active: number;
  split: SplitState | null;
  splitReading: boolean;
  cheatOpen: boolean;
  lastPane: "main" | "split";
  splitSize: number;
  splitMetaOpen: boolean;
  splitTagDraft: string;
  splitNoteMenuOpen: boolean;
  splitNoteMenuMove: boolean;

  leftOpen: boolean;
  leftWidth: number;
  showRight: boolean;

  // Last error from a Supabase push/pull, surfaced in Settings so sync
  // failures are visible without needing devtools — cleared on the next
  // successful sync of the same kind.
  syncError: string | null;

  sideMode: "files" | "search";
  expanded: Record<string, boolean>;

  searchQuery: string;
  searchHistory: string[];

  sort: SortKey;
  sortMenuOpen: boolean;
  autoReveal: boolean;

  themeOverride: ThemeName | null;
  accentOverride: string | null;
  settingsOpen: boolean;
  confirmDialog: ConfirmDialogState | null;
  selectedIds: string[];
  selectAnchor: string | null;
  bulkCtx: BulkCtx | null;

  appFont: AppFontName;
  noteFont: AppFontName;
  titleFont: AppFontName;

  reading: boolean;

  metaOpen: boolean;
  catMenuOpen: boolean;
  catQuery: string;
  tagDraft: string;

  noteMenuOpen: boolean;
  noteMenuMove: boolean;

  catCtx: CatCtx | null;
  catRenaming: string | null;

  linkQuery: string | null;
  tagAcQuery: string | null;
  linkPos: { x: number; y: number };
  linkActiveIdx: number;

  ctxMenu: NoteCtx | null;
  ctxMove: boolean;
  renaming: string | null;
  draggingId: string | null;
  dragOverFolder: string | null;
  rootDragOver: boolean;

  calYear: number;
  calMonth: number;
  calSelected: string;

  quickOpen: boolean;
  quickQuery: string;
  cmdOpen: boolean;
  cmdQuery: string;
}

export type SortKey =
  | "name-az"
  | "name-za"
  | "created-new"
  | "created-old"
  | "mod-new"
  | "mod-old";
