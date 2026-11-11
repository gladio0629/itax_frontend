import { memo, useId, useMemo } from "react";
import type { DeliveryVehicle } from "@/api/types";

/**
 * Delivery vehicles as small 3D "toy models", seen from a high front-quarter
 * angle (camera 22° round from the side, 30° above), cargo space opened up.
 *
 * Rather than CSS 3D transforms (which don't apply reliably to elements
 * inside an <svg>), each vehicle is built from real 3D solids in centimetres
 * and projected with a fixed parallel (isometric-style) camera:
 *  - x runs rear → front, y far side → near side, z up; ground is z = 0.
 *  - Solids are extruded side profiles; faces turned away from the camera
 *    are culled, and every visible face is shaded from one light, so tops are
 *    lighter, fronts mid, near sides darker — on sloped windscreens too.
 *  - Draw order: structure in a fixed order (far wheels, chassis, floor,
 *    far/rear walls), then the load sorted by distance, then front wall,
 *    near rail, cab and near wheels. Each multi-part item sorts as one unit.
 *  - Dimension arrows and labels are drawn afterwards in card space, so
 *    they're the same size on all six; colours are fixed (light card).
 */

type V3 = [number, number, number];
type Pt = [number, number];

const TH = (22 * Math.PI) / 180;
const PH = (30 * Math.PI) / 180;
const [sT, cT, sP, cP] = [Math.sin(TH), Math.cos(TH), Math.sin(PH), Math.cos(PH)];
const VIEW: V3 = [sT * cP, cT * cP, sP];
const LIGHT: V3 = norm([0.45, 0.2, 0.87]);

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const proj = ([x, y, z]: V3): Pt => [x * cT - y * sT, (x * sT + y * cT) * sP - z * cP];
const nearness = ([x, y, z]: V3) => (x * sT + y * cT) * cP + z * sP;

// ── colour ────────────────────────────────────────────────────────────────
function mix(hex: string, to: string, t: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
/** Lambert-ish: faces toward the light lighten, away darken. */
function shade(hex: string, n: V3): string {
  const f = dot(n, LIGHT) - 0.45;
  return f > 0 ? mix(hex, "#ffffff", f * 0.55) : mix(hex, "#000000", -f * 0.5);
}

const C = {
  body: "#F6BF0E",
  navy: "#264A9F",
  glassHi: "#7E9BDA",
  chassis: "#2C3550",
  inner: "#F1E6CF",
  floor: "#D9C49C",
  box: "#D7A266",
  tape: "#F0D3A2",
  fridge: "#F3F5F9",
  sofa: "#E4572E",
  wood: "#B98552",
  tire: "#1E2433",
  hub: "#CDD5E4",
  white: "#FFFFFF",
  dim: "#16264D",
};

// ── geometry ──────────────────────────────────────────────────────────────
type Face = { pts: V3[]; fill: string; grad?: boolean };
type Part = { faces: Face[]; key: number };

/**
 * Extrude an (x, z) profile (counter-clockwise) between y0 and y1.
 * `base` may pick a colour per face normal (e.g. inner walls) before shading;
 * `edge` overrides the colour of one extruded edge face (a glazed windscreen).
 */
function extrude(profile: Pt[], y0: number, y1: number, base: string | ((n: V3) => string), opts: { grad?: boolean; edge?: Record<number, string> } = {}): Face[] {
  const col = (n: V3, i?: number) => {
    const b = i !== undefined && opts.edge?.[i] ? opts.edge[i] : typeof base === "string" ? base : base(n);
    return shade(b, n);
  };
  const faces: Face[] = [];
  const near: V3 = [0, 1, 0];
  if (dot(near, VIEW) > 0) faces.push({ pts: profile.map(([x, z]) => [x, y1, z] as V3), fill: col(near), grad: opts.grad });
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i];
    const b = profile[(i + 1) % profile.length];
    const n = norm([b[1] - a[1], 0, -(b[0] - a[0])]);
    if (dot(n, VIEW) <= 1e-6) continue;
    faces.push({ pts: [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], fill: col(n, i) });
  }
  return faces;
}
const cuboid = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, base: string | ((n: V3) => string), grad = false) =>
  extrude([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, base, { grad });

const centroid = (faces: Face[]): V3 => {
  const all = faces.flatMap((f) => f.pts);
  return [0, 1, 2].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length) as V3;
};
const part = (faces: Face[], key?: number): Part => ({ faces, key: key ?? nearness(centroid(faces)) });
/** A flat decal slightly off a surface (windows, lights, tape). */
const decal = (pts: V3[], fill: string): Face => ({ pts, fill });

function ellipse(cx: number, cz: number, y: number, r: number, n = 28): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(t), y, cz + r * Math.sin(t)] as V3;
  });
}

// ── items ─────────────────────────────────────────────────────────────────
type Inner = { x0: number; x1: number; y0: number; y1: number; z: number; h: number };

function box(x: number, y: number, z: number, l: number, w: number, h: number): Part {
  const faces = cuboid(x, x + l, y, y + w, z, z + h, C.box);
  const tz = z + h + 0.4;
  faces.push(decal([[x, y + w / 2 - 5, tz], [x + l, y + w / 2 - 5, tz], [x + l, y + w / 2 + 5, tz], [x, y + w / 2 + 5, tz]], shade(C.tape, [0, 0, 1])));
  const fx = x + l + 0.4;
  faces.push(decal([[fx, y + w / 2 - 5, z + h], [fx, y + w / 2 + 5, z + h], [fx, y + w / 2 + 5, z + h * 0.55], [fx, y + w / 2 - 5, z + h * 0.55]], shade(C.tape, [1, 0, 0])));
  return part(faces);
}
function fridge(x: number, y: number, z: number, h: number): Part {
  const [l, w] = [70, 68];
  const faces = cuboid(x, x + l, y, y + w, z, z + h, C.fridge);
  const yf = y + w + 0.5;
  faces.push(decal([[x + 3, yf, z + h * 0.62], [x + l - 3, yf, z + h * 0.62], [x + l - 3, yf, z + h * 0.6], [x + 3, yf, z + h * 0.6]], "#9AA6BF"));
  faces.push(decal([[x + l - 12, yf, z + h * 0.9], [x + l - 8, yf, z + h * 0.9], [x + l - 8, yf, z + h * 0.68], [x + l - 12, yf, z + h * 0.68]], "#8592AE"));
  faces.push(decal([[x + l - 12, yf, z + h * 0.56], [x + l - 8, yf, z + h * 0.56], [x + l - 8, yf, z + h * 0.3], [x + l - 12, yf, z + h * 0.3]], "#8592AE"));
  return part(faces);
}
function sofa(x: number, y: number, z: number): Part {
  const [l, w] = [190, 85];
  // one unit: back, near-rear arm, seat, cushions, front arm — far → near inside the part
  const faces = [
    ...cuboid(x, x + l, y, y + 22, z, z + 80, C.sofa),
    ...cuboid(x, x + 18, y, y + w, z, z + 58, C.sofa),
    ...cuboid(x + 18, x + l - 18, y + 22, y + w, z, z + 40, C.sofa),
    ...cuboid(x + 20, x + l / 2 - 1, y + 24, y + w - 2, z + 40, z + 48, mix(C.sofa, "#ffffff", 0.12)),
    ...cuboid(x + l / 2 + 1, x + l - 20, y + 24, y + w - 2, z + 40, z + 48, mix(C.sofa, "#ffffff", 0.12)),
    ...cuboid(x + l - 18, x + l, y, y + w, z, z + 58, C.sofa),
  ];
  return part(faces, nearness([x + l / 2, y + w / 2, z + 40]));
}
function wardrobe(x: number, y: number, z: number, h: number): Part {
  const [l, w] = [110, 60];
  const faces = cuboid(x, x + l, y, y + w, z, z + h, C.wood);
  const yf = y + w + 0.5;
  faces.push(decal([[x + l / 2 - 0.8, yf, z + h - 4], [x + l / 2 + 0.8, yf, z + h - 4], [x + l / 2 + 0.8, yf, z + 6], [x + l / 2 - 0.8, yf, z + 6]], "#6E4825"));
  for (const dx of [-8, 5]) faces.push(decal(ellipse(x + l / 2 + dx + 1.5, z + h / 2, yf, 2.6, 10), "#6E4825"));
  return part(faces);
}

function layoutLoad(inn: Inner, opts: { maxStack?: number; fill?: number } = {}): Part[] {
  const parts: Part[] = [];
  const len = inn.x1 - inn.x0;
  const maxStack = opts.maxStack ?? Math.max(1, Math.floor((inn.h - 6) / 46));
  let cx = inn.x0 + 4;
  const fy = inn.y0 + 2;
  let frontEnd = cx; // floor in front of tall furniture gets low boxes; the sofa stays clear
  if (len >= 600) {
    parts.push(wardrobe(cx, fy, inn.z, Math.min(210, inn.h - 12)));
    cx += 118;
  }
  if (len >= 400) {
    parts.push(fridge(cx, fy, inn.z, Math.min(180, inn.h - 12)));
    cx += 78;
    frontEnd = cx;
    parts.push(sofa(cx, fy, inn.z));
    cx += 198;
  }
  const grid = (ax: number, bx: number, ay: number, by: number, stack: number) => {
    const cols = Math.floor((bx - ax) / 54);
    const rows = Math.floor((by - ay) / 54);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const n = Math.max(1, stack - ((c * 7 + r * 3) % 4 === 0 ? 1 : 0) - (r === rows - 1 && c % 2 ? 1 : 0));
        for (let k = 0; k < n; k++) parts.push(box(ax + c * 54, ay + r * 54, inn.z + k * 46, 50, 50, 44));
      }
    }
  };
  // low boxes in front of the furniture, then the full-depth grid
  if (frontEnd > inn.x0 + 4) grid(inn.x0 + 4, frontEnd, inn.y0 + 92, inn.y1 - 2, Math.min(2, maxStack));
  const gridEnd = cx + (inn.x1 - cx) * (opts.fill ?? 1);
  grid(cx, gridEnd, inn.y0 + 2, inn.y1 - 2, maxStack);
  // a smaller parcel on top where a single row leaves headroom (Spark)
  if (maxStack === 1 && inn.h - 44 >= 34 && len < 300) parts.push(box(inn.x0 + 60, inn.y0 + 14, inn.z + 44, 36, 30, 30));
  return parts.sort((a, b) => a.key - b.key);
}

// ── vehicles ──────────────────────────────────────────────────────────────
type Built = { parts: Part[]; farWheels: V3[][]; wheels: { cx: number; cz: number; r: number; y: number }[]; inner: Inner; wallTop: number; loadTop: number };

const wheelSet = (xs: number[], r: number, W: number) => xs.map((cx) => ({ cx, cz: r, r, y: W }));

/** Cab: lower block + glazed upper, extruded across the full width. */
function cab(x0: number, x1: number, W: number, base: number, belt: number, roofEnd: number, roof: number, hood: number, wsX = x1 - 12): Part[] {
  // lower: nose up to the hood, hood rising to the windscreen base (wsX, belt)
  const lower = extrude([[x0, base], [x1, base], [x1, hood], [wsX, belt], [x0, belt]], 0, W, C.body, { grad: true });
  // upper: edge index 1 is the windscreen → glazed navy
  const upper = extrude([[x0, belt], [wsX, belt], [roofEnd, roof], [x0, roof]], 0, W, C.body, { edge: { 1: C.navy }, grad: true });
  const yn = W + 0.5;
  const side = decal([[x0 + 10, yn, belt + 8], [wsX - 10, yn, belt + 8], [roofEnd - 6, yn, roof - 10], [x0 + 10, yn, roof - 10]], shade(C.navy, [0, 1, 0]));
  const shine = decal([[x0 + 14, yn + 0.2, belt + 10], [x0 + 30, yn + 0.2, belt + 10], [x0 + 46, yn + 0.2, roof - 12], [x0 + 30, yn + 0.2, roof - 12]], C.glassHi);
  const xf = x1 + 0.6;
  const lightH = Math.min(14, (hood - base) * 0.25);
  const lights = [
    decal([[xf, W - 26, hood - 6], [xf, W - 8, hood - 6], [xf, W - 8, hood - 6 - lightH], [xf, W - 26, hood - 6 - lightH]], C.white),
    decal([[xf, 8, hood - 6], [xf, 26, hood - 6], [xf, 26, hood - 6 - lightH], [xf, 8, hood - 6 - lightH]], C.white),
  ];
  const bumper = cuboid(x1 - 4, x1 + 6, 4, W - 4, base, base + Math.max(10, (hood - base) * 0.22), C.navy);
  return [part([...lower, ...lights], 9e5), part([...upper, side, shine], 9e5 + 1), part(bumper, 9e5 + 2)];
}

/** Cargo space with the near wall cut down and the roof off. */
function openBox(o: { x0: number; x1: number; W: number; floorZ: number; floorBase: number; t: number; wallH: number; nearH: number; frontH?: number }) {
  const { x0, x1, W, floorZ, floorBase, t, wallH, nearH } = o;
  const top = floorZ + wallH;
  const innerCol = (n: V3) => (n[1] > 0.5 || n[0] > 0.5 ? C.inner : C.body);
  return {
    floor: part(cuboid(x0, x1, 0, W, floorBase, floorZ, (n) => (n[2] > 0.5 ? C.floor : C.body)), -8e5),
    far: part(cuboid(x0, x1, 0, t, floorZ, top, innerCol, true), -7e5),
    rear: part(cuboid(x0, x0 + t, t, W, floorZ, floorZ + Math.min(wallH, Math.max(nearH, wallH * 0.85)), innerCol), -6e5),
    front: part(cuboid(x1 - t, x1, t, W, floorZ, floorZ + (o.frontH ?? wallH), C.body, true), 8e5),
    near: part(cuboid(x0, x1, W - t, W, floorZ, floorZ + nearH, C.body, true), 8e5 + 1),
    top,
  };
}

function build(v: DeliveryVehicle): Built {
  switch (v) {
    case "spark": {
      const W = 160;
      const ob = openBox({ x0: 0, x1: 196, W, floorZ: 48, floorBase: 22, t: 6, wallH: 92, nearH: 46 });
      const inner: Inner = { x0: 10, x1: 180, y0: 30, y1: 130, z: 48, h: 90 };
      return {
        parts: [ob.floor, ob.far, ob.rear, ...layoutLoad(inner), ob.near, ...cab(196, 360, W, 22, 106, 236, 150, 86, 284)],
        farWheels: [ellipse(72, 28, 0, 28), ellipse(292, 28, 0, 28)],
        wheels: wheelSet([72, 292], 28, W),
        inner,
        wallTop: ob.top,
        loadTop: inner.z + 90,
      };
    }
    case "damas": {
      const W = 150;
      const ob = openBox({ x0: 0, x1: 244, W, floorZ: 46, floorBase: 20, t: 6, wallH: 136, nearH: 44 });
      const inner: Inner = { x0: 10, x1: 230, y0: 10, y1: 140, z: 46, h: 130 };
      return {
        parts: [ob.floor, ob.far, ob.rear, ...layoutLoad(inner), ob.near, ...cab(244, 340, W, 20, 104, 300, 186, 96, 332)],
        farWheels: [ellipse(58, 25, 0, 25), ellipse(292, 25, 0, 25)],
        wheels: wheelSet([58, 292], 25, W),
        inner,
        wallTop: ob.top,
        loadTop: inner.z + 130,
      };
    }
    case "labo": {
      const W = 170;
      const ob = openBox({ x0: 0, x1: 282, W, floorZ: 56, floorBase: 50, t: 5, wallH: 50, nearH: 50 });
      const inner: Inner = { x0: 5, x1: 277, y0: 5, y1: 165, z: 56, h: 50 };
      const chassis = part(cuboid(0, 372, 20, W - 20, 30, 50, C.chassis), -9e5);
      return {
        parts: [chassis, ob.floor, ob.far, ob.rear, ...layoutLoad(inner, { maxStack: 2 }), ob.front, ob.near, ...cab(286, 372, W, 30, 112, 344, 178, 100)],
        farWheels: [ellipse(64, 25, 0, 25), ellipse(326, 25, 0, 25)],
        wheels: wheelSet([64, 326], 25, W),
        inner,
        wallTop: ob.top,
        loadTop: inner.z + 92,
      };
    }
    case "isuzu":
    case "isuzu2":
    case "fura": {
      const cfg = {
        isuzu: { W: 216, t: 8, len: 436, floor: 96, h: 200, chassis: [0, 600, 50, 96], cabX: [446, 600], cab: [50, 156, 552, 276, 140], wheels: [92, 520], r: 40 },
        isuzu2: { W: 258, t: 9, len: 618, floor: 108, h: 240, chassis: [0, 800, 54, 108], cabX: [628, 800], cab: [54, 168, 746, 300, 150], wheels: [100, 200, 712], r: 44 },
        fura: { W: 280, t: 10, len: 860, floor: 128, h: 240, chassis: [0, 860, 100, 128], cabX: [900, 1130], cab: [60, 190, 1050, 356, 170], wheels: [86, 190, 294, 930, 1080], r: 46 },
      }[v];
      const { W, t, len, floor, h, r } = cfg;
      const ob = openBox({ x0: 0, x1: len, W, floorZ: floor, floorBase: floor - 8, t, wallH: h + t, nearH: 22 });
      const inner: Inner = { x0: t, x1: len - t, y0: t, y1: W - t, z: floor, h };
      const [c0, c1, cz0, cz1] = cfg.chassis;
      const extra: Part[] = [part(cuboid(c0, c1, 24, W - 24, cz0, cz1, C.chassis), -9e5)];
      if (v === "fura") {
        extra.push(part(cuboid(840, 1130, 30, W - 30, 60, 100, C.chassis), -9e5 + 1));
        extra.push(part(cuboid(612, 626, W / 2 - 40, W / 2 + 40, 20, 100, C.chassis), -9e5 + 2));
      }
      const [cb, belt, roofEnd, roof, hood] = cfg.cab;
      const load = layoutLoad(inner, { fill: v === "fura" ? 0.55 : 1 });
      const loadTop = Math.max(...load.flatMap((p) => p.faces.flatMap((f) => f.pts.map((q) => q[2]))));
      return {
        parts: [...extra, ob.floor, ob.far, ob.rear, ...load, ob.front, ob.near, ...cab(cfg.cabX[0], cfg.cabX[1], W, cb, belt, roofEnd, roof, hood)],
        farWheels: cfg.wheels.map((x) => ellipse(x, r, 0, r)),
        wheels: wheelSet(cfg.wheels, r, W),
        inner,
        wallTop: ob.top,
        loadTop,
      };
    }
  }
}

// ── card space ────────────────────────────────────────────────────────────
const VB_W = 320;
const VB_H = 200;
const MX = 22;
const TOPM = 30;
const BOTM = 14;

type Drawn = {
  polys: { d: string; fill: string; grad?: boolean }[];
  shadow: string;
  dims: { w: [Pt, Pt]; h: [Pt, Pt]; d: [Pt, Pt] };
};

function render(v: DeliveryVehicle): Drawn {
  const b = build(v);
  const W = b.wheels[0].y;
  const L = Math.max(...b.parts.flatMap((p) => p.faces.flatMap((f) => f.pts.map((q) => q[0]))));
  const foot: V3[] = [[-14, -14, 0], [L + 14, -14, 0], [L + 14, W + 14, 0], [-14, W + 14, 0]];
  const all = [...b.parts.flatMap((p) => p.faces.flatMap((f) => f.pts)), ...foot].map(proj);
  const [minX, maxX] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
  const [minY, maxY] = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
  const s = Math.min((VB_W - 2 * MX) / (maxX - minX), (VB_H - TOPM - BOTM) / (maxY - minY));
  const tx = (VB_W - (maxX - minX) * s) / 2 - minX * s;
  const ty = VB_H - BOTM - maxY * s;
  const S = (p: V3): Pt => {
    const [x, y] = proj(p);
    return [tx + x * s, ty + y * s];
  };
  const path = (pts: V3[]) => "M" + pts.map((p) => S(p).map((n) => n.toFixed(1)).join(" ")).join("L") + "Z";

  const polys: Drawn["polys"] = [];
  // far-side wheels peek under the body
  for (const e of b.farWheels) polys.push({ d: path(e), fill: "#151A26" });
  for (const p of [...b.parts].sort((a, c) => a.key - c.key)) for (const f of p.faces) polys.push({ d: path(f.pts), fill: f.fill, grad: f.grad });
  // near wheels: arch, tyre thickness, tyre, hub
  for (const w of b.wheels) {
    polys.push({ d: path(ellipse(w.cx, w.cz, w.y + 0.3, w.r + 5)), fill: C.navy });
    polys.push({ d: path(ellipse(w.cx, w.cz, w.y - 14, w.r)), fill: "#11151F" });
    polys.push({ d: path(ellipse(w.cx, w.cz, w.y + 2, w.r)), fill: C.tire });
    polys.push({ d: path(ellipse(w.cx, w.cz, w.y + 2.4, w.r * 0.52)), fill: C.hub });
    polys.push({ d: path(ellipse(w.cx, w.cz, w.y + 2.6, w.r * 0.2)), fill: C.navy });
  }
  const { inner } = b;
  const topZ = inner.z + inner.h;
  return {
    polys,
    shadow: path(foot),
    dims: {
      // width along the far top edge, depth along the rear top edge, height up the rear-near corner
      w: [S([inner.x0, inner.y0, Math.max(b.wallTop, b.loadTop)]), S([inner.x1, inner.y0, Math.max(b.wallTop, b.loadTop)])],
      d: [S([inner.x0, inner.y0, topZ]), S([inner.x0, inner.y1, topZ])],
      h: [S([inner.x0, inner.y1, inner.z]), S([inner.x0, inner.y1, topZ])],
    },
  };
}

// ── dimension graphics (card space) ───────────────────────────────────────
function offset([a, b]: [Pt, Pt], px: number, side: 1 | -1): [Pt, Pt] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [(-dy / l) * side, (dx / l) * side];
  return [
    [a[0] + nx * px, a[1] + ny * px],
    [b[0] + nx * px, b[1] + ny * px],
  ];
}
function Arrow({ seg }: { seg: [Pt, Pt] }) {
  const [[x1, y1], [x2, y2]] = seg;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = (x: number, y: number, a: number) => {
    const s = 4.5;
    return `M${x} ${y}L${x - s * Math.cos(a - 0.45)} ${y - s * Math.sin(a - 0.45)}L${x - s * Math.cos(a + 0.45)} ${y - s * Math.sin(a + 0.45)}Z`;
  };
  return (
    <g opacity="0.85">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.dim} strokeWidth="1" />
      <path d={head(x2, y2, ang)} fill={C.dim} />
      <path d={head(x1, y1, ang + Math.PI)} fill={C.dim} />
    </g>
  );
}
function Label({ at, text }: { at: Pt; text: string }) {
  const w = text.length * 5.6 + 10;
  const rx = Math.min(VB_W - w - 4, Math.max(4, at[0] - w / 2));
  const ry = Math.min(VB_H - 20, Math.max(4, at[1] - 8));
  return (
    <g>
      <rect x={rx} y={ry} width={w} height="16" rx="8" fill="#FFFFFF" opacity="0.94" />
      <text x={rx + w / 2} y={ry + 11.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={C.dim} fontFamily="inherit" style={{ fontVariantNumeric: "tabular-nums" }}>
        {text}
      </text>
    </g>
  );
}
const mid = ([a, b]: [Pt, Pt], push: Pt = [0, 0]): Pt => [(a[0] + b[0]) / 2 + push[0], (a[1] + b[1]) / 2 + push[1]];

// Geometry is pure per vehicle: build once, reuse across renders and instances.
const CACHE = new Map<DeliveryVehicle, Drawn>();
const drawnFor = (v: DeliveryVehicle) => {
  let d = CACHE.get(v);
  if (!d) CACHE.set(v, (d = render(v)));
  return d;
};

export const VehicleIllustration = memo(function VehicleIllustration({
  vehicle,
  dims,
  unit,
  className,
}: {
  vehicle: DeliveryVehicle;
  dims: { width: number; depth: number; height: number };
  unit: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const g = useMemo(() => drawnFor(vehicle), [vehicle]);
  const wSeg = offset(g.dims.w, 12, -1);
  const dSeg = offset(g.dims.d, 12, 1);
  const hSeg = offset(g.dims.h, 12, -1);
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={className} aria-hidden="true" focusable="false">
      <defs>
        <filter id={`sh-${id}`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        {/* soft top-to-bottom sheen on large body faces */}
        <linearGradient id={`gr-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#5a3c00" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <path d={g.shadow} fill="rgba(70, 45, 10, 0.32)" filter={`url(#sh-${id})`} />
      {g.polys.map((p, i) => (
        <g key={i}>
          <path d={p.d} fill={p.fill} stroke={p.fill} strokeWidth="0.6" strokeLinejoin="round" />
          {p.grad && <path d={p.d} fill={`url(#gr-${id})`} />}
        </g>
      ))}

      {/* dimension arrows, angled with the model */}
      <Arrow seg={wSeg} />
      <Label at={mid(wSeg, [0, -9])} text={`${dims.width} ${unit}`} />
      <Arrow seg={dSeg} />
      <Label at={mid(dSeg, [-26, -4])} text={`${dims.depth} ${unit}`} />
      <Arrow seg={hSeg} />
      <Label at={mid(hSeg, [-24, 0])} text={`${dims.height} ${unit}`} />
    </svg>
  );
});
