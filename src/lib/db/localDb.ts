import Dexie, { type Table } from "dexie";
import type { Note } from "@/types/vault";

export interface FolderRow {
  name: string;
  parent: string | null;
}
export interface CategoryRow {
  name: string;
}
export interface SettingsRow {
  key: string;
  value: unknown;
}

export interface QueuedMutation {
  id?: number;
  table: "notes" | "folders" | "categories" | "attachments";
  op: "upsert" | "delete";
  rowId: string;
  payload: unknown;
  createdAt: number;
}

class VaultDB extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<FolderRow, string>;
  categories!: Table<CategoryRow, string>;
  settings!: Table<SettingsRow, string>;
  mutationQueue!: Table<QueuedMutation, number>;

  constructor() {
    super("knowledge-vault");
    this.version(1).stores({
      notes: "id, folder, category, modified",
      folders: "name, parent",
      categories: "name",
      settings: "key",
      mutationQueue: "++id, table, rowId, createdAt",
    });
  }
}

export const localDb = new VaultDB();

export async function isLocalDbEmpty(): Promise<boolean> {
  const count = await localDb.notes.count();
  return count === 0;
}
