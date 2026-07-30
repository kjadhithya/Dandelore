import type { AppFontName, ThemeName } from "@/types/vault";

export const THEME_BG: Record<ThemeName, string> = {
  Light: "#f7f7f7",
  "Light Warm": "#faf5ea",
  Dark: "#1c1c1c",
  "Dark Warm": "#1d1b17",
};

export const FONTS: Record<AppFontName, string> = {
  Sans: "var(--font-ibm-plex-sans), system-ui, sans-serif",
  Serif: "var(--font-spectral), Georgia, serif",
  System: "system-ui, -apple-system, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Mono: "var(--font-ibm-plex-mono), monospace",
};

export const FONT_OPTS: AppFontName[] = [
  "Sans",
  "Serif",
  "System",
  "Georgia",
  "Mono",
];

export const THEME_KEY = (t: ThemeName | null | undefined): string =>
  (t || "Light Warm").toLowerCase().replace(/\s+/g, "-");

export const THEMES: ThemeName[] = ["Light", "Light Warm", "Dark", "Dark Warm"];

export const THEME_SWATCH: Record<
  ThemeName,
  { bar: string; bg: string; dot: string }
> = {
  Light: { bar: "#e0e0e0", bg: "#f5f5f5", dot: "#c9c9c9" },
  "Light Warm": { bar: "#e8ddc4", bg: "#f9f2e2", dot: "#d8c8a6" },
  Dark: { bar: "#2c2c2c", bg: "#141414", dot: "#404040" },
  "Dark Warm": { bar: "#2c2820", bg: "#181510", dot: "#463f30" },
};

export const ACCENT_SWATCHES = [
  "#b0623b",
  "#7d8a5f",
  "#5f7d8a",
  "#8a5f7d",
  "#a8843a",
  "#9d5b5b",
  "#5f6f8a",
  "#4c4a44",
];

export const DEFAULT_ACCENT = "#b0623b";

export const MD_HELP_GROUPS = [
  {
    group: "Headings & text",
    items: [
      { label: "Heading", syntax: "# H1   ## H2   ### H3" },
      { label: "Bold", syntax: "**bold**" },
      { label: "Italic", syntax: "*italic*" },
      { label: "Divider", syntax: "---" },
    ],
  },
  {
    group: "Lists",
    items: [
      { label: "Bullet list", syntax: "- item" },
      { label: "Numbered list", syntax: "1. item" },
      { label: "Checkbox", syntax: "- [ ] todo   - [x] done" },
    ],
  },
  {
    group: "Links & tags",
    items: [
      { label: "Internal link", syntax: "[[Note title]]" },
      { label: "External link", syntax: "[text](https://…)" },
      { label: "Tag", syntax: "#tag" },
    ],
  },
  {
    group: "Code & quotes",
    items: [
      { label: "Inline code", syntax: "`code`" },
      { label: "Code block", syntax: "```\ncode\n```" },
      { label: "Quote", syntax: "> quoted text" },
    ],
  },
  {
    group: "Table",
    items: [{ label: "Table", syntax: "| A | B |\n|---|---|\n| 1 | 2 |" }],
  },
];
