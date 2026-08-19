import { renderLineLive, sepLine, inlineLive } from "@/lib/markdown/liveEditor";
import type { TitleResolver } from "@/lib/markdown/liveEditor";
import { htmlToMarkdown } from "@/lib/markdown/htmlToMarkdown";

export interface LinkSuggestion {
  label: string;
  isCreate?: boolean;
}

export type PopupState =
  | { type: "link"; query: string; pos: { x: number; y: number }; suggestions: LinkSuggestion[]; activeIdx: number }
  | { type: "tag"; query: string; pos: { x: number; y: number }; suggestions: string[]; activeIdx: number }
  | null;

export type BlockKind = "body" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "bullet" | "ol" | "task" | "quote";

export type CtxMenuState =
  | { kind: "para"; x: number; y: number; line: HTMLDivElement; blockKind: BlockKind }
  | { kind: "link"; x: number; y: number; title: string }
  | null;

export interface EditorEngineDeps {
  hasNote: TitleResolver;
  getLinkSuggestions: (query: string) => LinkSuggestion[];
  getTagSuggestions: (query: string) => string[];
  onContentChange: (content: string) => void;
  onPopupChange: (popup: PopupState) => void;
  onCtxMenuChange: (ctx: CtxMenuState) => void;
  // Inserting a [[link]] from the autocomplete popup while typing — creates
  // the target note if missing but stays put, unlike clicking a link.
  onLinkInsert: (title: string) => void;
  onLinkClick: (title: string) => void;
  onOpenSearch: (q: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPasteFiles: (files: File[]) => void;
  copyText: (text: string) => void;
  accentText: string;
  codeColor: string;
  mutColor: string;
  inkColor: string;
}

const C_CODE_CSS = "var(--code)";

export class EditorEngine {
  ed: HTMLDivElement | null = null;
  host: HTMLDivElement | null = null;
  active: HTMLDivElement | null = null;
  popup: PopupState = null;
  acLine: HTMLDivElement | null = null;
  acCol = 0;
  acQuery = "";
  // Caret position right after a picked tag/link — lets detectLink() ignore
  // the spurious re-check that follows a pick (e.g. the keyup after Enter)
  // without the caret having actually moved or new text being typed.
  lastPick: { line: HTMLDivElement; col: number } | null = null;
  // Markdown markers (**, #, > , etc.) are always in the DOM — hidden at
  // font-size:0 on an inactive line, expanded to full width once the line
  // gains .active (see globals.css) — so activating a line reflows it
  // wider right under the cursor. On a double-click, the first click's
  // mouseup activates (and reflows) the line before the second click's
  // coordinate is evaluated, so the browser ends up selecting whatever
  // word the reflow shifted into that spot instead of the word the user
  // actually clicked. Recording the column on the first mousedown, before
  // any reflow, and reusing it for the whole click pair (see
  // onEditorMouseDown/onDblClick) sidesteps that by never trusting a
  // post-reflow coordinate for word selection.
  lastMouseDown: { line: HTMLDivElement; col: number; x: number; y: number; t: number } | null = null;
  ctxMenu: CtxMenuState = null;
  // Whether touch is the *primary* input, not merely present — matchMedia
  // (pointer: coarse) is true for phones/tablets but false on a
  // touchscreen laptop whose primary input is still a mouse/trackpad,
  // unlike navigator.maxTouchPoints > 0, which would wrongly treat that
  // hybrid device as touch-only and take away its desktop right-click
  // menu entirely (touchend, which is what mobile falls back to, never
  // fires from a mouse). This is what onContextMenu below branches on.
  isTouchDevice: boolean = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  deps: EditorEngineDeps;

  constructor(deps: EditorEngineDeps) {
    this.deps = deps;
  }

  mount(host: HTMLDivElement) {
    if (this.host === host) return;
    host.innerHTML = "";
    const ed = document.createElement("div");
    ed.className = "liveedit";
    ed.style.minHeight = "300px";
    ed.style.whiteSpace = "pre-wrap";
    ed.style.outline = "none";
    // contentEditable is selectable by default, but leaving it implicit has
    // been unreliable on some mobile WebKit/Chromium builds for dragging a
    // touch selection-handle across more than a word — stating it
    // explicitly is a no-op where the default already works and a cheap
    // safety net where it doesn't.
    ed.style.userSelect = "text";
    (ed.style as CSSStyleDeclaration & { webkitUserSelect: string }).webkitUserSelect = "text";
    ed.contentEditable = "true";
    ed.setAttribute("spellcheck", "false");
    host.appendChild(ed);
    this.ed = ed;
    this.host = host;
    this.attach(ed);
  }

  unmount() {
    this.ed = null;
    this.host = null;
    this.active = null;
  }

  attach(ed: HTMLDivElement) {
    ed.addEventListener("paste", (e) => this.onPaste(e));
    ed.addEventListener("beforeinput", (e) => this.onBeforeInput(e as InputEvent));
    ed.addEventListener("input", (e) => this.onInput(e as InputEvent));
    ed.addEventListener("keydown", (e) => this.onKeydown(e));
    ed.addEventListener("keyup", () => this.updateActive());
    ed.addEventListener("mousedown", (e) => this.onEditorMouseDown(e));
    ed.addEventListener("dblclick", (e) => this.onDblClick(e));
    ed.addEventListener("mouseup", () => {
      this.updateActive();
      this.detectLink();
    });
    ed.addEventListener("click", (e) => this.onClick(e));
    ed.addEventListener("contextmenu", (e) => this.onContextMenu(e));
    // contextmenu is an unreliable way to reach Cut/Copy/Paste on mobile —
    // iOS Safari in particular never fires it for a plain text-selection
    // long-press at all (only for links/images), so the whole custom menu
    // was simply unreachable there once a selection existed. touchend only
    // ever fires from an actual touch, so this is naturally scoped to
    // touch devices without needing a separate mobile check — a short
    // delay lets the OS-level selection-handle drag finish settling before
    // reading it, since some mobile browsers report it mid-update right at
    // touchend itself.
    ed.addEventListener("touchend", () => {
      setTimeout(() => this.maybeShowSelectionMenu(), 60);
    });
    ed.addEventListener("compositionend", () => {
      this.rebuildAll();
      this.commit();
    });
    // A contentEditable region isn't a drop target by default — without
    // preventDefault on dragover, the browser rejects the drop entirely
    // (often navigating to the file instead of handing it to us).
    ed.addEventListener("dragover", (e) => e.preventDefault());
    ed.addEventListener("drop", (e) => this.onDrop(e));
  }

  renderFull(content: string) {
    const ed = this.ed;
    if (!ed) return;
    ed.innerHTML = "";
    const lines = content.split("\n");
    (lines.length ? lines : [""]).forEach((ln) => ed.appendChild(this.makeLine(ln)));
    this.active = null;
    this.decorateBlocks();
  }

  makeLine(text: string): HTMLDivElement {
    const d = document.createElement("div");
    const r = renderLineLive(text, this.deps.hasNote);
    d.className = r.cls;
    d.innerHTML = r.html;
    return d;
  }
  updateLine(div: HTMLDivElement, text: string) {
    const wasActive = div.classList.contains("active");
    const r = renderLineLive(text, this.deps.hasNote);
    div.className = r.cls + (wasActive ? " active" : "");
    div.innerHTML = r.html;
  }

  serialize(): string {
    const ed = this.ed;
    if (!ed) return "";
    const parts: string[] = [];
    ed.childNodes.forEach((n) => {
      if (n.nodeType === 3) parts.push((n as Text).data);
      else if (n.nodeType === 1) {
        const el = n as HTMLElement;
        if (el.classList && el.classList.contains("blockdeco")) return;
        if (el.tagName === "BR") parts.push("");
        else parts.push(el.textContent || "");
      }
    });
    return parts.join("\n");
  }

  caretInfo(): { line: HTMLDivElement; idx: number; col: number } | null {
    const ed = this.ed;
    if (!ed) return null;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const rng = sel.getRangeAt(0);
    if (!ed.contains(rng.startContainer)) return null;
    let line: Node | null = rng.startContainer;
    if (line === ed) {
      const el = (ed.children[rng.startOffset] || ed.children[ed.children.length - 1]) as HTMLDivElement;
      if (!el) return null;
      return { line: el, idx: Array.prototype.indexOf.call(ed.children, el) as number, col: 0 };
    }
    while (line && line.parentNode !== ed) line = line.parentNode;
    if (!line) return null;
    const lineEl = line as HTMLDivElement;
    const col = this.colOf(lineEl, rng.startContainer, rng.startOffset);
    return { line: lineEl, idx: Array.prototype.indexOf.call(ed.children, lineEl) as number, col };
  }

  colOf(line: HTMLElement, node: Node, offset: number): number {
    if (node === line) {
      let c = 0;
      for (let i = 0; i < offset && i < line.childNodes.length; i++) c += (line.childNodes[i].textContent || "").length;
      return c;
    }
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let c = 0;
    let tn: Node | null;
    while ((tn = walker.nextNode())) {
      if (tn === node) return c + offset;
      c += (tn as Text).data.length;
    }
    return c;
  }

  setCol(line: HTMLElement, col: number) {
    const sel = window.getSelection();
    if (!sel) return;
    const rng = document.createRange();
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let c = 0;
    let tn: Node | null;
    let last: Node | null = null;
    let placed = false;
    while ((tn = walker.nextNode())) {
      last = tn;
      const len = (tn as Text).data.length;
      if (c + len >= col) {
        rng.setStart(tn, Math.max(0, col - c));
        placed = true;
        break;
      }
      c += len;
    }
    if (!placed) {
      if (last) rng.setStart(last, (last as Text).data.length);
      else rng.setStart(line, 0);
    }
    rng.collapse(true);
    sel.removeAllRanges();
    sel.addRange(rng);
    // A programmatic Selection change (unlike native typing) doesn't
    // trigger the browser's own "keep the caret visible" scrolling — most
    // noticeable on mobile, where Enter creating a new line left it
    // sitting behind the virtual keyboard since nothing ever scrolled it
    // into the shrunk visible area. block:"nearest" only moves the
    // minimum needed, so this is a no-op whenever the caret was already
    // visible (i.e. always, on desktop).
    line.scrollIntoView({ block: "nearest" });
  }

  /** Column -> DOM (node, offset), the inverse walk used by setCol — split
   * out so selectRange can resolve two boundaries without duplicating the
   * tree-walk each time. */
  posAt(line: HTMLElement, col: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let c = 0;
    let tn: Node | null;
    let last: Node | null = null;
    while ((tn = walker.nextNode())) {
      last = tn;
      const len = (tn as Text).data.length;
      if (c + len >= col) return { node: tn, offset: Math.max(0, col - c) };
      c += len;
    }
    if (last) return { node: last, offset: (last as Text).data.length };
    return { node: line, offset: 0 };
  }

  selectRange(line: HTMLElement, start: number, end: number) {
    const sel = window.getSelection();
    if (!sel) return;
    const a = this.posAt(line, start);
    const b = this.posAt(line, end);
    const rng = document.createRange();
    rng.setStart(a.node, a.offset);
    rng.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(rng);
  }

  setActive(line: HTMLDivElement | null) {
    if (this.active && this.active !== line) this.active.classList.remove("active");
    if (line) line.classList.add("active");
    this.active = line;
  }

  updateActive() {
    const ci = this.caretInfo();
    if (ci && ci.line !== this.active) this.setActive(ci.line);
    this.detectLink();
    this.decorateBlocks();
  }

  commit() {
    this.deps.onContentChange(this.serialize());
  }

  onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      this.deps.onPasteFiles(files);
      return;
    }
    // A source with real markup (a webpage, Google Doc, Notion, Word) puts
    // a text/html entry on the clipboard alongside the plain-text one. The
    // browser's default paste would insert that raw HTML into the
    // contentEditable, and serialize() reads it back out via .textContent,
    // which throws away every paragraph/line break — a multi-link paste
    // collapses into one run-on line. Convert it to markdown ourselves and
    // insert that instead. Plain text with no HTML entry (a copied line
    // from a text editor, a terminal, etc.) has nothing to convert and
    // falls through to the default insertFromPaste, which — combined with
    // white-space:pre-wrap — already preserves its line breaks correctly.
    const html = e.clipboardData?.getData("text/html");
    if (html && html.trim()) {
      const ci = this.caretInfo();
      if (ci) {
        e.preventDefault();
        const md = htmlToMarkdown(html);
        this.insertMultilineText(ci, md);
      }
    }
  }

  onDrop(e: DragEvent) {
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    e.preventDefault();
    this.deps.onPasteFiles(Array.from(files));
  }

  /** Many mobile virtual keyboards never dispatch a real keydown with a
   * usable e.key for a plain character press — they go straight to
   * beforeinput/input, so onKeydown's e.key === "["/"*" checks (and the
   * wrap-a-selection behavior they trigger) silently never run there.
   * Without this, typing "[" or "*" with text selected falls through to
   * the browser's own default behavior for a keypress-over-a-selection:
   * delete the selection and insert the plain character, which reads as
   * "it replaced my text instead of wrapping it". Intercepting the same
   * two characters here, before that default insertion happens, and
   * routing them through the same handleWrapKey used by the desktop
   * keydown path fixes both the wrap-a-selection and the collapsed-caret
   * auto-close case identically on mobile. Never fires for a real desktop
   * keypress: onKeydown's own preventDefault() on the keydown already
   * stops the browser from getting as far as beforeinput for that key. */
  onBeforeInput(e: InputEvent) {
    if (e.inputType !== "insertText") return;
    if (e.data === "[") {
      this.handleWrapKey(e, "[", "]", () => setTimeout(() => this.detectLink(), 0));
    } else if (e.data === "*") {
      this.handleWrapKey(e, "*", "*");
    }
  }

  onInput(e: InputEvent) {
    if (e.isComposing) return;
    const it = e.inputType || "";
    if (it === "insertFromPaste" || it === "insertFromDrop") {
      this.rebuildAll();
      this.detectLink();
      this.commit();
      return;
    }
    const ci = this.caretInfo();
    if (!ci) {
      this.commit();
      return;
    }
    this.updateLine(ci.line, ci.line.textContent || "");
    const prevSib = ci.line.previousElementSibling as HTMLDivElement | null;
    if (prevSib) this.updateLine(prevSib, prevSib.textContent || "");
    this.setActive(ci.line);
    this.setCol(ci.line, ci.col);
    this.maybeAutocloseFence(ci.line);
    // Detect before commit: suggestion sources read note content from the
    // store, and committing first would make the tag/link currently being
    // typed already "exist" (it'd match itself in the freshly-committed text).
    this.detectLink();
    this.commit();
  }

  rebuildAll() {
    const ci = this.caretInfo();
    const content = this.serialize();
    const ed = this.ed;
    if (!ed) return;
    ed.innerHTML = "";
    content.split("\n").forEach((ln) => ed.appendChild(this.makeLine(ln)));
    if (ci) {
      const line = ed.children[Math.min(ci.idx, ed.children.length - 1)] as HTMLDivElement;
      if (line) {
        this.setActive(line);
        this.setCol(line, ci.col);
      }
    }
    this.decorateBlocks();
  }

  insertText(line: HTMLDivElement, col: number, ins: string, caretAfter: number) {
    const text = line.textContent || "";
    const nt = text.slice(0, col) + ins + text.slice(col);
    this.updateLine(line, nt);
    this.setActive(line);
    this.setCol(line, caretAfter);
    this.commit();
  }

  /** Inserts (possibly multi-line) text at the caret, splitting the current
   * line and creating one .ln div per extra line — used for pasted content
   * that's already been converted to clean markdown, so a paragraph-y
   * paste lands as several real lines instead of one run-on line. */
  insertMultilineText(ci: { line: HTMLDivElement; col: number }, text: string) {
    const lines = text.split("\n");
    if (lines.length === 1) {
      this.insertText(ci.line, ci.col, lines[0], ci.col + lines[0].length);
      return;
    }
    const line = ci.line;
    const full = line.textContent || "";
    const before = full.slice(0, ci.col);
    const after = full.slice(ci.col);
    this.updateLine(line, before + lines[0]);
    let anchor: HTMLDivElement = line;
    for (let i = 1; i < lines.length; i++) {
      const isLast = i === lines.length - 1;
      const nl = this.makeLine(isLast ? lines[i] + after : lines[i]);
      if (anchor.nextSibling) this.ed!.insertBefore(nl, anchor.nextSibling);
      else this.ed!.appendChild(nl);
      anchor = nl;
      if (isLast) {
        this.setActive(nl);
        this.setCol(nl, lines[i].length);
      }
    }
    this.decorateBlocks();
    this.commit();
  }

  insertNewLine(ci: { line: HTMLDivElement; col: number }, prefix: string) {
    const line = ci.line;
    const text = line.textContent || "";
    const before = text.slice(0, ci.col);
    const after = prefix + text.slice(ci.col);
    this.updateLine(line, before);
    const nl = this.makeLine(after);
    if (line.nextSibling) this.ed!.insertBefore(nl, line.nextSibling);
    else this.ed!.appendChild(nl);
    this.setActive(nl);
    this.setCol(nl, prefix.length);
    this.commit();
  }

  /** Same-line selection bounds under the caret, or null if the selection
   * spans multiple lines / isn't inside the editor — the shared lookup
   * behind every wrap/toggle key handler below. */
  singleLineSelection(): { line: HTMLDivElement; lo: number; hi: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const rng = sel.getRangeAt(0);
    if (!rng.startContainer || !this.ed!.contains(rng.startContainer)) return null;
    let l1: Node | null = rng.startContainer;
    while (l1 && l1.parentNode !== this.ed) l1 = l1.parentNode;
    let l2: Node | null = rng.endContainer;
    while (l2 && l2.parentNode !== this.ed) l2 = l2.parentNode;
    if (l1 !== l2 || !l1) return null;
    const line = l1 as HTMLDivElement;
    const a = this.colOf(line, rng.startContainer, rng.startOffset);
    const b = this.colOf(line, rng.endContainer, rng.endOffset);
    return { line, lo: Math.min(a, b), hi: Math.max(a, b) };
  }

  /** Cmd+B / Cmd+I / Cmd+U — wraps the selection in the given delimiter
   * pair, or un-wraps it if it's already wrapped in exactly that pair
   * (so re-pressing the shortcut toggles the formatting back off). With
   * no selection, opens/closes an empty pair with the caret left inside. */
  wrapSelectionWithDelim(open: string, close: string = open) {
    const s = this.singleLineSelection();
    if (s) {
      const { line, lo, hi } = s;
      const text = line.textContent || "";
      const ol = open.length,
        cl = close.length;
      if (text.slice(lo - ol, lo) === open && text.slice(hi, hi + cl) === close) {
        const nt = text.slice(0, lo - ol) + text.slice(lo, hi) + text.slice(hi + cl);
        this.updateLine(line, nt);
        this.setActive(line);
        this.selectRange(line, lo - ol, hi - ol);
        this.commit();
        return;
      }
      const nt = text.slice(0, lo) + open + text.slice(lo, hi) + close + text.slice(hi);
      this.updateLine(line, nt);
      this.setActive(line);
      this.selectRange(line, lo + ol, hi + ol);
      this.commit();
      return;
    }
    const ci = this.caretInfo();
    if (!ci) return;
    const text = ci.line.textContent || "";
    const ol = open.length,
      cl = close.length;
    if (text.slice(ci.col - ol, ci.col) === open && text.slice(ci.col, ci.col + cl) === close) {
      const nt = text.slice(0, ci.col - ol) + text.slice(ci.col + cl);
      this.updateLine(ci.line, nt);
      this.setActive(ci.line);
      this.setCol(ci.line, ci.col - ol);
      this.commit();
      return;
    }
    this.insertText(ci.line, ci.col, open + close, ci.col + ol);
  }

  /** Shared by the `[`/`*` keydown handlers below and by onBeforeInput's
   * mobile fallback — wraps a selection (or, with no selection,
   * auto-closes a pair with the caret in between); pressing the same key
   * again immediately upgrades a single wrap into a double one
   * (`[text]` -> `[[text]]`, `*text*` -> `**text**`), which is how a
   * single bracket press becomes a wikilink and a single asterisk becomes
   * bold. Takes KeyboardEvent | InputEvent since both call sites just need
   * preventDefault(). */
  handleWrapKey(e: KeyboardEvent | InputEvent, openCh: string, closeCh: string, onUpgrade?: () => void) {
    const s = this.singleLineSelection();
    if (s) {
      e.preventDefault();
      const { line, lo, hi } = s;
      const text = line.textContent || "";
      const alreadySingle =
        text[lo - 1] === openCh && text[lo - 2] !== openCh && text[hi] === closeCh && text[hi + 1] !== closeCh;
      if (alreadySingle) {
        const nt = text.slice(0, lo - 1) + openCh + openCh + text.slice(lo, hi) + closeCh + closeCh + text.slice(hi + 1);
        this.updateLine(line, nt);
        this.setActive(line);
        // Selecting existing text and wrapping it is a one-shot "make this
        // a link" action — the title is exactly what was already selected,
        // there's nothing left to search or pick. Calling onUpgrade here
        // (as the fresh-[[-while-typing case below does) reopened the
        // autocomplete over text that had just been converted, hiding it
        // behind a suggestions list the user never asked for.
        // nt inserted 2 chars before lo and 2 after hi, so the closing pair
        // now ends at hi + 3 (only single-char open/close reach this branch —
        // the "already wrapped once" check above compares text[i] === openCh).
        this.setCol(line, hi + 3);
        this.commit();
        return;
      }
      const nt = text.slice(0, lo) + openCh + text.slice(lo, hi) + closeCh + text.slice(hi);
      this.updateLine(line, nt);
      this.setActive(line);
      this.selectRange(line, lo + 1, hi + 1);
      this.commit();
      if (onUpgrade) onUpgrade();
      return;
    }
    const ci = this.caretInfo();
    if (!ci) return;
    e.preventDefault();
    const text = ci.line.textContent || "";
    const betweenLoneClosed =
      text[ci.col - 1] === openCh && text[ci.col - 2] !== openCh && text[ci.col] === closeCh && text[ci.col + 1] !== closeCh;
    if (betweenLoneClosed) {
      const nt = text.slice(0, ci.col - 1) + openCh + openCh + closeCh + closeCh + text.slice(ci.col + 1);
      this.updateLine(ci.line, nt);
      this.setActive(ci.line);
      this.setCol(ci.line, ci.col + 1);
      this.commit();
      if (onUpgrade) onUpgrade();
      return;
    }
    this.insertText(ci.line, ci.col, openCh + closeCh, ci.col + 1);
  }

  onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) this.deps.onRedo();
      else this.deps.onUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      this.deps.onRedo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      this.wrapSelectionWithDelim("**");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      this.wrapSelectionWithDelim("*");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      this.wrapSelectionWithDelim("<u>", "</u>");
      return;
    }
    if (this.popup) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.closePopup();
        return;
      }
      if (e.key === "Enter") {
        const p = this.popup;
        const sug = p.type === "link" ? p.suggestions.map((x) => (x.isCreate ? p.query : x.label)) : p.suggestions;
        if (sug.length) {
          e.preventDefault();
          const idx = Math.min(p.activeIdx, sug.length - 1);
          if (p.type === "link") this.pickLink(sug[idx]);
          else this.pickTag(sug[idx]);
          return;
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.movePopup(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.movePopup(-1);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !this.popup) {
      const ci = this.caretInfo();
      if (ci) {
        const text = ci.line.textContent || "";
        let m: RegExpMatchArray | null;
        if ((m = text.match(/^(\s*>\s?)(.*)$/))) {
          e.preventDefault();
          if (m[2].trim() === "") {
            this.updateLine(ci.line, "");
            this.setActive(ci.line);
            this.setCol(ci.line, 0);
            this.commit();
          } else this.insertNewLine(ci, "> ");
          return;
        }
        if ((m = text.match(/^(\s*)([-*])\s+(\[( |x|X)\]\s?)?(.*)$/))) {
          e.preventDefault();
          if (m[5].trim() === "") {
            this.updateLine(ci.line, "");
            this.setActive(ci.line);
            this.setCol(ci.line, 0);
            this.commit();
          } else this.insertNewLine(ci, m[1] + m[2] + " " + (m[3] ? "[ ] " : ""));
          return;
        }
        if ((m = text.match(/^(\s*)(\d+)\.\s+(.*)$/))) {
          e.preventDefault();
          if (m[3].trim() === "") {
            this.updateLine(ci.line, "");
            this.setActive(ci.line);
            this.setCol(ci.line, 0);
            this.commit();
          } else this.insertNewLine(ci, m[1] + (parseInt(m[2], 10) + 1) + ". ");
          return;
        }
        e.preventDefault();
        this.insertNewLine(ci, "");
        return;
      }
    }
    if (e.key === "[") {
      this.handleWrapKey(e, "[", "]", () => setTimeout(() => this.detectLink(), 0));
      return;
    }
    if (e.key === "*") {
      this.handleWrapKey(e, "*", "*");
      return;
    }
    if (e.key === "]") {
      const ci = this.caretInfo();
      if (ci) {
        const text = ci.line.textContent || "";
        if (text[ci.col] === "]") {
          e.preventDefault();
          this.setCol(ci.line, ci.col + 1);
          return;
        }
      }
    }
  }

  movePopup(dir: number) {
    if (!this.popup) return;
    const len = this.popup.type === "link" ? this.popup.suggestions.length : this.popup.suggestions.length;
    const next = Math.max(0, Math.min(len - 1, this.popup.activeIdx + dir));
    this.popup = { ...this.popup, activeIdx: next } as PopupState;
    this.deps.onPopupChange(this.popup);
  }

  closePopup() {
    this.popup = null;
    this.deps.onPopupChange(null);
  }

  caretScreenPos(): { x: number; y: number } {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const rng = sel.getRangeAt(0).cloneRange();
      rng.collapse(true);
      const rect = rng.getClientRects()[0] || rng.getBoundingClientRect();
      if (rect && (rect.width || rect.height || rect.top || rect.left)) return { x: rect.left, y: rect.bottom + 6 };
    }
    const ci = this.caretInfo();
    if (ci && ci.line) {
      const r = ci.line.getBoundingClientRect();
      return { x: r.left, y: r.bottom + 6 };
    }
    return { x: 100, y: 100 };
  }

  detectLink() {
    const ed = this.ed;
    if (!ed) {
      if (this.popup) this.closePopup();
      return;
    }
    const ci = this.caretInfo();
    if (!ci) {
      if (this.popup) this.closePopup();
      return;
    }
    if (this.lastPick && ci.line === this.lastPick.line && ci.col === this.lastPick.col) {
      this.lastPick = null;
      if (this.popup) this.closePopup();
      return;
    }
    this.lastPick = null;
    const text = ci.line.textContent || "";
    const before = text.slice(0, ci.col);
    const lastOpen = before.lastIndexOf("[[");
    if (lastOpen !== -1) {
      const between = before.slice(lastOpen + 2);
      if (!/\]\]/.test(between) && !between.includes("[[")) {
        this.acLine = ci.line;
        this.acCol = ci.col;
        this.acQuery = between;
        const pos = this.caretScreenPos();
        const suggestions = this.deps.getLinkSuggestions(between);
        this.popup = { type: "link", query: between, pos, suggestions, activeIdx: 0 };
        // The autocomplete and the Cut/Copy/Paste/Paragraph menu are
        // independent bits of React state — nothing stopped both from being
        // open at once (e.g. a leftover ctxMenu from an earlier long-press
        // while this popup opens from typing), which stacked two overlapping
        // panels over the text the user was trying to see.
        this.deps.onCtxMenuChange(null);
        this.deps.onPopupChange(this.popup);
        return;
      }
    }
    const tagMatch = before.match(/(^|\s)#([\w/-]*)$/);
    if (tagMatch) {
      this.acLine = ci.line;
      this.acCol = ci.col;
      this.acQuery = tagMatch[2];
      const pos = this.caretScreenPos();
      const suggestions = this.deps.getTagSuggestions(tagMatch[2]);
      this.popup = { type: "tag", query: tagMatch[2], pos, suggestions, activeIdx: 0 };
      this.deps.onCtxMenuChange(null);
      this.deps.onPopupChange(this.popup);
      return;
    }
    if (this.popup) this.closePopup();
  }

  pickTag(name: string) {
    const line = this.acLine,
      col = this.acCol,
      q = this.acQuery || "";
    if (!line) {
      this.closePopup();
      return;
    }
    const text = line.textContent || "";
    const hashIdx = col - q.length - 1;
    const before = text.slice(0, hashIdx);
    const after = text.slice(col);
    const nt = before + "#" + name + after;
    const caret = before.length + 1 + name.length;
    this.closePopup();
    this.updateLine(line, nt);
    this.setActive(line);
    this.setCol(line, caret);
    this.lastPick = { line, col: caret };
    this.ed?.focus();
    this.commit();
  }

  pickLink(title: string) {
    const line = this.acLine,
      col = this.acCol,
      q = this.acQuery || "";
    if (!line) {
      this.closePopup();
      return;
    }
    const text = line.textContent || "";
    let before = text.slice(0, col - q.length);
    let after = text.slice(col);
    if (after.slice(0, 2) === "]]") after = after.slice(2);
    if (before.slice(-2) !== "[[") before = text.slice(0, col - q.length);
    const nt = before + title + "]]" + after;
    const caret = before.length + title.length + 2;
    this.closePopup();
    this.updateLine(line, nt);
    this.setActive(line);
    this.setCol(line, caret);
    this.lastPick = { line, col: caret };
    this.ed?.focus();
    this.commit();
    this.deps.onLinkInsert(title);
  }

  onClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const tg = t.closest && (t.closest("[data-tag]") as HTMLElement | null);
    if (tg) {
      e.preventDefault();
      this.deps.onOpenSearch("tag:" + tg.getAttribute("data-tag"));
      return;
    }
    const wl = t.closest && (t.closest("[data-wikilink]") as HTMLElement | null);
    if (wl) {
      e.preventDefault();
      this.deps.onLinkClick(wl.getAttribute("data-wikilink") || "");
      return;
    }
    const ex = t.closest && (t.closest("[data-ext]") as HTMLElement | null);
    if (ex) {
      e.preventDefault();
      const h = ex.getAttribute("href");
      if (h) window.open(h, "_blank", "noopener,noreferrer");
      return;
    }
  }

  /** Right-click inside the editor: suppress the browser's native menu and
   * hand the caller (via onCtxMenuChange) either a "link" context — the
   * click landed on a [[wikilink]] — or a "para" context carrying the
   * clicked line's current block kind, so the paragraph submenu can show
   * a checkmark next to it. */
  onContextMenu(e: MouseEvent) {
    // On a touch device, a long-press's contextmenu and its "select this
    // word, show the selection handles" default action are the same
    // native gesture, not two independent things the way right-click and
    // drag-select are on desktop — preventDefault() here was blocking
    // selection from ever starting at all, not just suppressing a menu.
    // Touch devices get the touchend-triggered selection menu below
    // instead, which needs no contextmenu event and can't interfere with
    // native selection since it only ever reads a selection that's
    // already been made.
    if (this.isTouchDevice) return;
    e.preventDefault();
    const t = e.target as HTMLElement;
    const wl = t.closest && (t.closest("[data-wikilink]") as HTMLElement | null);
    if (wl) {
      this.showCtxMenu({ kind: "link", x: e.clientX, y: e.clientY, title: wl.getAttribute("data-wikilink") || "" });
      return;
    }
    const lineEl = t.closest && (t.closest(".ln") as HTMLDivElement | null);
    if (!lineEl || !this.ed?.contains(lineEl)) {
      this.deps.onCtxMenuChange(null);
      return;
    }
    this.showCtxMenu({ kind: "para", x: e.clientX, y: e.clientY, line: lineEl, blockKind: this.blockKindOf(lineEl.textContent || "") });
  }

  closeCtxMenu() {
    this.deps.onCtxMenuChange(null);
  }

  // Mirrors the onCtxMenuChange(null) calls detectLink() makes before
  // opening its own popup — the autocomplete and this menu are independent
  // React state, so without this a leftover one from an earlier interaction
  // could stay open underneath/behind the other.
  private showCtxMenu(ctx: NonNullable<CtxMenuState>) {
    if (this.popup) this.closePopup();
    this.deps.onCtxMenuChange(ctx);
  }

  /** touchend fallback (see attach()) — shows the same Cut/Copy/Paste/
   * Paragraph menu onContextMenu shows on right-click, anchored under the
   * current selection instead of the click point. No-ops silently if
   * there's no real (non-collapsed) selection inside the editor, so a
   * plain tap-to-place-caret never triggers it. */
  maybeShowSelectionMenu() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !this.ed) return;
    const rng = sel.getRangeAt(0);
    if (!this.ed.contains(rng.startContainer) || !this.ed.contains(rng.endContainer)) return;
    let l1: Node | null = rng.startContainer;
    while (l1 && l1.parentNode !== this.ed) l1 = l1.parentNode;
    if (!l1) return;
    const lineEl = l1 as HTMLDivElement;
    const rect = rng.getBoundingClientRect();
    this.showCtxMenu({ kind: "para", x: rect.left, y: rect.bottom + 8, line: lineEl, blockKind: this.blockKindOf(lineEl.textContent || "") });
  }

  /** Deletes whatever's currently selected, merging the two ends together
   * when the selection spans more than one .ln line — the multi-line
   * counterpart to singleLineSelection()'s single-line-only replace logic,
   * needed here since a context-menu Cut/Paste can legitimately span the
   * whole editor. Returns the resulting collapsed caret position (Paste
   * inserts there), or null if there was nothing selected to delete. */
  deleteCurrentSelection(): { line: HTMLDivElement; col: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !this.ed) return null;
    const rng = sel.getRangeAt(0);
    if (!this.ed.contains(rng.startContainer) || !this.ed.contains(rng.endContainer)) return null;

    let l1: Node | null = rng.startContainer;
    while (l1 && l1.parentNode !== this.ed) l1 = l1.parentNode;
    let l2: Node | null = rng.endContainer;
    while (l2 && l2.parentNode !== this.ed) l2 = l2.parentNode;
    if (!l1 || !l2) return null;
    const startLine = l1 as HTMLDivElement;
    const endLine = l2 as HTMLDivElement;
    const startCol = this.colOf(startLine, rng.startContainer, rng.startOffset);
    const endCol = this.colOf(endLine, rng.endContainer, rng.endOffset);

    if (startLine === endLine) {
      const text = startLine.textContent || "";
      this.updateLine(startLine, text.slice(0, startCol) + text.slice(endCol));
      this.setActive(startLine);
      this.setCol(startLine, startCol);
      this.commit();
      return { line: startLine, col: startCol };
    }

    const startText = startLine.textContent || "";
    const endText = endLine.textContent || "";
    this.updateLine(startLine, startText.slice(0, startCol) + endText.slice(endCol));
    this.setActive(startLine);
    let node: ChildNode | null = startLine.nextSibling;
    while (node) {
      const next: ChildNode | null = node.nextSibling;
      const isEnd = node === endLine;
      this.ed.removeChild(node);
      if (isEnd) break;
      node = next;
    }
    this.setCol(startLine, startCol);
    this.decorateBlocks();
    this.commit();
    return { line: startLine, col: startCol };
  }

  /** Cut/Copy use the async Clipboard API rather than
   * document.execCommand("copy"/"cut") — the latter turns out to be
   * blocked in some embedded/automated browser contexts (returns false,
   * silently does nothing) despite being the traditionally "reliable"
   * choice, and the modern API is the current standard regardless.
   * Selection.toString() already inserts a newline between separate .ln
   * lines, so it doubles as the multi-line-aware text extraction
   * singleLineSelection() doesn't provide. */
  async copySelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  async cutSelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    this.deleteCurrentSelection();
    this.ed?.focus();
  }

  selectAllContent() {
    if (!this.ed || !this.ed.firstChild || !this.ed.lastChild) return;
    this.ed.focus();
    const first = this.ed.firstChild as HTMLDivElement;
    const last = this.ed.lastChild as HTMLDivElement;
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.childNodes.length);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /** A menu-triggered paste (unlike Cmd+V, which fires a real paste event
   * browsers handle for us) has to go through the async Clipboard API and
   * insert the text itself. */
  async pasteFromClipboard() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    if (!text) return;
    const deleted = this.deleteCurrentSelection();
    const ci = deleted || this.caretInfo();
    if (!ci) return;
    this.insertMultilineText(ci, text);
    this.ed?.focus();
  }

  /** Strips whatever block-prefix (heading/quote/task/bullet/numbered) a
   * line currently has, leaving just its content — the common starting
   * point setBlockType uses before applying the new prefix. */
  stripBlockPrefix(text: string): string {
    let m: RegExpMatchArray | null;
    if ((m = text.match(/^#{1,6}\s+(.*)$/))) return m[1];
    if ((m = text.match(/^\s*>\s?(.*)$/))) return m[1];
    if ((m = text.match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/))) return m[2];
    if ((m = text.match(/^\s*[-*]\s+(.*)$/))) return m[1];
    if ((m = text.match(/^\s*\d+\.\s+(.*)$/))) return m[1];
    return text;
  }

  blockKindOf(text: string): BlockKind {
    let m: RegExpMatchArray | null;
    if ((m = text.match(/^(#{1,6})\s+/))) return ("h" + m[1].length) as BlockKind;
    if (/^\s*>\s?/.test(text)) return "quote";
    if (/^\s*[-*]\s+\[( |x|X)\]\s?/.test(text)) return "task";
    if (/^\s*[-*]\s+/.test(text)) return "bullet";
    if (/^\s*\d+\.\s+/.test(text)) return "ol";
    return "body";
  }

  /** Applies a block-level markdown prefix (heading/bullet/numbered/task/
   * quote, or plain "body" to strip one) to a single line, used by the
   * right-click Paragraph submenu. */
  setBlockType(line: HTMLDivElement, kind: BlockKind) {
    const text = line.textContent || "";
    const content = this.stripBlockPrefix(text);
    let nt: string;
    switch (kind) {
      case "body":
        nt = content;
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        nt = "#".repeat(Number(kind[1])) + " " + content;
        break;
      case "bullet":
        nt = "- " + content;
        break;
      case "ol": {
        // Continue the immediately preceding line's numbering if it's
        // already a numbered item, rather than always restarting at 1 —
        // otherwise applying "Numbered list" one line at a time (the only
        // way this menu can apply it) produces 1, 1, 1... instead of a
        // real 1, 2, 3... sequence. A previous line that isn't a numbered
        // item at all (or none, at the top of the note) starts fresh.
        const prevText = (line.previousElementSibling as HTMLDivElement | null)?.textContent || "";
        const m = prevText.match(/^\s*(\d+)\.\s+/);
        const n = m ? parseInt(m[1], 10) + 1 : 1;
        nt = n + ". " + content;
        break;
      }
      case "task":
        nt = "- [ ] " + content;
        break;
      case "quote":
        nt = "> " + content;
        break;
    }
    this.updateLine(line, nt);
    this.setActive(line);
    this.setCol(line, nt.length);
    this.ed?.focus();
    this.commit();
  }

  /** node/offset -> column, from whatever's under an arbitrary screen
   * point — the mousedown/dblclick counterpart to colOf, which only
   * works from an existing Range. */
  colAtPoint(line: HTMLElement, x: number, y: number): number | null {
    type CaretPosDoc = Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
    const doc = document as CaretPosDoc;
    if (doc.caretRangeFromPoint) {
      const r = doc.caretRangeFromPoint(x, y);
      if (!r) return null;
      return this.colOf(line, r.startContainer, r.startOffset);
    }
    if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(x, y);
      if (!p) return null;
      return this.colOf(line, p.offsetNode, p.offset);
    }
    return null;
  }

  onEditorMouseDown(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const lineEl = t.closest && (t.closest(".ln") as HTMLDivElement | null);
    if (!lineEl || !this.ed?.contains(lineEl)) {
      this.lastMouseDown = null;
      return;
    }
    const col = this.colAtPoint(lineEl, e.clientX, e.clientY);
    if (col === null) {
      this.lastMouseDown = null;
      return;
    }
    // A double-click's second mousedown fires after the first click's
    // mouseup has already activated (and reflowed) the line, so its own
    // coordinate is no longer trustworthy — keep the first click's column
    // instead of overwriting it with one computed against the shifted text.
    const prev = this.lastMouseDown;
    const isSecondClick =
      prev && prev.line === lineEl && Math.abs(prev.x - e.clientX) < 4 && Math.abs(prev.y - e.clientY) < 4 && Date.now() - prev.t < 500;
    this.lastMouseDown = {
      line: lineEl,
      col: isSecondClick ? prev!.col : col,
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
    };
  }

  onDblClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const lineEl = t.closest && (t.closest(".ln") as HTMLDivElement | null);
    if (!lineEl || !this.lastMouseDown || this.lastMouseDown.line !== lineEl) return;
    const text = lineEl.textContent || "";
    const col = Math.max(0, Math.min(this.lastMouseDown.col, text.length));
    const isWord = (c: string) => /[\w'’]/.test(c);
    if (!isWord(text[col] ?? "") && !isWord(text[col - 1] ?? "")) return;
    let lo = col,
      hi = col;
    while (lo > 0 && isWord(text[lo - 1])) lo--;
    while (hi < text.length && isWord(text[hi])) hi++;
    if (lo === hi) return;
    e.preventDefault();
    this.selectRange(lineEl, lo, hi);
  }

  maybeAutocloseFence(line: HTMLDivElement) {
    const t = line.textContent || "";
    if (!/^```[a-zA-Z0-9+#.-]*$/.test(t)) return;
    let before = 0;
    let p = line.previousElementSibling as HTMLDivElement | null;
    while (p) {
      if (p.classList && p.classList.contains("ln") && /^```/.test(p.textContent || "")) before++;
      p = p.previousElementSibling as HTMLDivElement | null;
    }
    if (before % 2 !== 0) return;
    let closed = false;
    let n = line.nextElementSibling as HTMLDivElement | null;
    while (n) {
      if (n.classList && n.classList.contains("ln") && /^```/.test(n.textContent || "")) {
        closed = true;
        break;
      }
      n = n.nextElementSibling as HTMLDivElement | null;
    }
    if (closed) return;
    const empty = this.makeLine("");
    const close = this.makeLine("```");
    if (line.nextSibling) {
      this.ed!.insertBefore(empty, line.nextSibling);
      this.ed!.insertBefore(close, empty.nextSibling);
    } else {
      this.ed!.appendChild(empty);
      this.ed!.appendChild(close);
    }
    this.setActive(empty);
    this.setCol(empty, 0);
    this.commit();
  }

  enterBlock(line: HTMLDivElement | null) {
    if (!line) return;
    this.ed?.focus();
    this.setActive(line);
    this.setCol(line, (line.textContent || "").length);
    this.decorateBlocks();
  }

  decorateBlocks() {
    const ed = this.ed;
    if (!ed) return;
    ed.querySelectorAll(".blockdeco").forEach((o) => o.remove());
    const all = [].filter.call(ed.children, (c) => (c as HTMLElement).classList && (c as HTMLElement).classList.contains("ln")) as HTMLDivElement[];
    all.forEach((l) => (l.style.display = ""));
    const txt = all.map((l) => l.textContent || "");
    const active = this.active;
    let i = 0;
    while (i < all.length) {
      const t = txt[i];
      if (/^```/.test(t)) {
        let j = i + 1;
        while (j < all.length && !/^```/.test(txt[j])) j++;
        if (j < all.length) {
          const els = all.slice(i, j + 1);
          if (!(active && els.indexOf(active) >= 0)) this.fenceDeco(els, txt.slice(i, j + 1));
          i = j + 1;
          continue;
        }
        i++;
        continue;
      }
      if (/\|/.test(t) && t.trim() && i + 1 < all.length && sepLine(txt[i + 1])) {
        let j = i + 2;
        while (j < all.length && /\|/.test(txt[j]) && txt[j].trim()) j++;
        const els = all.slice(i, j);
        if (!(active && els.indexOf(active) >= 0)) this.tableDeco(els, txt.slice(i, j));
        i = j;
        continue;
      }
      i++;
    }
  }

  fenceDeco(els: HTMLDivElement[], lines: string[]) {
    const code = lines.slice(1, -1).join("\n");
    const lang = lines[0].replace(/^```/, "").trim();
    const wrap = document.createElement("div");
    wrap.className = "blockdeco";
    wrap.contentEditable = "false";
    wrap.style.cssText = "position:relative;margin:12px 0;";
    const pre = document.createElement("pre");
    pre.textContent = code || " ";
    pre.style.cssText = `background:${C_CODE_CSS};border:1px solid var(--border);border-radius:8px;padding:14px 44px 14px 16px;overflow:auto;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12.5px;line-height:1.6;color:var(--text);margin:0;cursor:text;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;`;
    pre.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.enterBlock(els[1] || els[0]);
    });
    wrap.appendChild(pre);
    if (lang) {
      const tag = document.createElement("span");
      tag.textContent = lang;
      tag.style.cssText = "position:absolute;top:8px;left:14px;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);pointer-events:none;";
      wrap.appendChild(tag);
      pre.style.paddingTop = "24px";
    }
    const btn = document.createElement("span");
    btn.title = "Copy";
    btn.style.cssText =
      "position:absolute;top:8px;right:8px;height:26px;padding:0 8px;display:flex;align-items:center;gap:5px;justify-content:center;border-radius:6px;background:var(--bg);border:1px solid var(--border);color:var(--muted);cursor:pointer;font-size:11.5px;white-space:nowrap;";
    const copyIcon =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 012-2h10"></path></svg>';
    btn.innerHTML = copyIcon;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.deps.copyText(code);
      btn.style.color = this.deps.accentText;
      btn.style.borderColor = this.deps.accentText;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${this.deps.accentText}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg><span>Copied!</span>`;
      setTimeout(() => {
        btn.style.color = "";
        btn.style.borderColor = "";
        btn.innerHTML = copyIcon;
      }, 4000);
    });
    wrap.appendChild(btn);
    els[0].parentNode!.insertBefore(wrap, els[0]);
    els.forEach((l) => (l.style.display = "none"));
  }

  tableDeco(els: HTMLDivElement[], lines: string[]) {
    const row = (l: string) =>
      l
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((c) => c.trim());
    const head = row(lines[0]);
    const body = lines.slice(2).map(row);
    const wrap = document.createElement("div");
    wrap.className = "blockdeco";
    wrap.contentEditable = "false";
    wrap.style.cssText = "margin:12px 0;overflow-x:auto;cursor:text;";
    wrap.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.enterBlock(els[0]);
    });
    const tbl = document.createElement("table");
    tbl.style.cssText = "border-collapse:collapse;width:100%;font-size:13px;border:1px solid var(--border-soft);border-radius:8px;overflow:hidden;";
    let html =
      "<thead><tr>" +
      head
        .map(
          (h) =>
            `<th style="text-align:left;padding:7px 11px;border:1px solid var(--border-soft);background:var(--panel);color:${this.deps.mutColor};font-weight:600;">` +
            inlineLive(h, this.deps.hasNote) +
            "</th>",
        )
        .join("") +
      "</tr></thead><tbody>";
    body.forEach((r) => {
      html +=
        "<tr>" +
        head
          .map(
            (_, k) =>
              `<td style="padding:7px 11px;border:1px solid var(--border-soft);color:${this.deps.inkColor};">` +
              inlineLive(r[k] || "", this.deps.hasNote) +
              "</td>",
          )
          .join("") +
        "</tr>";
    });
    html += "</tbody>";
    tbl.innerHTML = html;
    wrap.appendChild(tbl);
    els[0].parentNode!.insertBefore(wrap, els[0]);
    els.forEach((l) => (l.style.display = "none"));
  }

  toggleTask(idx: number, content: string): string {
    let cnt = -1;
    const lines = content.split("\n").map((l) => {
      const m = l.match(/^(\s*[-*]\s+)\[( |x|X)\]/);
      if (m) {
        cnt++;
        if (cnt === idx) {
          const d = m[2].toLowerCase() === "x";
          return l.replace(/\[( |x|X)\]/, "[" + (d ? " " : "x") + "]");
        }
      }
      return l;
    });
    return lines.join("\n");
  }
}
