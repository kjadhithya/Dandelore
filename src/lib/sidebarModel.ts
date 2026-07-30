import type { Note } from "@/types/vault";
import { sortNotes } from "@/lib/store/useVaultStore";
import type { SortKey } from "@/types/vault";

export interface FolderRow {
  name: string;
  depth: number;
  count: number;
  open: boolean;
  notes: Note[];
}

export function buildFolderRows(
  folderList: string[],
  folderParents: Record<string, string | null>,
  notes: Note[],
  expanded: Record<string, boolean>,
  sort: SortKey,
): FolderRow[] {
  const childrenOf = (parent: string | null) =>
    folderList.filter((f) => (folderParents[f] || null) === parent).sort((a, b) => a.localeCompare(b));

  const notesIn = (name: string) => sortNotes(notes.filter((n) => n.folder === name), sort);

  const countRecursive = (name: string): number => {
    let c = notesIn(name).length;
    childrenOf(name).forEach((child) => (c += countRecursive(child)));
    return c;
  };

  const rows: FolderRow[] = [];
  const walk = (parent: string | null, depth: number) => {
    childrenOf(parent).forEach((name) => {
      const open = !!expanded[name];
      rows.push({ name, depth, count: countRecursive(name), open, notes: open ? notesIn(name) : [] });
      if (open) walk(name, depth + 1);
    });
  };
  walk(null, 0);
  return rows;
}

export function rootNotes(notes: Note[], folderList: string[], sort: SortKey): Note[] {
  return sortNotes(
    notes.filter((n) => !n.folder || !folderList.includes(n.folder)),
    sort,
  );
}
