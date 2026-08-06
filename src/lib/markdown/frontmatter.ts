import type { Note } from "@/types/vault";

/** A single .md file has nowhere to put a note's properties except a YAML
 * frontmatter block at the top — without it, exporting/re-importing a note
 * as markdown silently drops its category, tags, date, folder, and
 * bookmarked state. Attachments aren't included here: embedding binary data
 * as base64 in a text file isn't practical, and the JSON export/import
 * (which carries the full Note object, attachments included) already
 * covers that case. */
function yamlScalar(s: string): string {
  if (s === "" || /[:#[\]{}",\n]/.test(s) || s.trim() !== s) return JSON.stringify(s);
  return s;
}

export function noteToMarkdownFile(note: Note): string {
  const lines: string[] = [];
  if (note.category) lines.push(`category: ${yamlScalar(note.category)}`);
  if (note.tags && note.tags.length) lines.push(`tags: [${note.tags.map(yamlScalar).join(", ")}]`);
  if (note.date) lines.push(`date: ${note.date}`);
  if (note.folder) lines.push(`folder: ${yamlScalar(note.folder)}`);
  if (note.bookmarked) lines.push(`bookmarked: true`);
  if (note.daily) lines.push(`daily: true`);
  if (!lines.length) return note.content;
  return `---\n${lines.join("\n")}\n---\n${note.content}`;
}

export interface ParsedMarkdownFile {
  category?: string;
  tags?: string[];
  date?: string;
  folder?: string;
  bookmarked?: boolean;
  daily?: boolean;
  content: string;
}

function unquote(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

/** Parses the frontmatter this app writes; tolerant of a plain .md file
 * with no frontmatter at all (just returns the whole thing as content),
 * so importing any ordinary markdown file still works as before. */
export function parseMarkdownFile(text: string): ParsedMarkdownFile {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { content: text };
  const [, fm, rest] = m;
  const result: ParsedMarkdownFile = { content: rest };
  fm.split("\n").forEach((line) => {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) return;
    const [, key, rawVal] = kv;
    const val = rawVal.trim();
    if (key === "category") result.category = unquote(val);
    else if (key === "date") result.date = unquote(val);
    else if (key === "folder") result.folder = unquote(val);
    else if (key === "bookmarked") result.bookmarked = val === "true";
    else if (key === "daily") result.daily = val === "true";
    else if (key === "tags") {
      const arrM = val.match(/^\[(.*)\]$/);
      if (arrM) {
        result.tags = arrM[1]
          .split(",")
          .map((t) => unquote(t))
          .filter(Boolean);
      }
    }
  });
  return result;
}
