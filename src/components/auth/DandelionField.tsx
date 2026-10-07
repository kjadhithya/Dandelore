"use client";
import { useEffect, useRef } from "react";

/* Animated pixel-art dandelion field shown behind the sign-in / sign-up card.
 * Moving the pointer over a flower blows its seeds away; they regrow after a
 * few seconds. Ported from the Dandelion_Field_v6 design. */

const PALETTE = {
  sky: "#f7eadc", white: "#fffaf4", cream: "#fbd9b8", pink: "#f6c9ae", green: "#e0601f", dgreen: "#9a3005",
  lime: "#f39a55", orange: "#ff5a14", dorange: "#a32c00", lorange: "#ffa56b", black: "#2e0f03",
  g1: "#f6bf96", g2: "#ee9a66", g3: "#e2763c", g4: "#fde6cf", g5: "#c4501a", g6: "#7e2604",
};
type Color = keyof typeof PALETTE;

const DOT_SIZE = 4;
const REGROW_MS = 4000;
const BLOW_RADIUS = 60;

type Dot = [number, number, Color, number];
interface Wedge { a: number; dots: Dot[]; on: number; gs: number }
interface Flower {
  baseC: number; bx: number; hy: number; Rc: number; R: number; sw: number; ph: number;
  wedges: Wedge[]; leaves: [number, number, Color][]; last: number; regrowing: boolean;
}
interface Seed { amb?: boolean; x: number; y: number; vx: number; vy: number; rot: number; life: number; max: number; ph: number; s: number }
interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; c: Color }

function makeSeedShape(): [number, number, Color][] {
  const pts: [number, number, Color][] = [];
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (k / 8 - 0.5) * 2.1, len = 6 + Math.random() * 2.5;
    for (let r = 1; r <= len; r += 0.8) pts.push([Math.cos(a) * r, Math.sin(a) * r, r > len - 1.5 ? "lorange" : "orange"]);
  }
  pts.push([0, 0, "orange"], [0, -1, "orange"]);
  for (let y = 1; y <= 11; y++) pts.push([0, y, "dorange"]);
  for (let y = 12; y <= 15; y++) pts.push([0, y, "black"], [1, y, y < 15 ? "black" : "dgreen"]);
  return pts;
}

function makeHead(Rc: number, N: number): Wedge[] {
  const wedges: Wedge[] = Array.from({ length: N }, (_, i) => ({ a: ((i + 0.5) / N) * Math.PI * 2, dots: [], on: 1, gs: 0 }));
  const lim = Math.ceil(Rc * 1.15);
  const pick = (i: number, j: number, d: number): Color => {
    const r = Math.random(), sh = (i * 0.6 + j * 0.75) / Rc;
    if (sh > 0.25 && r < 0.18 + sh * 0.35) return "dorange";
    if (sh < -0.3 && r < 0.25) return r < 0.08 ? "cream" : "lorange";
    if (d < Rc * 0.5 && r < 0.2) return "lorange";
    if (r < 0.05) return "lorange";
    if (d > Rc * 0.85) return r < 0.7 ? "orange" : "lorange";
    return r < 0.88 ? "orange" : "lorange";
  };
  for (let j = -lim; j <= lim; j++) for (let i = -lim; i <= lim; i++) {
    const d = Math.hypot(i, j);
    if (d > Rc * 1.15) continue;
    let a = Math.atan2(j, i);
    if (a < 0) a += Math.PI * 2;
    const f = (a / (Math.PI * 2)) * N, w = Math.floor(f) % N, loc = f - Math.floor(f);
    if (d > Rc) {
      if (loc > 0.3 && loc < 0.7 && Math.random() < 0.6) wedges[w].dots.push([i, j, Math.random() < 0.75 ? "orange" : "lorange", Math.random()]);
      continue;
    }
    if (d > Rc * 0.62 && (loc < 0.07 || loc > 0.95) && Math.random() < 0.7) continue;
    if (d < Rc * 0.9 && Math.random() < Math.pow(d / Rc, 5) * 0.5) continue;
    wedges[w].dots.push([i, j, pick(i, j, d), Math.random()]);
  }
  return wedges;
}

function makeNoise() {
  const S = 64, g = Array.from({ length: S * S }, () => Math.random());
  const at = (x: number, y: number) => g[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  const n = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x: number, y: number) => n(x, y) * 0.55 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.15;
}

function startField(canvas: HTMLCanvasElement): () => void {
  const P = PALETTE;
  const G = DOT_SIZE;
  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, t: 0 };
  let seeds: Seed[] = [];
  let trail: Mote[] = [];
  let acc = 0;
  let nextAmb = 0;
  const seedShape = makeSeedShape();
  let W = 0, H = 0, dpr = 1, C = 0, Rr = 0;
  let flowers: Flower[] = [];
  let low: HTMLCanvasElement, bg: HTMLCanvasElement, overlay: HTMLCanvasElement;

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    C = Math.ceil(W / G);
    Rr = Math.ceil(H / G);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    low = document.createElement("canvas");
    low.width = C;
    low.height = Rr;
    const rows = [
      { n: Math.max(3, Math.round(W / 170)), rp: H * 0.043, hy: 0.71, j: 0.03, base: 0.9 },
      { n: Math.max(2, Math.round(W / 280)), rp: H * 0.068, hy: 0.82, j: 0.03, base: 1.0 },
    ];
    flowers = [];
    for (const row of rows) {
      const n = row.n, sp = W / n, Rc = Math.max(5, Math.round(Math.min(sp * 0.36, row.rp) / G)), baseC = Math.round(Rr * row.base);
      const off = row.base < 1 ? 0.25 : 0.5;
      for (let i = 0; i < n; i++) {
        const R = Rc * G, hy = H * (row.hy + (Math.random() - 0.5) * row.j) + (i % 2 ? R * 0.4 : -R * 0.4);
        const sw = Math.max(2, Math.round(Rc / 8)), leaves: [number, number, Color][] = [], seen = new Set<string>();
        const nL = 4 + ((Math.random() * 4) | 0);
        for (let l = 0; l < nL; l++) {
          const side = Math.random() < 0.5 ? -1 : 1, ang = side * (0.3 + Math.random() * 1.0);
          const len = Rc * (0.6 + Math.random() * 0.9), wmax = Rc * (0.12 + Math.random() * 0.1);
          const bend = side * (Math.random() * 0.9 - 0.15), freq = 0.5 + Math.random() * 0.7, ph = Math.random() * 6.28;
          const ox = side * (sw / 2 + Math.random() * 2), oy = -Math.random() * 3, asym = 0.4 + Math.random() * 0.8;
          for (let t = 0; t < len; t += 0.6) {
            const u = t / len, a = ang + bend * u * u;
            const dx = Math.sin(a), dy = -Math.cos(a), cx = ox + dx * t, cy = oy + dy * t;
            const tooth = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(t * freq + ph)), 0.5) * (0.7 + Math.random() * 0.3);
            const w = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.04)), 0.8) * tooth;
            const qa = -w * asym;
            for (let q = qa; q <= w; q += 0.6) {
              if (Math.random() < 0.08) continue;
              const px = Math.round(cx - dy * q), py = Math.round(cy + dx * q), key = px + "," + py;
              if (seen.has(key)) continue;
              seen.add(key);
              leaves.push([px, py, Math.abs(q) < 0.7 ? "dorange" : q > w - 1 || q < qa + 1 ? "lorange" : Math.random() < 0.6 ? "orange" : "dorange"]);
            }
          }
        }
        flowers.push({
          baseC, bx: sp * (i + off) + (Math.random() - 0.5) * sp * 0.12, hy, Rc, R, sw, ph: Math.random() * 6.28,
          wedges: makeHead(Rc, Rc < 12 ? 18 : 28), leaves, last: 0, regrowing: false,
        });
      }
    }
    const kept = flowers.filter((f) => f.baseC >= Rr);
    for (const b of flowers.filter((f) => f.baseC < Rr)) {
      const hit = (o: Flower) =>
        o.baseC >= Rr ? Math.abs(o.bx - b.bx) < (o.R + b.R) * 1.1 : Math.hypot(o.bx - b.bx, o.hy - b.hy) < (o.R + b.R) * 1.2;
      let ok = !kept.some(hit);
      const x0 = b.bx;
      for (let tr = 1; !ok && tr <= 8; tr++) {
        b.bx = x0 + (tr % 2 ? 1 : -1) * Math.ceil(tr / 2) * b.R * 0.6;
        ok = b.bx > 0 && b.bx < W && !kept.some(hit);
      }
      if (ok) kept.push(b);
    }
    flowers = kept.sort((a, b) => a.baseC - b.baseC);

    const heads = flowers.map((f) => [f.bx / G, f.hy / G, (f.Rc * 1.4) ** 2]);
    const rgb = {} as Record<Color, number[]>;
    for (const k of Object.keys(P) as Color[]) rgb[k] = [1, 3, 5].map((i) => parseInt(P[k].substr(i, 2), 16));
    bg = document.createElement("canvas");
    bg.width = C;
    bg.height = Rr;
    const bx = bg.getContext("2d")!, img = bx.createImageData(C, Rr), D = img.data;
    const nz = makeNoise(), hor = Rr * 0.8;
    for (let y = 0; y < Rr; y++) for (let x = 0; x < C; x++) {
      const r = Math.random();
      let k: Color;
      const hc = hor + (nz(x * 0.009 + 13.7, 11.3) - 0.5) * Rr * 0.08 + (nz(x * 0.04 + 3.3, 2.2) - 0.5) * Rr * 0.025;
      const far = hc - (nz(x * 0.012, 3.1) * 0.9 + 0.1) * Rr * 0.1;
      const near = hc - nz(x * 0.02 + 40, 7.7) * Rr * 0.04 + Rr * 0.03 + (nz(x * 0.026 + 21.1, 5.9) - 0.5) * Rr * 0.03;
      if (y < far) {
        let cl = nz(x * 0.018, y * 0.045 + 9) - (y / hor) * 0.15;
        for (const [hx, hy, r2] of heads) if ((x - hx) ** 2 + (y - hy) ** 2 < r2) cl = 0;
        k = cl > 0.62 ? (r < 0.85 ? "white" : "cream") : cl > 0.57 ? (r < 0.5 ? "white" : r < 0.7 ? "pink" : "sky") : r < 0.1 ? "white" : "sky";
      } else if (y < near) {
        const v = nz(x * 0.05, y * 0.05 + 20);
        k = v > 0.6 ? (r < 0.5 ? "g2" : "g3") : r < 0.6 ? "g1" : r < 0.85 ? "g2" : "g3";
      } else {
        const dep = (y - near) / (Rr - near);
        const tones: [Color, Color][] = [["g1", "g2"], ["g2", "g3"], ["g3", "g5"], ["g5", "g6"]];
        let L = 0, top = near, bot = Rr;
        for (let i = 0; i < 3; i++) {
          const rg = near + ((Rr - near) * (i + 1)) / 4.2 + (nz(x * 0.011 + i * 17.3, i * 3.7 + 1) - 0.5) * Rr * 0.07;
          if (y >= rg) {
            L = i + 1;
            top = rg;
          } else {
            bot = rg;
            break;
          }
        }
        const tt = Math.min(1, (y - top) / Math.max(1, bot - top));
        const [base, dark] = tones[L];
        k = r < tt * 0.65 ? dark : base;
        if (Math.random() < 0.003 + dep * 0.006) k = "g3";
      }
      const o = (y * C + x) * 4, cc = rgb[k];
      D[o] = cc[0];
      D[o + 1] = cc[1];
      D[o + 2] = cc[2];
      D[o + 3] = 255;
    }
    bx.putImageData(img, 0, 0);
    for (let i = 0; i < C * 0.25; i++) {
      const x = (Math.random() * C) | 0, y = (hor + 4 + Math.random() * (Rr - hor)) | 0, h = (2 + Math.random() * 6 * ((y - hor) / (Rr - hor))) | 0;
      bx.fillStyle = P.g2;
      for (let t = 0; t < h; t++) bx.fillRect(x + ((t * 0.3) | 0), y - t, 1, 1);
      if (Math.random() < 0.3) {
        bx.fillStyle = Math.random() < 0.6 ? P.g3 : P.g5;
        bx.fillRect(x - 1, y - h - 1, 2, 2);
      }
    }

    overlay = document.createElement("canvas");
    overlay.width = W * dpr;
    overlay.height = H * dpr;
    const ox = overlay.getContext("2d")!;
    ox.fillStyle = "rgba(255,255,255,0.55)";
    const lw = Math.max(1, Math.round(dpr * 0.9));
    for (let x = 0; x < C; x++) ox.fillRect(Math.round((x + 1) * G * dpr) - lw, 0, lw, H * dpr);
    for (let y = 0; y < Rr; y++) ox.fillRect(0, Math.round((y + 1) * G * dpr) - lw, W * dpr, lw);
  }

  function release(f: Flower, w: Wedge, x: number, y: number, t: number) {
    w.on = 0;
    f.last = t;
    f.regrowing = false;
    let dx = x - mouse.x, dy = y - mouse.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const p = 1.2 + Math.random() * 1.8;
    seeds.push({
      x, y, vx: dx * p + mouse.vx * 0.12 + 0.3, vy: dy * p + mouse.vy * 0.12 - 0.7, rot: w.a + Math.PI / 2,
      life: 0, max: 5000 + Math.random() * 4000, ph: Math.random() * 6.28, s: Math.max(0.45, f.Rc / 26),
    });
  }

  function frame(t: number) {
    if (!flowers.length) return;
    const m = mouse;
    m.vx *= 0.9;
    m.vy *= 0.9;
    const lx = low.getContext("2d")!;
    lx.drawImage(bg, 0, 0);
    const buckets: Partial<Record<Color, number[]>> = {};
    const put = (k: Color, x: number, y: number) => (buckets[k] || (buckets[k] = [])).push(x, y);
    const sbk: Partial<Record<Color, number[]>> = {};
    const putS = (k: Color, x: number, y: number) => (sbk[k] || (sbk[k] = [])).push(x, y);
    for (const f of flowers) {
      const sway = Math.sin(t * 0.0009 + f.ph) * G * 2.2 + Math.sin(t * 0.0023 + f.ph * 2) * G * 0.7;
      const hx = f.bx + sway, hy = f.hy, hcx = Math.round(hx / G), hcy = Math.round(hy / G);
      const top = Math.round(hy / G + f.Rc * 0.2);
      for (let y = top; y < f.baseC; y++) {
        const u = (y - top) / Math.max(1, f.baseC - top), x0 = Math.round((f.bx + sway * (1 - u) * (1 - u)) / G) - (f.sw >> 1);
        for (let k = 0; k < f.sw; k++) putS(k === 0 ? "orange" : "dorange", x0 + k, y);
      }
      const bcx = Math.round(f.bx / G);
      for (const [ax, ay, k] of f.leaves) putS(k, bcx + Math.round(ax), f.baseC - 1 + ay);
      let present = 0;
      for (const w of f.wedges) {
        if (w.on === 0 && f.regrowing && t >= w.gs) w.on = 0.001;
        if (w.on > 0 && w.on < 1) w.on = Math.min(1, (t - w.gs) / 700);
        if (w.on > 0.6) {
          const cx = hx + Math.cos(w.a) * f.R * 0.65, cy = hy + Math.sin(w.a) * f.R * 0.65;
          if (Math.hypot(cx - m.x, cy - m.y) < BLOW_RADIUS) {
            release(f, w, cx, cy, t);
            continue;
          }
        }
        if (w.on <= 0) continue;
        if (w.on >= 1) present++;
        const s = 0.5 + 0.5 * w.on;
        for (const d of w.dots) if (d[3] < w.on) put(d[2], hcx + Math.round(d[0] * s), hcy + Math.round(d[1] * s));
      }
      const miss = 1 - present / f.wedges.length;
      const rc = f.Rc * 0.3;
      for (let j = -Math.ceil(rc); j <= rc; j++) for (let i = -Math.ceil(rc); i <= rc; i++) {
        const d = Math.hypot(i, j);
        if (d > rc) continue;
        const h = ((i * 73856093) ^ (j * 19349663)) & 1023;
        putS(d > rc - 1.2 ? "dgreen" : (h & 7) < 2 ? "dgreen" : (h & 7) < 5 ? "lime" : "cream", hcx + i, hcy + j);
      }
      if (f.regrowing && present === f.wedges.length) f.regrowing = false;
      if (!f.regrowing && miss > 0 && t - f.last > REGROW_MS) {
        f.regrowing = true;
        let k = 0;
        for (const w of f.wedges) if (w.on === 0) w.gs = t + k++ * 45;
      }
    }
    // A few seeds drift off on their own so the field is alive even when idle.
    if (!nextAmb || t > nextAmb) {
      nextAmb = t + 700 + Math.random() * 1300;
      const target = 4 + ((Math.random() * 5) | 0);
      if (seeds.filter((p) => p.amb).length < target) {
        const cand = flowers[(Math.random() * flowers.length) | 0], ws = cand.wedges.filter((w) => w.on >= 1 && Math.sin(w.a) < 0.3);
        if (ws.length) {
          const w = ws[(Math.random() * ws.length) | 0], sway = Math.sin(t * 0.0009 + cand.ph) * G * 2.2;
          const x = cand.bx + sway + Math.cos(w.a) * cand.R * 0.65, y = cand.hy + Math.sin(w.a) * cand.R * 0.65;
          w.on = 0;
          cand.last = t;
          cand.regrowing = false;
          seeds.push({
            amb: true, x, y, vx: 0.4 + Math.random() * 0.7, vy: -0.4 - Math.random() * 0.6, rot: w.a + Math.PI / 2,
            life: 0, max: 7000 + Math.random() * 4000, ph: Math.random() * 6.28, s: Math.max(0.45, cand.Rc / 26),
          });
        }
      }
    }
    const alive: Seed[] = [];
    for (const p of seeds) {
      p.life += 16;
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
      if (d < BLOW_RADIUS && d > 0) {
        const k = (1 - d / BLOW_RADIUS) * 0.5;
        p.vx += (dx / d) * k + m.vx * 0.02;
        p.vy += (dy / d) * k + m.vy * 0.02;
      }
      p.vx = p.vx * 0.975 + 0.03;
      p.vy = p.vy * 0.975 - 0.022;
      p.x += p.vx + Math.sin(t * 0.0015 + p.ph) * 0.3;
      p.y += p.vy + Math.cos(t * 0.0012 + p.ph) * 0.2;
      p.rot += (0.6 + Math.sin(t * 0.002 + p.ph) * 0.25 - p.rot) * 0.02;
      const u = p.life / p.max;
      if (u >= 1 || p.x > W + 80 || p.y < -80) continue;
      alive.push(p);
      const keep = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25, cs = Math.cos(p.rot) * p.s, sn = Math.sin(p.rot) * p.s, px = p.x / G, py = p.y / G;
      for (let q = 0; q < seedShape.length; q++) {
        if (keep < 1 && ((q * 2654435761) % 1000) / 1000 > keep) continue;
        const [i, j, k] = seedShape[q];
        put(k, Math.round(px + i * cs - j * sn), Math.round(py + i * sn + j * cs));
      }
    }
    seeds = alive.slice(-1500);
    trail = trail.filter((p) => {
      p.life += 16;
      if (p.life >= p.max) return false;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 - 0.01;
      const u = p.life / p.max;
      if (u < 0.65 || ((p.life / 16) | 0) % 2 === 0) {
        const cx = Math.round(p.x / G), cy = Math.round(p.y / G);
        put(p.c, cx, cy);
        if (u < 0.4) put(p.c, cx + 1, cy);
      }
      return true;
    });
    for (const groups of [sbk, buckets]) {
      for (const k of Object.keys(groups) as Color[]) {
        const b = groups[k]!;
        lx.fillStyle = P[k];
        lx.beginPath();
        for (let i = 0; i < b.length; i += 2) lx.rect(b[i], b[i + 1], 1, 1);
        lx.fill();
      }
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, C * G * dpr, Rr * G * dpr);
    ctx.drawImage(overlay, 0, 0);
  }

  const onMove = (e: MouseEvent | TouchEvent) => {
    const p = "touches" in e ? e.touches[0] : e;
    if (!p) return;
    const now = performance.now(), m = mouse;
    if (m.x > -9000) {
      const dt = Math.max(16, now - m.t), ddx = p.clientX - m.x, ddy = p.clientY - m.y;
      m.vx = (ddx / dt) * 16;
      m.vy = (ddy / dt) * 16;
      acc += Math.hypot(ddx, ddy);
      while (acc > 10) {
        acc -= 10;
        trail.push({
          x: p.clientX - ddx * Math.random() + (Math.random() - 0.5) * 10, y: p.clientY - ddy * Math.random() + (Math.random() - 0.5) * 10,
          vx: m.vx * 0.06 + (Math.random() - 0.5) * 0.4, vy: m.vy * 0.06 - 0.2, life: 0, max: 400 + Math.random() * 200,
          c: Math.random() < 0.55 ? "dorange" : "orange",
        });
      }
      if (trail.length > 10) trail.splice(0, trail.length - 10);
    }
    m.x = p.clientX;
    m.y = p.clientY;
    m.t = now;
  };
  const onLeave = () => {
    mouse.x = mouse.y = -9999;
  };
  const evs: [string, EventListener][] = [
    ["mousemove", onMove as EventListener],
    ["touchmove", onMove as EventListener],
    ["mouseleave", onLeave],
    ["touchend", onLeave],
    ["resize", layout],
  ];
  evs.forEach(([e, f]) => window.addEventListener(e, f, { passive: true }));
  layout();
  let raf = 0;
  const loop = (t: number) => {
    frame(t);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    evs.forEach(([e, f]) => window.removeEventListener(e, f));
  };
}

export function DandelionField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? startField(ref.current) : undefined), []);
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, background: PALETTE.sky }}>
      <canvas
        ref={ref}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
      />
    </div>
  );
}
