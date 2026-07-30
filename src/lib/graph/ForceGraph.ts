import { mixHex } from "@/lib/theme/color";
import type { Note } from "@/types/vault";

interface GraphNode {
  id: string;
  title: string;
  empty: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: boolean;
}

export interface ForceGraphDeps {
  getNotes: () => Note[];
  getLinksOf: (n: Note) => string[];
  getByTitle: (t: string) => Note | undefined;
  getCurId: () => string | null;
  getTheme: () => { isDark: boolean; accent: string };
  onNodeClick: (id: string) => void;
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

  constructor(deps: ForceGraphDeps) {
    this.deps = deps;
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
        const r = 6 + Math.min(this.deg[n.id] || 0, 5) * 1.7;
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
        if (this.moved < 4) this.deps.onNodeClick(this.dragNode.id);
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

  buildData() {
    const notes = this.deps.getNotes();
    const idOf: Record<string, number> = {};
    notes.forEach((n, i) => (idOf[n.id] = i));
    this.nodes = notes.map((n) => ({
      id: n.id,
      title: n.title,
      empty: !n.content || !n.content.trim(),
      x: (Math.random() - 0.5) * 260,
      y: (Math.random() - 0.5) * 260,
      vx: 0,
      vy: 0,
    }));
    const links: [number, number][] = [];
    const nb: Record<string, Set<string>> = {};
    notes.forEach((n) => (nb[n.id] = new Set()));
    notes.forEach((n) => {
      this.deps.getLinksOf(n).forEach((t) => {
        const tg = this.deps.getByTitle(t);
        if (tg && tg.id !== n.id) {
          links.push([idOf[n.id], idOf[tg.id]]);
          nb[n.id].add(tg.id);
          nb[tg.id].add(n.id);
        }
      });
    });
    this.links = links;
    this.nb = nb;
    const deg: Record<string, number> = {};
    this.nodes.forEach((n) => (deg[n.id] = nb[n.id].size));
    this.deg = deg;
  }

  physicsStep() {
    const N = this.nodes;
    for (let a = 0; a < N.length; a++) {
      for (let b = a + 1; b < N.length; b++) {
        const A = N[a],
          B = N[b];
        let dx = A.x - B.x,
          dy = A.y - B.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          d2 = 0.01;
          dx = Math.random();
          dy = Math.random();
        }
        const d = Math.sqrt(d2);
        const rep = 2600 / d2;
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
      const k = (d - 96) * 0.02;
      const fx = (dx / d) * k,
        fy = (dy / d) * k;
      A.vx += fx;
      A.vy += fy;
      B.vx -= fx;
      B.vy -= fy;
    });
    N.forEach((n) => {
      n.vx += -n.x * 0.006;
      n.vy += -n.y * 0.006;
      if (!n.fx) {
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
      }
    });
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
    const edgeCol = isDark ? "#47423a" : "#c3b79a";
    const nodeCol = mixHex(accent, isDark ? "#4a4a4a" : "#bdbdbd", 0.5);
    const ring = isDark ? "#1d1b17" : "#faf5ea";
    const txtCol = isDark ? "#b8ad98" : "#6f6552";

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
    const emptyNodeCol = mixHex(nodeCol, isDark ? "#141414" : "#faf5ea", 0.4);
    this.nodes.forEach((n) => {
      const r = 6 + Math.min(this.deg[n.id] || 0, 5) * 1.7;
      const active = n.id === cur;
      const dim = !!(hset && !hset.has(n.id));
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.empty && !active && hov !== n.id ? emptyNodeCol : active ? accent : hov === n.id ? accent : nodeCol;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ring;
      ctx.stroke();
      ctx.globalAlpha = dim ? 0.22 : 1;
      if (this.scale > 0.55 || n.id === hov || active) {
        ctx.fillStyle = active || n.id === hov ? accent : txtCol;
        ctx.font = (active || n.id === hov ? "600 " : "500 ") + "11px 'IBM Plex Sans',sans-serif";
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
