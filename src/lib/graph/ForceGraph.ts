import { mixHex } from "@/lib/theme/color";
import type { Note } from "@/types/vault";

interface GraphNode {
  id: string;
  title: string;
  empty: boolean;
  kind: "note" | "category" | "phantom";
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: boolean;
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
}

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

  constructor(deps: ForceGraphDeps) {
    this.deps = deps;
  }

  // A note's radius grows with its connection count, but capped and on a
  // sqrt curve so it takes far more links to visibly grow, and the ceiling
  // itself is lower — a handful of connections shouldn't already look big.
  radiusOf(n: GraphNode): number {
    if (n.kind === "category") return 7;
    if (n.kind === "phantom") return 5;
    const d = Math.min(this.deg[n.id] || 0, 24);
    return 5 + Math.sqrt(d) * 1.15;
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
          else this.deps.onNodeClick(n.id);
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
      this.physicsStep();
      this.draw();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  cleanup: (() => void) | null = null;

  reheat() {
    this.settled = false;
    this.stillTicks = 0;
    this.awakeTicks = 0;
  }

  buildData() {
    const notes = this.deps.getNotes();
    const categories = this.deps.getCategories();
    const rand = () => (Math.random() - 0.5) * 260;
    // Reuse each node's existing position/velocity instead of re-randomizing
    // it — buildData() re-runs on every notes-array change (including
    // editing a totally unrelated note's content, e.g. in the other split
    // pane), and rebuilding from scratch every time made the graph visibly
    // jump/reshuffle continuously while someone was just typing elsewhere.
    // Only a node that's genuinely new (never existed before) gets a fresh
    // random spot.
    const prev: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    this.nodes.forEach((n) => (prev[n.id] = { x: n.x, y: n.y, vx: n.vx, vy: n.vy }));
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
    const idOf: Record<string, number> = {};
    const nodes: GraphNode[] = [];
    notes.forEach((n) => {
      idOf[n.id] = nodes.length;
      nodes.push({ id: n.id, title: n.title, empty: !n.content || !n.content.trim(), kind: "note", ...posFor(n.id) });
    });
    const catNodeId = (name: string) => "cat:" + name;
    categories.forEach((c) => {
      idOf[catNodeId(c)] = nodes.length;
      nodes.push({ id: catNodeId(c), title: c, empty: false, kind: "category", ...posFor(catNodeId(c)) });
    });

    const links: [number, number][] = [];
    const nb: Record<string, Set<string>> = {};
    nodes.forEach((n) => (nb[n.id] = new Set()));
    // Wikilinks to titles with no matching note still show up here, faded,
    // so the graph reflects pages you've referenced but haven't created yet.
    const phantomIdOf: Record<string, string> = {};
    notes.forEach((n) => {
      this.deps.getLinksOf(n).forEach((t) => {
        const tg = this.deps.getByTitle(t);
        if (tg) {
          if (tg.id === n.id) return;
          links.push([idOf[n.id], idOf[tg.id]]);
          nb[n.id].add(tg.id);
          nb[tg.id].add(n.id);
          return;
        }
        const key = t.trim().toLowerCase();
        if (!key) return;
        let pid = phantomIdOf[key];
        if (!pid) {
          pid = "phantom:" + key;
          phantomIdOf[key] = pid;
          idOf[pid] = nodes.length;
          nodes.push({ id: pid, title: t.trim(), empty: false, kind: "phantom", ...posFor(pid) });
          nb[pid] = new Set();
        }
        links.push([idOf[n.id], idOf[pid]]);
        nb[n.id].add(pid);
        nb[pid].add(n.id);
      });
      if (n.category) {
        const cid = catNodeId(n.category);
        if (idOf[cid] !== undefined) {
          links.push([idOf[n.id], idOf[cid]]);
          nb[n.id].add(cid);
          nb[cid].add(n.id);
        }
      }
    });
    this.nodes = nodes;
    this.links = links;
    this.nb = nb;
    const deg: Record<string, number> = {};
    nodes.forEach((n) => (deg[n.id] = nb[n.id].size));
    this.deg = deg;

    // buildData() re-runs on every notes change, including plain typing;
    // only wake the layout up when nodes or links actually changed.
    const sig = nodes.map((n) => n.id).join("|") + "#" + links.map(([a, b]) => a + "-" + b).join(",");
    if (sig !== this.structureSig) {
      this.reheat();
      this.structureSig = sig;
    }
  }

  physicsStep() {
    if (this.settled && !this.dragNode) return;
    const N = this.nodes;
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
        const rep = 4200 / d2;
        const fx = (dx / d) * rep,
          fy = (dy / d) * rep;
        A.vx += fx;
        A.vy += fy;
        B.vx -= fx;
        B.vy -= fy;
      }
    }
    this.links.forEach(([a, b]) => {
      const A = N[a],
        B = N[b];
      const dx = B.x - A.x,
        dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = (d - 160) * 0.02;
      const fx = (dx / d) * k,
        fy = (dy / d) * k;
      A.vx += fx;
      A.vy += fy;
      B.vx -= fx;
      B.vy -= fy;
    });
    const maxSpeed = 12;
    let fastest = 0;
    if (this.dragNode) this.awakeTicks = 0;
    const cool = Math.max(0, this.awakeTicks++ - 150) / 180;
    const ease = cool >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * cool);
    N.forEach((n) => {
      n.vx += -n.x * 0.006;
      n.vy += -n.y * 0.006;
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
      if (++this.stillTicks >= 30 && !this.dragNode) this.settled = true;
    } else {
      this.stillTicks = 0;
    }
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { isDark, accent } = this.deps.getTheme();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.tx, this.ty);
    ctx.scale(this.scale, this.scale);

    const cur = this.deps.getCurId();
    const hov = this.hover;
    const hset = hov ? new Set([hov, ...this.nb[hov]]) : null;
    // Reading the vault's actual current CSS variables (rather than a
    // hardcoded isDark ? warm-dark : warm-light pair) means the graph
    // follows whichever theme is really active — the old hardcoded pair
    // was always the *warm* theme's colors, so plain Dark/Light rendered
    // with a warm ring/text tint that didn't match either theme.
    const cs = this.host ? getComputedStyle(this.host) : null;
    const cssVar = (name: string, fallback: string) => {
      const v = cs?.getPropertyValue(name).trim();
      return v || fallback;
    };
    const bg = cssVar("--bg", isDark ? "#141414" : "#faf7f2");
    const baseGray = cssVar("--faint", isDark ? "#736b5a" : "#a2977f");
    const edgeCol = cssVar("--border", isDark ? "#363636" : "#e2dcc9");
    const nodeCol = mixHex(accent, baseGray, 0.5);
    const ring = bg;
    const txtCol = cssVar("--muted", isDark ? "#8a8a8a" : "#8a7f6a");
    const fontStack = cs?.fontFamily || "'IBM Plex Sans',sans-serif";

    this.links.forEach(([a, b]) => {
      const A = this.nodes[a],
        B = this.nodes[b];
      const on = !!(hov && (A.id === hov || B.id === hov));
      ctx.strokeStyle = on ? accent : edgeCol;
      ctx.globalAlpha = hov ? (on ? 0.9 : 0.12) : 0.65;
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    const emptyNodeCol = mixHex(nodeCol, bg, 0.4);
    const categoryCol = mixHex(accent, bg, 0.35);
    // Solid (opaque) faded color rather than an alpha-blended one — alpha
    // let the connecting line show through the node and made the ring
    // stroke look like a translucent halo. A flatter, bg-mixed solid color
    // still reads as "faded" without either artifact.
    const phantomCol = mixHex(nodeCol, bg, 0.6);
    this.nodes.forEach((n) => {
      const r = this.radiusOf(n);
      const active = n.id === cur;
      const dim = !!(hset && !hset.has(n.id));
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      const on = active || hov === n.id;
      ctx.fillStyle =
        n.kind === "category"
          ? on
            ? accent
            : categoryCol
          : n.kind === "phantom"
            ? phantomCol
            : n.empty && !on
              ? emptyNodeCol
              : on
                ? accent
                : nodeCol;
      ctx.fill();
      if (n.kind !== "phantom") {
        ctx.lineWidth = 2;
        ctx.strokeStyle = ring;
        ctx.stroke();
      }
      if (this.scale > 0.55 || n.id === hov || active) {
        ctx.fillStyle = on ? accent : txtCol;
        ctx.font = (on ? "600 " : n.kind === "category" ? "600 " : "500 ") + "11px " + fontStack;
        ctx.textAlign = "center";
        const label = n.title.length > 20 ? n.title.slice(0, 19) + "…" : n.title;
        ctx.fillText(label || "Untitled", n.x, n.y - r - 6);
      }
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.cleanup) this.cleanup();
  }
}
