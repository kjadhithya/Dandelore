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

  // Simulation "temperature", modelled on d3-force (which Obsidian's graph
  // uses): forces are scaled by alpha, alpha decays towards alphaTarget,
  // and once it drops below alphaMin the layout stops moving entirely.
  // Before this the forces never cooled, so the layout oscillated forever.
  alpha = 1;
  alphaTarget = 0;
  alphaMin = 0.001;
  alphaDecay = 1 - Math.pow(0.001, 1 / 300); // ~300 ticks (~5s) from 1 to alphaMin
  velocityDecay = 0.4;
  linkCount: number[] = [];
  structureSig = "";
  fitted = false;

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
        this.reheat(0.3);
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
        this.alphaTarget = 0;
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
          this.reheat(0.3);
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

    // Run most of the layout off-screen and zoom to fit, so opening the
    // graph shows a nearly settled picture that eases into place instead of
    // nodes exploding outwards from a pile.
    for (let i = 0; i < 150 && this.physicsStep(); i++);
    this.fitToView();

    const step = () => {
      if (this.destroyed) return;
      this.physicsStep();
      this.draw();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  reheat(target = 0.3) {
    this.alphaTarget = target;
    this.alpha = Math.max(this.alpha, target);
  }

  fitToView() {
    if (!this.w || !this.h || !this.nodes.length) return;
    let minx = Infinity,
      maxx = -Infinity,
      miny = Infinity,
      maxy = -Infinity;
    this.nodes.forEach((n) => {
      minx = Math.min(minx, n.x);
      maxx = Math.max(maxx, n.x);
      miny = Math.min(miny, n.y);
      maxy = Math.max(maxy, n.y);
    });
    const pad = 60;
    const bw = Math.max(1, maxx - minx),
      bh = Math.max(1, maxy - miny);
    const scale = Math.max(0.25, Math.min(1.5, Math.min((this.w - pad * 2) / bw, (this.h - pad * 2) / bh) * 0.85));
    this.scale = scale;
    this.tx = this.w / 2 - ((minx + maxx) / 2) * scale;
    this.ty = this.h / 2 - ((miny + maxy) / 2) * scale;
    this.fitted = true;
  }

  cleanup: (() => void) | null = null;

  buildData() {
    const notes = this.deps.getNotes();
    const categories = this.deps.getCategories();
    // New nodes start on a phyllotaxis spiral (d3-force's default), which is
    // evenly spread — random starts could land two nodes almost on top of
    // each other and fling them apart.
    const spiral = (i: number) => {
      const r = 14 * Math.sqrt(0.5 + i),
        a = i * Math.PI * (3 - Math.sqrt(5));
      return { x: r * Math.cos(a), y: r * Math.sin(a), vx: 0, vy: 0 };
    };
    // Reuse each node's existing position/velocity instead of re-randomizing
    // it — buildData() re-runs on every notes-array change (including
    // editing a totally unrelated note's content, e.g. in the other split
    // pane), and rebuilding from scratch every time made the graph visibly
    // jump/reshuffle continuously while someone was just typing elsewhere.
    // Only a node that's genuinely new (never existed before) gets a fresh
    // random spot.
    const prev: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    this.nodes.forEach((n) => (prev[n.id] = { x: n.x, y: n.y, vx: n.vx, vy: n.vy }));
    let spiralI = 0;
    const fresh = new Set<string>();
    const posFor = (id: string) => {
      if (prev[id]) return prev[id];
      fresh.add(id);
      return spiral(spiralI++ + Object.keys(prev).length);
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
    const seenLink = new Set<string>();
    // A→B and B→A (or a note linking the same page twice) are one edge, not
    // two springs pulling twice as hard.
    const addLink = (a: number, b: number) => {
      const key = a < b ? a + "," + b : b + "," + a;
      if (seenLink.has(key)) return;
      seenLink.add(key);
      links.push([a, b]);
    };
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
          addLink(idOf[n.id], idOf[tg.id]);
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
        addLink(idOf[n.id], idOf[pid]);
        nb[n.id].add(pid);
        nb[pid].add(n.id);
      });
      if (n.category) {
        const cid = catNodeId(n.category);
        if (idOf[cid] !== undefined) {
          addLink(idOf[n.id], idOf[cid]);
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
    const count = nodes.map(() => 0);
    links.forEach(([a, b]) => {
      count[a]++;
      count[b]++;
    });
    this.linkCount = count;

    // Drop genuinely new nodes next to something they link to (when that
    // already has a position) instead of out on the spiral's edge.
    if (Object.keys(prev).length) {
      nodes.forEach((n) => {
        if (!fresh.has(n.id)) return;
        const anchor = [...nb[n.id]].map((id) => nodes[idOf[id]]).find((m) => m && !fresh.has(m.id));
        if (anchor) {
          n.x = anchor.x + (Math.random() - 0.5) * 40;
          n.y = anchor.y + (Math.random() - 0.5) * 40;
        }
      });
    }

    // buildData() re-runs on every notes change, including plain typing.
    // Only wake the layout up when nodes or links actually changed.
    const sig = nodes.map((n) => n.id).join("|") + "#" + links.map(([a, b]) => a + "-" + b).join(",");
    if (sig !== this.structureSig) {
      if (this.structureSig) this.reheat(0.3);
      this.alphaTarget = this.dragNode ? 0.3 : 0;
      this.structureSig = sig;
    }
  }

  /** One simulation tick. Returns false once the layout has settled. */
  physicsStep(): boolean {
    if (this.alpha < this.alphaMin && this.alphaTarget === 0) return false;
    this.alpha += (this.alphaTarget - this.alpha) * this.alphaDecay;
    const alpha = this.alpha;
    const N = this.nodes;

    // Repulsion between every pair (many-body), with a minimum distance so
    // two nodes that start close together can't fling each other away.
    const strength = -260;
    const distMin2 = 25 * 25;
    for (let a = 0; a < N.length; a++) {
      const A = N[a];
      for (let b = a + 1; b < N.length; b++) {
        const B = N[b];
        let dx = B.x - A.x,
          dy = B.y - A.y;
        if (dx === 0 && dy === 0) {
          dx = (Math.random() - 0.5) * 1e-3;
          dy = (Math.random() - 0.5) * 1e-3;
        }
        let l2 = dx * dx + dy * dy;
        if (l2 < distMin2) l2 = Math.sqrt(distMin2 * l2);
        const w = (strength * alpha) / l2;
        A.vx += dx * w;
        A.vy += dy * w;
        B.vx -= dx * w;
        B.vy -= dy * w;
      }
    }

    // Springs. Each link's strength is 1/min(degree) and the correction is
    // split by degree, so hubs (a category with 20 notes) barely move while
    // their leaves do — the d3-force defaults that keep hubs from oscillating.
    const distance = 70;
    const count = this.linkCount;
    for (const [s, t] of this.links) {
      const S = N[s],
        T = N[t];
      let dx = T.x + T.vx - S.x - S.vx,
        dy = T.y + T.vy - S.y - S.vy;
      if (dx === 0 && dy === 0) {
        dx = (Math.random() - 0.5) * 1e-3;
        dy = (Math.random() - 0.5) * 1e-3;
      }
      const l = Math.sqrt(dx * dx + dy * dy);
      const k = ((l - distance) / l) * alpha * (1 / Math.min(count[s] || 1, count[t] || 1));
      const bias = (count[s] || 1) / ((count[s] || 1) + (count[t] || 1));
      dx *= k;
      dy *= k;
      T.vx -= dx * bias;
      T.vy -= dy * bias;
      S.vx += dx * (1 - bias);
      S.vy += dy * (1 - bias);
    }

    // Gentle pull towards the centre so disconnected pieces stay in view.
    const centre = 0.06 * alpha;
    for (const n of N) {
      n.vx -= n.x * centre;
      n.vy -= n.y * centre;
      if (n.fx) {
        n.vx = 0;
        n.vy = 0;
      } else {
        n.vx *= 1 - this.velocityDecay;
        n.vy *= 1 - this.velocityDecay;
        n.x += n.vx;
        n.y += n.vy;
      }
    }
    return true;
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
