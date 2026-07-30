import type { Note } from "@/types/vault";

export const TODAY = new Date().toISOString().slice(0, 10);

const SEED_RAW: Omit<Note, "attachments" | "tags">[] = [
  {
    id: "prd",
    title: "Vault App PRD",
    folder: "Projects",
    date: "2026-07-22",
    modified: "2026-07-24T10:00:00Z",
    category: "Spec",
    content:
      "# Vault App PRD\n\nA fast, distraction-free personal knowledge base. Everything lives in Markdown and syncs to the cloud automatically.\n\n## Principles\n\n- Personal-first, no accounts\n- Markdown-native\n- Offline capable with automatic sync\n\n## Open threads\n\n- [ ] Finalize sync conflict strategy in [[Sync Design]]\n- [x] Lock scope for [[Q3 Roadmap]]\n- [ ] Review notes from [[Standup 2026-07-20]]\n\n> Keep it calm. The tool should disappear and leave only the writing.\n\nSee the [[Markdown Cheatsheet]] for formatting.\n\n#project #spec",
  },
  {
    id: "road",
    title: "Q3 Roadmap",
    folder: "Projects",
    date: "2026-07-21",
    modified: "2026-07-23T10:00:00Z",
    category: "Planning",
    content:
      "# Q3 Roadmap\n\nShipping the core of the [[Vault App PRD]] this quarter.\n\n| Milestone | Status | Owner |\n|---|---|---|\n| Editor + live preview | Done | me |\n| Sync engine | In progress | me |\n| Graph view | Planned | me |\n\n## Focus\n\n1. Reliable [[Sync Design]]\n2. Backlinks everywhere\n3. Keyboard-first navigation\n\n#project #planning",
  },
  {
    id: "sync",
    title: "Sync Design",
    folder: "Projects",
    date: "2026-07-23",
    modified: "2026-07-23T14:00:00Z",
    category: "Spec",
    content:
      "# Sync Design\n\nHow the vault stays consistent across desktops. Ties back to [[Q3 Roadmap]].\n\n## Behavior\n\n- Save locally instantly\n- Queue offline edits, replay on reconnect\n- Handle conflicts using latest version, preserve previous in history\n\n```\nlocal write -> queue -> push -> resolve -> broadcast\n```\n\n#spec #sync",
  },
  {
    id: "standup",
    title: "Standup 2026-07-20",
    folder: "Meetings",
    date: "2026-07-20",
    modified: "2026-07-20T10:00:00Z",
    category: "",
    content:
      "# Standup — 2026-07-20\n\nQuick sync on the [[Vault App PRD]].\n\n## Notes\n\n- Live preview feels good, ship it\n- Need to decide graph layout for [[Q3 Roadmap]]\n- [ ] Draft empty-state copy\n- [x] Merge editor branch\n\n#meeting",
  },
  {
    id: "deep",
    title: "Deep Work — Notes",
    folder: "Notes",
    date: "2026-07-24",
    modified: "2026-07-24T18:00:00Z",
    category: "Personal",
    content:
      "# Deep Work — Notes\n\nReading notes on focus and attention.\n\n## Takeaways\n\n- Depth is a skill you *train*, not a mood you wait for\n- Schedule shallow work into fixed blocks\n- Boredom tolerance protects deep focus\n\nLogged progress in [[2026-07-24]].\n\n#reading #focus",
  },
  {
    id: "garden",
    title: "Garden Journal",
    folder: "Notes",
    date: "2026-07-23",
    modified: "2026-07-23T20:00:00Z",
    category: "Personal",
    content:
      "# Garden Journal\n\nSlow notes from the balcony garden.\n\n- Tomatoes finally setting fruit\n- Basil needs more shade in the afternoon\n- **Next:** repot the rosemary\n\nWeather log lives in [[2026-07-23]].\n\n#garden #personal",
  },
  {
    id: "md",
    title: "Markdown Cheatsheet",
    folder: "Resources",
    date: "2026-07-19",
    modified: "2026-07-19T09:00:00Z",
    category: "Reference",
    content:
      "# Markdown Cheatsheet\n\n**Bold**, *italic*, and `inline code`.\n\n## Lists\n\n- Bullet\n- Another\n\n1. First\n2. Second\n\n## Tasks\n\n- [ ] Todo\n- [x] Done\n\n## Links\n\n- External: [Obsidian](https://obsidian.md)\n- Internal: [[Vault App PRD]]\n\n> Blockquotes look like this.\n\n#reference",
  },
  {
    id: "d24",
    title: "2026-07-24",
    folder: "Journal",
    date: "2026-07-24",
    modified: "2026-07-24T08:00:00Z",
    daily: true,
    category: "",
    content:
      "# 2026-07-24\n\n## Today\n\n- [x] Draft [[Sync Design]]\n- [ ] Deep work block, 90 min\n- [ ] Water the plants — see [[Garden Journal]]\n\n## Notes\n\nMade real progress on the [[Vault App PRD]]. Reading more of [[Deep Work — Notes]] tonight.\n\n#daily",
  },
  {
    id: "d23",
    title: "2026-07-23",
    folder: "Journal",
    date: "2026-07-23",
    modified: "2026-07-23T08:00:00Z",
    daily: true,
    category: "",
    content:
      "# 2026-07-23\n\n## Today\n\n- [x] Standup\n- [x] Tend the balcony — [[Garden Journal]]\n\n## Weather\n\nWarm, light breeze. Good day to write outside.\n\n#daily",
  },
];

export function makeSeedNotes(): Note[] {
  return SEED_RAW.map((n) => ({ ...n, tags: [], attachments: {} }));
}

export const DEFAULT_FOLDERS = [
  "Projects",
  "Meetings",
  "Notes",
  "Resources",
  "Journal",
];
export const DEFAULT_CATEGORIES = ["Spec", "Planning", "Personal", "Reference"];
