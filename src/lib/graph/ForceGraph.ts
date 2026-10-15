import { mixHex } from "@/lib/theme/color";
import type { Note } from "@/types/vault";
import { GRAPH_DEFAULTS, type GraphSettings } from "@/lib/graph/graphSettings";
import { compileQuery, type QueryTarget } from "@/lib/graph/graphQuery";

interface GraphNode {
  id: string;
  title: string;
  empty: boolean;
  kind: "note" | "category" | "phantom" | "tag" | "attachment";
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: boolean;
  /** Fill colour from the first matching group, if any. */
  color?: string;
  /** For attachment nodes: a note the file is attached to. */
  noteId?: string;
  /** Not yet shown by a running timelapse. */
  hidden?: boolean;
}

export interface ForceGraphDeps {
  getNotes: () => Note[];
  getCategories: () => string[];
  getLinksOf: (n: Note) => string[];
  getByTitle: (t: string) => Note | undefined;
  getCurId: () => string | null;
  getTheme: () => { isDark: boolean; accent: string };
  onNodeClick: (id: string) => void;
  onCategoryClick: (name: string) => void;
  onPhantomClick: (title: string) => void;
  onTagClick?: (tag: string) => void;
  getTags?: (n: Note) => string[];
  getSettings?: () => GraphSettings;
}

// The force sliders are scaled so Obsidian's defaults (0.52 / 10 / 1 / 250)
// give exactly this graph's original forces.
const BASE_REPEL = 4200;
const BASE_SPRING = 0.02;
const BASE_LINK_LEN = 160;
const BASE_CENTER = 0.006;

// A wikilink/embed to one of these is a file, not a note: like Obsidian it
// shows as an attachment (only with "Attachments" on), never as a faded
// "missing note".
const ATTACHMENT_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic|pdf|mp3|wav|m4a|ogg|flac|mp4|webm|mov|mkv|zip|csv|xlsx?|docx?|pptx?|txt|json)$/i;

export class ForceGraph {
  host: HTMLDivElement | null = null;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  nodes: GraphNode[] = [];
  links: [number, number][] = [];
  nb: Record<string, Set<string>> = {};
  deg: Record<string, number> = {};
  scale = 1;
  tx = 0;
  ty = 0;
  w = 0;
  h = 0;
  hover: string | null = null;
  dragNode: GraphNode | null = null;
  panning = false;
  last: { x: number; y: number } | null = null;
  moved = 0;
  raf = 0;
  ro: ResizeObserver | null = null;
  deps: ForceGraphDeps;
  destroyed = false;

  // Obsidian-style motion: one tick per frame so the opening bloom and the
  // spring-back after a drag play out in real time, with the original forces
  // at full strength (same final shape). The simulation rests once nothing
  // is moving and wakes up again on drag or when nodes/links change.
  settled = false;
  stillTicks = 0;
  structureSig = "";
  // Ticks since the layout last woke up. After a couple of seconds of free
  // motion, each tick's movement is eased down to nothing (the forces stay
  // the same), so the layout glides to a stop like Obsidian's instead of
  // creeping around for half a minute.
  awakeTicks = 0;
  /** When the layout last woke up (ms). The glide to rest is timed by
   * ticks or by the clock, whichever is further along, so a slow device
   * that manages fewer frames still comes to rest in ~5.5s instead of
   * animating (and redrawing) for half a minute. */
  awakeSince = 0;

  // Redraw only when something visible changed (layout moving, hover, pan,
  // zoom, size, data, settings or theme). Repainting every frame while
  // nothing moved kept the browser busy and made zooming lag on slower
  // machines.
  lastDrawSig = "";
  lastDrawSettings: GraphSettings | null = null;
  dataVersion = 0;
  colors = { bg: "#141414", baseGray: "#736b5a", edgeCol: "#363636", txtCol: "#8a8a8a", fontStack: "'IBM Plex Sans',sans-serif" };
  colorsKey = "";
  colorsCheckedAt = 0;

  constructor(deps: ForceGraphDeps) {
    this.deps = deps;
  }

  // A note's radius grows with its connection count, but capped and on a
  // sqrt curve so it takes far more links to visibly grow, and the ceiling
  // itself is lower — a handful of connections shouldn't already look big.
  radiusOf(n: GraphNode): number {
    const k = this.settings().nodeSize;
    if (n.kind === "category") return 7 * k;
    if (n.kind === "phantom" || n.kind === "attachment") return 5 * k;
    const d = Math.min(this.deg[n.id] || 0, 24);
    return (5 + Math.sqrt(d) * 1.15) * k;
  }

  settings(): GraphSettings {
    return this.deps.getSettings ? this.deps.getSettings() : GRAPH_DEFAULTS;
  }

  mount(host: HTMLDivElement) {
    if (this.host === host) return;
    host.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;cursor:grab;";
    host.appendChild(canvas);
    this.host = host;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.buildData();

    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      canvas.width = w * this.dpr;
      canvas.height = h * this.dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      this.w = w;
      this.h = h;
      if (this.tx === 0 && this.ty === 0) {
        this.tx = w / 2;
        this.ty = h / 2;
      }
    };
    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(host);

    const rel = (e: MouseEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const toWorld = (mx: number, my: number) => ({ x: (mx - this.tx) / this.scale, y: (my - this.ty) / this.scale });
    const nodeAt = (mx: number, my: number): GraphNode | null => {
      const w = toWorld(mx, my);
      let best: GraphNode | null = null;
      let bd = 1e9;
      this.nodes.forEach((n) => {
        if (n.hidden) return;
        const r = this.radiusOf(n);
        const d = Math.hypot(n.x - w.x, n.y - w.y);
        if (d < r + 5 && d < bd) {
          bd = d;
          best = n;
        }
      });
      return best;
    };
    const onDown = (e: MouseEvent) => {
      const p = rel(e);
      const n = nodeAt(p.x, p.y);
      this.moved = 0;
      this.last = p;
      if (n) {
        this.dragNode = n;
        n.fx = true;
        this.reheat();
      } else {
        this.panning = true;
        canvas.style.cursor = "grabbing";
      }
    };
    const onMove = (e: MouseEvent) => {
      const p = rel(e);
      if (this.dragNode) {
        const w = toWorld(p.x, p.y);
        this.dragNode.x = w.x;
        this.dragNode.y = w.y;
        this.dragNode.vx = 0;
        this.dragNode.vy = 0;
        this.moved += Math.abs(p.x - (this.last?.x ?? p.x)) + Math.abs(p.y - (this.last?.y ?? p.y));
        this.last = p;
      } else if (this.panning) {
        this.tx += p.x - this.last!.x;
        this.ty += p.y - this.last!.y;
        this.moved += Math.abs(p.x - this.last!.x) + Math.abs(p.y - this.last!.y);
        this.last = p;
      } else {
        const n = nodeAt(p.x, p.y);
        this.hover = n ? n.id : null;
        canvas.style.cursor = n ? "pointer" : "grab";
      }
    };
    const onUp = () => {
      if (this.dragNode) {
        if (this.moved < 4) {
          const n = this.dragNode;
          if (n.kind === "category") this.deps.onCategoryClick(n.title);
          else if (n.kind === "phantom") this.deps.onPhantomClick(n.title);
          else if (n.kind === "tag") this.deps.onTagClick?.(n.title);
          else if (n.kind === "attachment") {
            if (n.noteId) this.deps.onNodeClick(n.noteId);
          } else this.deps.onNodeClick(n.id);
        }
        this.dragNode.fx = false;
        this.dragNode = null;
      }
      this.panning = false;
      canvas.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = rel(e);
      const f = Math.exp(-e.deltaY * 0.0015);
      const ns = Math.max(0.25, Math.min(4, this.scale * f));
      const wx = (p.x - this.tx) / this.scale,
        wy = (p.y - this.ty) / this.scale;
      this.scale = ns;
      this.tx = p.x - wx * ns;
      this.ty = p.y - wy * ns;
    };
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Touch: one finger drags a node or pans (mirrors mouse behavior); two
    // fingers pinch-zoom around their midpoint, anchored so the point under
    // your fingers stays put rather than the view jumping.
    const touchPt = (t: Touch) => {
      const b = canvas.getBoundingClientRect();
      return { x: t.clientX - b.left, y: t.clientY - b.top };
    };
    let pinch: { dist: number; scale: number; mid: { x: number; y: number }; tx: number; ty: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        pinch = null;
        const p = touchPt(e.touches[0]);
        const n = nodeAt(p.x, p.y);
        this.moved = 0;
        this.last = p;
        if (n) {
          this.dragNode = n;
          n.fx = true;
          this.reheat();
        } else {
          this.panning = true;
        }
      } else if (e.touches.length === 2) {
        this.dragNode = null;
        this.panning = false;
        const p1 = touchPt(e.touches[0]),
          p2 = touchPt(e.touches[1]);
        pinch = {
          dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
          scale: this.scale,
          mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
          tx: this.tx,
          ty: this.ty,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && !pinch) {
        const p = touchPt(e.touches[0]);
        if (this.dragNode) {
          const w = toWorld(p.x, p.y);
          this.dragNode.x = w.x;
          this.dragNode.y = w.y;
          this.dragNode.vx = 0;
          this.dragNode.vy = 0;
          this.moved += Math.abs(p.x - (this.last?.x ?? p.x)) + Math.abs(p.y - (this.last?.y ?? p.y));
          this.last = p;
        } else if (this.panning) {
          this.tx += p.x - this.last!.x;
          this.ty += p.y - this.last!.y;
          this.moved += Math.abs(p.x - this.last!.x) + Math.abs(p.y - this.last!.y);
          this.last = p;
        }
      } else if (e.touches.length === 2 && pinch) {
        const p1 = touchPt(e.touches[0]),
          p2 = touchPt(e.touches[1]);
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        const ns = Math.max(0.25, Math.min(4, pinch.scale * (dist / pinch.dist)));
        const wx = (pinch.mid.x - pinch.tx) / pinch.scale,
          wy = (pinch.mid.y - pinch.ty) / pinch.scale;
        this.scale = ns;
        this.tx = pinch.mid.x - wx * ns;
        this.ty = pinch.mid.y - wy * ns;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        onUp();
        pinch = null;
      } else if (e.touches.length === 1) {
        // Lifting one finger out of a pinch — drop back to single-touch
        // pan/drag cleanly instead of jumping using stale pinch state.
        pinch = null;
        this.dragNode = null;
        this.panning = false;
        this.last = touchPt(e.touches[0]);
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    const cleanupFns = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (this.ro) this.ro.disconnect();
    };
    this.cleanup = cleanupFns;

    const step = () => {
      if (this.destroyed) return;
      // Schedule the next frame first, so one bad frame can never freeze
      // the graph for good.
      this.raf = requestAnimationFrame(step);
      this.timelapseStep();
      const moved = this.physicsStep();
      if (moved || this.viewChanged()) this.draw();
    };
    this.raf = requestAnimationFrame(step);
  }

  cleanup: (() => void) | null = null;

  reheat() {
    this.settled = false;
    this.stillTicks = 0;
    this.awakeTicks = 0;
    this.awakeSince = 0;
  }

  buildData() {
    const notes = this.deps.getNotes();
    const categories = this.deps.getCategories();
    const cfg = this.settings();
    const tagsOf = this.deps.getTags || ((n: Note) => n.tags || []);
    const rand = () => (Math.random() - 0.5) * 260;
    // Reuse each node's existing position/velocity instead of re-randomizing
    // it — buildData() re-runs on every notes-array change (including
    // editing a totally unrelated note's content, e.g. in the other split
    // pane), and rebuilding from scratch every time made the graph visibly
    // jump/reshuffle continuously while someone was just typing elsewhere.
    // Only a node that's genuinely new (never existed before) gets a fresh
    // random spot.
    const prev: Record<string, { x: number; y: number; vx: number; vy: number; hidden?: boolean }> = {};
    this.nodes.forEach((n) => (prev[n.id] = { x: n.x, y: n.y, vx: n.vx, vy: n.vy, hidden: n.hidden }));
    // On first open, seed nodes on a tight sunflower spiral around the centre
    // (like Obsidian/d3) so the graph blooms outward smoothly instead of
    // starting from a random pile that flings itself apart.
    const firstBuild = this.nodes.length === 0;
    let seeded = 0;
    const posFor = (id: string) => {
      if (prev[id]) return prev[id];
      if (!firstBuild) return { x: rand(), y: rand(), vx: 0, vy: 0 };
      const r = 10 * Math.sqrt(0.5 + seeded),
        a = seeded++ * Math.PI * (3 - Math.sqrt(5));
      return { x: r * Math.cos(a), y: r * Math.sin(a), vx: 0, vy: 0 };
    };

    // "Search files" narrows the graph to matching notes (plus the tags,
    // attachments and categories they connect to), like Obsidian's filter.
    const target = (n: Note): QueryTarget => ({ title: n.title, content: n.content, folder: n.folder, category: n.category, tags: tagsOf(n), date: n.date });
    const search = compileQuery(cfg.search);
    const shown = search ? notes.filter((n) => search(target(n))) : notes;
    const groupMatchers = cfg.groups.map((g) => ({ color: g.color, match: compileQuery(g.query) })).filter((g) => g.match);
    const groupColor = (x: QueryTarget) => groupMatchers.find((g) => g.match!(x))?.color;

    const idOf: Record<string, number> = {};
    const nodes: GraphNode[] = [];
    const links: [number, number][] = [];
    const nb: Record<string, Set<string>> = {};
    const addNode = (n: Omit<GraphNode, "x" | "y" | "vx" | "vy">) => {
      if (idOf[n.id] !== undefined) return;
      idOf[n.id] = nodes.length;
      nodes.push({ ...n, ...posFor(n.id) });
      nb[n.id] = new Set();
    };
    const addLink = (from: string, to: string) => {
      if (from === to || nb[from].has(to)) return;
      links.push([idOf[from], idOf[to]]);
      nb[from].add(to);
      nb[to].add(from);
    };

    shown.forEach((n) => addNode({ id: n.id, title: n.title, empty: !n.content || !n.content.trim(), kind: "note", color: groupColor(target(n)) }));
    const catNodeId = (name: string) => "cat:" + name;
    // Categories are always part of Dandelore's graph; when searching, only
    // the ones the matching notes belong to are kept.
    const catSet = new Set(categories);
    const usedCats = search ? new Set(shown.map((n) => n.category).filter((c) => c && catSet.has(c))) : catSet;
    categories.forEach((c) => {
      if (usedCats.has(c)) addNode({ id: catNodeId(c), title: c, empty: false, kind: "category" });
    });

    shown.forEach((n) => {
      const addAttachment = (fname: string) => {
        const aid = "att:" + fname.toLowerCase();
        addNode({ id: aid, title: fname, empty: false, kind: "attachment", noteId: n.id, color: groupColor({ title: fname, content: "", folder: "", category: "", tags: [] }) });
        addLink(n.id, aid);
      };
      this.deps.getLinksOf(n).forEach((raw) => {
        // [[file.png|alt]] / [[file.png#page=2]] → file.png
        const t = raw.split("|")[0].split("#")[0].trim();
        if (ATTACHMENT_EXT.test(t) && !this.deps.getByTitle(raw)) {
          if (cfg.showAttachments) addAttachment(t.split("/").pop() || t);
          return;
        }
        const tg = this.deps.getByTitle(raw);
        if (tg) {
          if (idOf[tg.id] !== undefined) addLink(n.id, tg.id);
          return;
        }
        // Wikilinks to titles with no matching note show up faded, so the
        // graph reflects pages you've referenced but haven't created yet —
        // unless "Existing files only" is on.
        if (cfg.existingOnly) return;
        const key = t.trim().toLowerCase();
        if (!key) return;
        const pid = "phantom:" + key;
        addNode({ id: pid, title: t.trim(), empty: false, kind: "phantom", color: groupColor({ title: t.trim(), content: "", folder: "", category: "", tags: [] }) });
        addLink(n.id, pid);
      });
      if (n.category && idOf[catNodeId(n.category)] !== undefined) addLink(n.id, catNodeId(n.category));
      if (cfg.showTags) {
        tagsOf(n).forEach((tag) => {
          const tid = "tag:" + tag.toLowerCase();
          addNode({ id: tid, title: "#" + tag, empty: false, kind: "tag", color: groupColor({ title: "#" + tag, content: "", folder: "", category: "", tags: [tag] }) });
          addLink(n.id, tid);
        });
      }
      if (cfg.showAttachments) {
        Object.keys(n.attachments || {}).forEach(addAttachment);
      }
    });

    // "Orphans" off hides anything with no connections at all.
    let finalNodes = nodes;
    let finalLinks = links;
    if (!cfg.showOrphans) {
      finalNodes = nodes.filter((n) => nb[n.id].size > 0);
      const newIdx: Record<string, number> = {};
      finalNodes.forEach((n, i) => (newIdx[n.id] = i));
      finalLinks = links.map(([a, b]) => [newIdx[nodes[a].id], newIdx[nodes[b].id]] as [number, number]);
    }

    this.nodes = finalNodes;
    this.links = finalLinks;
    this.dataVersion++;
    // A hovered/touched node that a filter just removed mustn't linger.
    if (this.hover && !finalNodes.some((n) => n.id === this.hover)) this.hover = null;
    this.nb = nb;
    const deg: Record<string, number> = {};
    finalNodes.forEach((n) => (deg[n.id] = nb[n.id].size));
    this.deg = deg;

    // buildData() re-runs on every notes change, including plain typing;
    // only wake the layout up when nodes or links actually changed.
    const sig = finalNodes.map((n) => n.id).join("|") + "#" + finalLinks.map(([a, b]) => a + "-" + b).join(",");
    if (sig !== this.structureSig) {
      this.reheat();
      this.structureSig = sig;
    }
  }

  // ---------- timelapse ----------
  // Like Obsidian's "Start timelapse animation": every node disappears, then
  // notes reappear one by one in the order they were created (their date),
  // each with its tags/attachments/categories, and the layout grows as they
  // arrive.
  timelapse: { order: string[]; shown: number; start: number; duration: number } | null = null;

  startTimelapse(dateOf: (id: string) => string) {
    const N = this.nodes;
    if (!N.length) return;
    const notes = N.filter((n) => n.kind === "note").sort((a, b) => (dateOf(a.id) || "").localeCompare(dateOf(b.id) || "") || a.title.localeCompare(b.title));
    // Each non-note node appears together with the first note it's linked to.
    const order: string[] = [];
    const placed = new Set<string>();
    notes.forEach((n) => {
      order.push(n.id);
      placed.add(n.id);
      (this.nb[n.id] || []).forEach((m) => {
        const mn = N.find((x) => x.id === m);
        if (mn && mn.kind !== "note" && !placed.has(m)) {
          order.push(m);
          placed.add(m);
        }
      });
    });
    N.forEach((n) => {
      if (!placed.has(n.id)) order.push(n.id);
    });
    N.forEach((n) => {
      n.hidden = true;
      n.vx = n.vy = 0;
    });
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.timelapse = { order, shown: 0, start: now, duration: Math.min(12000, Math.max(2500, notes.length * 55)) };
    this.reheat();
  }

  timelapseStep() {
    const tl = this.timelapse;
    if (!tl) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const want = Math.min(tl.order.length, Math.ceil(((now - tl.start) / tl.duration) * tl.order.length));
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    while (tl.shown < want) {
      const n = byId.get(tl.order[tl.shown++]);
      if (!n) continue;
      // Pop in next to an already-visible neighbour, or near the centre.
      const anchor = [...(this.nb[n.id] || [])].map((id) => byId.get(id)).find((m) => m && !m.hidden);
      const jitter = () => (Math.random() - 0.5) * 30;
      n.x = (anchor ? anchor.x : 0) + jitter();
      n.y = (anchor ? anchor.y : 0) + jitter();
      n.vx = n.vy = 0;
      n.hidden = false;
      this.dataVersion++;
      this.reheat();
    }
    if (tl.shown >= tl.order.length) this.timelapse = null;
  }

  /** One simulation tick; false when the layout is at rest (nothing ran). */
  physicsStep(): boolean {
    if (this.settled && !this.dragNode) return false;
    const cfg = this.settings();
    const repel = BASE_REPEL * (cfg.repelForce / GRAPH_DEFAULTS.repelForce);
    const spring = BASE_SPRING * (cfg.linkForce / GRAPH_DEFAULTS.linkForce);
    const linkLen = BASE_LINK_LEN * (cfg.linkDistance / GRAPH_DEFAULTS.linkDistance);
    const center = BASE_CENTER * (cfg.centerForce / GRAPH_DEFAULTS.centerForce);
    const N = this.nodes.filter((n) => !n.hidden);
    for (let a = 0; a < N.length; a++) {
      for (let b = a + 1; b < N.length; b++) {
        const A = N[a],
          B = N[b];
        let dx = A.x - B.x,
          dy = A.y - B.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = Math.random();
          dy = Math.random();
        }
        // Treat anything closer than 20px as 20px apart, so two nodes that
        // start almost on top of each other don't fling each other away.
        d2 = Math.max(d2, 400);
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const rep = repel / d2;
        const fx = (dx / d) * rep,
          fy = (dy / d) * rep;
        A.vx += fx;
        A.vy += fy;
        B.vx -= fx;
        B.vy -= fy;
      }
    }
    this.links.forEach(([a, b]) => {
      const A = this.nodes[a],
        B = this.nodes[b];
      if (A.hidden || B.hidden) return;
      const dx = B.x - A.x,
        dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = (d - linkLen) * spring;
      const fx = (dx / d) * k,
        fy = (dy / d) * k;
      A.vx += fx;
      A.vy += fy;
      B.vx -= fx;
      B.vy -= fy;
    });
    const maxSpeed = 12;
    let fastest = 0;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.dragNode || this.timelapse || !this.awakeSince) {
      if (this.dragNode || this.timelapse) this.awakeTicks = 0;
      this.awakeSince = now;
    }
    // 150 ticks ≈ 2.5s of free motion, then a 180-tick ≈ 3s glide to rest.
    const cool = Math.max(Math.max(0, this.awakeTicks++ - 150) / 180, Math.max(0, now - this.awakeSince - 2500) / 3000);
    const ease = cool >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * cool);
    N.forEach((n) => {
      n.vx += -n.x * center;
      n.vy += -n.y * center;
      if (!n.fx) {
        n.vx *= 0.82;
        n.vy *= 0.82;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > maxSpeed) {
          n.vx *= maxSpeed / sp;
          n.vy *= maxSpeed / sp;
        }
        n.x += n.vx * ease;
        n.y += n.vy * ease;
        fastest = Math.max(fastest, sp * ease);
      }
    });
    // Come to rest once every node has been barely moving for half a second.
    if (fastest < 0.15 || ease === 0) {
      if (++this.stillTicks >= 30 && !this.dragNode && !this.timelapse) this.settled = true;
    } else {
      this.stillTicks = 0;
    }
    return true;
  }

  /** Re-read the theme's colours (at most twice a second — reading styles
   * every frame was measurable work). */
  refreshColors() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.colorsKey && now - this.colorsCheckedAt < 500) return;
    this.colorsCheckedAt = now;
    const { isDark } = this.deps.getTheme();
    // Reading the vault's actual current CSS variables (rather than a
    // hardcoded isDark ? warm-dark : warm-light pair) means the graph
    // follows whichever theme is really active — the old hardcoded pair
    // was always the *warm* theme's colors, so plain Dark/Light rendered
    // with a warm ring/text tint that didn't match either theme.
    const cs = this.host ? getComputedStyle(this.host) : null;
    const cssVar = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;
    this.colors = {
      bg: cssVar("--bg", isDark ? "#141414" : "#faf7f2"),
      baseGray: cssVar("--faint", isDark ? "#736b5a" : "#a2977f"),
      edgeCol: cssVar("--border", isDark ? "#363636" : "#e2dcc9"),
      txtCol: cssVar("--muted", isDark ? "#8a8a8a" : "#8a7f6a"),
      fontStack: cs?.fontFamily || "'IBM Plex Sans',sans-serif",
    };
    this.colorsKey = JSON.stringify(this.colors);
  }

  /** Whether anything that affects the picture changed since the last draw. */
  viewChanged(): boolean {
    this.refreshColors();
    const { isDark, accent } = this.deps.getTheme();
    const cfg = this.settings();
    const sig = [this.tx, this.ty, this.scale, this.w, this.h, this.dpr, this.hover, this.deps.getCurId(), isDark, accent, this.dataVersion, this.colorsKey].join("|");
    if (sig === this.lastDrawSig && cfg === this.lastDrawSettings) return false;
    this.lastDrawSig = sig;
    this.lastDrawSettings = cfg;
    return true;
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { accent } = this.deps.getTheme();
    const cfg = this.settings();
    this.refreshColors();
    // Keep the change-check in step with this draw, so the frame after a
    // forced draw (e.g. physics) isn't drawn a second time for nothing.
    this.viewChanged();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.tx, this.ty);
    ctx.scale(this.scale, this.scale);

    const cur = this.deps.getCurId();
    const hov = this.hover;
    const hset = hov && this.nb[hov] ? new Set([hov, ...this.nb[hov]]) : null;
    const { bg, baseGray, edgeCol, txtCol, fontStack } = this.colors;
    const nodeCol = mixHex(accent, baseGray, 0.5);
    const ring = bg;
    const lineW = cfg.linkThickness;

    // Only what's on screen is drawn (plus a margin so labels and big dots
    // at the edge don't pop in and out).
    const margin = (140 + 12 * cfg.nodeSize) / Math.min(this.scale, 1) + 12 * cfg.nodeSize;
    const left = -this.tx / this.scale - margin,
      top = -this.ty / this.scale - margin,
      right = (this.w - this.tx) / this.scale + margin,
      bottom = (this.h - this.ty) / this.scale + margin;
    const offscreen = (x: number, y: number) => x < left || x > right || y < top || y > bottom;

    // Lines (only those crossing the screen). Each is its own stroke: one
    // combined path is slower here, since translucent overlapping strokes
    // force the browser to build a coverage mask for the whole path.
    ctx.lineCap = "butt";
    const drawLinks = (lit: boolean) => {
      ctx.strokeStyle = lit ? accent : edgeCol;
      ctx.fillStyle = lit ? accent : edgeCol;
      ctx.globalAlpha = hov ? (lit ? 0.9 : 0.12) : 0.65;
      ctx.lineWidth = (lit ? 1.6 : 1) * lineW;
      for (const [a, b] of this.links) {
        const A = this.nodes[a],
          B = this.nodes[b];
        if (A.hidden || B.hidden) continue;
        if ((A.x < left && B.x < left) || (A.x > right && B.x > right) || (A.y < top && B.y < top) || (A.y > bottom && B.y > bottom)) continue;
        const on = !!(hov && (A.id === hov || B.id === hov));
        if (on !== lit) continue;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
        if (cfg.arrows) {
          // Arrowhead at the target's edge, pointing from the linking note.
          const dx = B.x - A.x,
            dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 1;
          const ux = dx / d,
            uy = dy / d;
          const tipX = B.x - ux * (this.radiusOf(B) + 2),
            tipY = B.y - uy * (this.radiusOf(B) + 2);
          const size = 5 + 2 * lineW;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - ux * size - uy * size * 0.55, tipY - uy * size + ux * size * 0.55);
          ctx.lineTo(tipX - ux * size + uy * size * 0.55, tipY - uy * size - ux * size * 0.55);
          ctx.closePath();
          ctx.fill();
        }
      }
    };
    drawLinks(false);
    if (hov) drawLinks(true);
    ctx.globalAlpha = 1;
    const emptyNodeCol = mixHex(nodeCol, bg, 0.4);
    const categoryCol = mixHex(accent, bg, 0.35);
    // Solid (opaque) faded color rather than an alpha-blended one — alpha
    // let the connecting line show through the node and made the ring
    // stroke look like a translucent halo. A flatter, bg-mixed solid color
    // still reads as "faded" without either artifact.
    const phantomCol = mixHex(nodeCol, bg, 0.6);
    // Tags and attachments get their own hues, like Obsidian's graph.
    const tagCol = mixHex("#6fa86a", baseGray, 0.25);
    const attachmentCol = mixHex("#c9a24a", baseGray, 0.25);
    // Labels fade out as you zoom out; the "Text fade threshold" slider
    // moves the zoom level where that happens (left = labels stay longer).
    const fadeAt = 0.55 * Math.pow(2, cfg.textFade);
    const labelAlpha = Math.max(0, Math.min(1, (this.scale - fadeAt * 0.8) / (fadeAt * 0.2)));
    ctx.textAlign = "center";
    ctx.lineWidth = 2;
    ctx.strokeStyle = ring;
    let font = "";
    for (const n of this.nodes) {
      if (n.hidden || offscreen(n.x, n.y)) continue;
      const r = this.radiusOf(n);
      const active = n.id === cur;
      const dim = !!(hset && !hset.has(n.id));
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      const on = active || hov === n.id;
      ctx.fillStyle = on
        ? accent
        : n.color
          ? n.color
          : n.kind === "category"
            ? categoryCol
            : n.kind === "phantom"
              ? phantomCol
              : n.kind === "tag"
                ? tagCol
                : n.kind === "attachment"
                  ? attachmentCol
                  : n.empty
                    ? emptyNodeCol
                    : nodeCol;
      ctx.fill();
      if (n.kind !== "phantom") ctx.stroke();
      const forced = n.id === hov || active;
      const a = forced ? 1 : labelAlpha;
      if (a > 0.01) {
        ctx.globalAlpha = (dim ? 0.22 : 1) * a;
        ctx.fillStyle = on ? accent : txtCol;
        const f = (on ? "600 " : n.kind === "category" ? "600 " : "500 ") + "11px " + fontStack;
        if (f !== font) {
          ctx.font = f;
          font = f;
        }
        const label = n.title.length > 20 ? n.title.slice(0, 19) + "…" : n.title;
        ctx.fillText(label || "Untitled", n.x, n.y - r - 6);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** The graph as currently shown, as a PNG with the theme background. */
  screenshot(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const src = this.canvas;
      if (!src) return resolve(null);
      const out = document.createElement("canvas");
      out.width = src.width;
      out.height = src.height;
      const c = out.getContext("2d");
      if (!c) return resolve(null);
      const bg = (this.host && getComputedStyle(this.host).getPropertyValue("--bg").trim()) || (this.deps.getTheme().isDark ? "#141414" : "#faf7f2");
      c.fillStyle = bg;
      c.fillRect(0, 0, out.width, out.height);
      c.drawImage(src, 0, 0);
      out.toBlob((b) => resolve(b), "image/png");
    });
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.cleanup) this.cleanup();
  }
}
