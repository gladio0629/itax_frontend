import { useId } from "react";
import type { ReactNode } from "react";
import type { DeliveryVehicle } from "@/api/types";

/**
 * Delivery vehicle illustrations: side view, cargo space opened up to show
 * what fits, with technical-drawing dimension arrows.
 *
 * - Vehicles are drawn in real centimetres (ground at y=0, up is negative), so
 *   a 50 cm box is the same physical size in every vehicle and reads smaller in
 *   the bigger trucks — that's the sense of scale.
 * - Each vehicle is fitted into the card; dimension arrows and labels are drawn
 *   afterwards in the card's own coordinates, so they're the same size on all six.
 * - Colours are fixed (not theme tokens): the card stays light in dark mode.
 */

const C = {
  yellow: "#F6BF0E",
  yellowShade: "#D9A20A",
  yellowLight: "#FFD95C",
  navy: "#16264D",
  glass: "#2B4A8C",
  glassShine: "#9DB7EC",
  tire: "#1B2233",
  hub: "#C9D2E3",
  chassis: "#2A3550",
  backWall: "#F4EBD8",
  sideWall: "#E5D6B8",
  floor: "#D6C29C",
  box: "#D9A066",
  boxTop: "#EBBE86",
  boxEdge: "#9A6A3A",
  tape: "#F2D6A6",
  shadow: "rgba(120, 80, 20, 0.16)",
  dim: "#16264D",
};

type Cargo = { x: number; floor: number; w: number; h: number; d: number };
type Spec = {
  len: number;
  top: number; // highest point (negative)
  cargo: Cargo;
  /** Open-top bed (pickup): no cutaway, items rise above a low wall. */
  openBed?: boolean;
  wheels: { cx: number; r: number }[];
  shell: (clip: string) => ReactNode;
};

const outline = { stroke: C.navy, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };

function Body({ d, clip, shadeFrom }: { d: string; clip: string; shadeFrom: number }) {
  return (
    <>
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={C.yellow} />
      <g clipPath={`url(#${clip})`}>
        <rect x="-50" y="-600" width="1400" height="520" fill={C.yellowLight} opacity="0.35" />
        <rect x="-50" y={shadeFrom} width="1400" height="200" fill={C.yellowShade} opacity="0.55" />
      </g>
      <path d={d} fill="none" {...outline} />
    </>
  );
}

function Glass({ d }: { d: string }) {
  return (
    <>
      <path d={d} fill={C.glass} {...outline} />
      <path d={d} fill={C.glassShine} opacity="0.28" clipPath="inset(0 55% 0 0)" />
    </>
  );
}

const BODY_PATHS: Partial<Record<DeliveryVehicle, string>> = {
  spark: "M0 -26 L0 -108 Q1 -120 14 -126 L50 -146 Q60 -153 74 -153 L212 -153 Q226 -153 234 -143 L266 -108 L328 -100 Q356 -96 360 -80 L360 -26 Q360 -18 352 -18 L8 -18 Q0 -18 0 -26 Z",
  damas: "M0 -24 L0 -178 Q0 -190 12 -190 L268 -190 Q284 -190 291 -176 L322 -112 L334 -105 Q340 -100 340 -88 L340 -24 Q340 -16 332 -16 L8 -16 Q0 -16 0 -24 Z",
};

const SPECS: Record<DeliveryVehicle, Spec> = {
  spark: {
    len: 360,
    top: -153,
    cargo: { x: 10, floor: -56, w: 170, h: 90, d: 100 },
    wheels: [{ cx: 72, r: 28 }, { cx: 292, r: 28 }],
    shell: (clip) => {
      const d = "M0 -26 L0 -108 Q1 -120 14 -126 L50 -146 Q60 -153 74 -153 L212 -153 Q226 -153 234 -143 L266 -108 L328 -100 Q356 -96 360 -80 L360 -26 Q360 -18 352 -18 L8 -18 Q0 -18 0 -26 Z";
      return (
        <>
          <Body d={d} clip={clip} shadeFrom={-58} />
          <Glass d="M190 -143 L229 -143 L257 -110 L190 -110 Z" />
          <path d="M188 -108 V-30" fill="none" {...outline} opacity="0.5" />
          <rect x="198" y="-96" width="16" height="4" rx="2" fill={C.navy} opacity="0.6" />
          <rect x="348" y="-92" width="11" height="8" rx="2" fill="#fff" {...outline} />
        </>
      );
    },
  },
  damas: {
    len: 340,
    top: -190,
    cargo: { x: 10, floor: -48, w: 220, h: 130, d: 130 },
    wheels: [{ cx: 58, r: 25 }, { cx: 292, r: 25 }],
    shell: (clip) => {
      const d = "M0 -24 L0 -178 Q0 -190 12 -190 L268 -190 Q284 -190 291 -176 L322 -112 L334 -105 Q340 -100 340 -88 L340 -24 Q340 -16 332 -16 L8 -16 Q0 -16 0 -24 Z";
      return (
        <>
          <Body d={d} clip={clip} shadeFrom={-50} />
          <Glass d="M242 -178 L282 -178 L304 -126 L242 -126 Z" />
          <rect x="252" y="-112" width="16" height="4" rx="2" fill={C.navy} opacity="0.6" />
          <rect x="329" y="-98" width="10" height="8" rx="2" fill="#fff" {...outline} />
        </>
      );
    },
  },
  labo: {
    len: 372,
    top: -178,
    cargo: { x: 0, floor: -56, w: 282, h: 50, d: 160 },
    openBed: true,
    wheels: [{ cx: 64, r: 25 }, { cx: 326, r: 25 }],
    shell: (clip) => {
      const d = "M286 -36 L286 -170 Q286 -178 294 -178 L330 -178 Q340 -178 345 -168 L366 -118 Q372 -110 372 -100 L372 -36 Q372 -30 366 -30 L292 -30 Q286 -30 286 -36 Z";
      return (
        <>
          <rect x="0" y="-56" width="372" height="26" rx="4" fill={C.chassis} />
          <Body d={d} clip={clip} shadeFrom={-60} />
          <Glass d="M293 -170 L329 -170 L350 -122 L293 -122 Z" />
          <rect x="361" y="-104" width="10" height="8" rx="2" fill="#fff" {...outline} />
        </>
      );
    },
  },
  isuzu: {
    len: 600,
    top: -304,
    cargo: { x: 8, floor: -96, w: 420, h: 200, d: 200 },
    wheels: [{ cx: 92, r: 40 }, { cx: 520, r: 40 }],
    shell: (clip) => {
      const d = "M446 -50 L446 -262 Q446 -276 460 -276 L540 -276 Q556 -276 563 -262 L594 -160 Q600 -150 600 -136 L600 -50 Z";
      return (
        <>
          <rect x="0" y="-96" width="600" height="46" rx="5" fill={C.chassis} />
          <Body d={d} clip={clip} shadeFrom={-100} />
          <Glass d="M456 -266 L540 -266 L566 -180 L456 -180 Z" />
          <rect x="588" y="-128" width="12" height="12" rx="2" fill="#fff" {...outline} />
        </>
      );
    },
  },
  isuzu2: {
    len: 800,
    top: -357,
    cargo: { x: 9, floor: -108, w: 600, h: 240, d: 240 },
    wheels: [{ cx: 100, r: 44 }, { cx: 200, r: 44 }, { cx: 712, r: 44 }],
    shell: (clip) => {
      const d = "M628 -54 L628 -284 Q628 -300 644 -300 L730 -300 Q748 -300 755 -284 L792 -176 Q800 -164 800 -148 L800 -54 Z";
      return (
        <>
          <rect x="0" y="-108" width="800" height="54" rx="6" fill={C.chassis} />
          <Body d={d} clip={clip} shadeFrom={-110} />
          <Glass d="M640 -288 L730 -288 L760 -196 L640 -196 Z" />
          <rect x="786" y="-140" width="14" height="14" rx="3" fill="#fff" {...outline} />
        </>
      );
    },
  },
  fura: {
    len: 1130,
    top: -378,
    cargo: { x: 10, floor: -128, w: 840, h: 240, d: 260 },
    wheels: [{ cx: 86, r: 46 }, { cx: 190, r: 46 }, { cx: 294, r: 46 }, { cx: 930, r: 46 }, { cx: 1080, r: 46 }],
    shell: (clip) => {
      const d = "M900 -60 L900 -340 Q900 -356 916 -356 L1040 -356 Q1060 -356 1068 -338 L1122 -210 Q1130 -196 1130 -176 L1130 -60 Z";
      return (
        <>
          <rect x="0" y="-128" width="860" height="28" rx="5" fill={C.chassis} />
          <rect x="840" y="-100" width="290" height="40" rx="5" fill={C.chassis} />
          <rect x="612" y="-100" width="14" height="70" fill={C.chassis} />
          <Body d={d} clip={clip} shadeFrom={-104} />
          <Glass d="M914 -344 L1040 -344 L1074 -232 L914 -232 Z" />
          <rect x="1114" y="-168" width="16" height="16" rx="3" fill="#fff" {...outline} />
        </>
      );
    },
  },
};

/** Depth recedes up-right at a shallow oblique: dx = 0.22·d, dy = −0.13·d. */
const OB_X = 0.22;
const OB_Y = 0.13;

type Item = { x: number; w: number; h: number; base: number; kind: "box" | "fridge" | "sofa" | "wardrobe" };

/** Items laid out on the floor from the rear (left) of the cargo space. */
function layoutItems({ x, floor, w, h }: Cargo, openBed: boolean): Item[] {
  const items: Item[] = [];
  const maxH = openBed ? h + 100 : h - 8; // a pickup's load rises above the wall
  let cx = x + 8;
  const end = x + w - 6;
  const put = (iw: number, ih: number, kind: Item["kind"], base = floor) => {
    items.push({ x: cx, w: iw, h: ih, base, kind });
  };
  if (w >= 600) {
    put(110, Math.min(210, maxH), "wardrobe");
    cx += 118;
  }
  if (w >= 400) {
    put(70, Math.min(180, maxH), "fridge");
    cx += 78;
    put(190, 80, "sofa");
    // two boxes riding on the sofa
    items.push({ x: cx + 30, w: 52, h: 46, base: floor - 80, kind: "box" });
    items.push({ x: cx + 100, w: 48, h: 40, base: floor - 80, kind: "box" });
    cx += 198;
  }
  // fill the rest with box stacks of alternating height
  let col = 0;
  while (cx + 48 <= end) {
    const bw = col % 2 ? 48 : 54;
    if (cx + bw > end) break;
    const fit = Math.max(1, Math.floor(maxH / 46));
    const n = Math.max(1, fit - (col % 3 === 1 ? 1 : 0));
    let base = floor;
    for (let i = 0; i < n; i++) {
      const bh = i === n - 1 && maxH - 46 * i < 46 ? Math.max(28, maxH - 46 * i - 4) : 44;
      if (floor - base + bh > maxH) break;
      items.push({ x: cx, w: bw - (i % 2) * 6, h: bh, base, kind: "box" });
      base -= bh + 2;
    }
    cx += bw + 6;
    col++;
  }
  return items;
}

function ItemShape({ it, ox, oy }: { it: Item; ox: number; oy: number }) {
  const { x, w, h, base } = it;
  const y = base - h;
  const topFace = `M${x} ${y} L${x + ox} ${y - oy} L${x + w + ox} ${y - oy} L${x + w} ${y} Z`;
  const sideFace = `M${x + w} ${y} L${x + w + ox} ${y - oy} L${x + w + ox} ${base - oy} L${x + w} ${base} Z`;
  const thin = { stroke: C.boxEdge, strokeWidth: 0.8, vectorEffect: "non-scaling-stroke" as const, strokeLinejoin: "round" as const };
  if (it.kind === "fridge") {
    return (
      <g>
        <path d={sideFace} fill="#D5DBE6" {...thin} stroke="#8592AE" />
        <path d={topFace} fill="#FFFFFF" {...thin} stroke="#8592AE" />
        <rect x={x} y={y} width={w} height={h} rx="6" fill="#F2F4F8" {...thin} stroke="#8592AE" />
        <path d={`M${x} ${y + h * 0.36} H${x + w}`} {...thin} stroke="#8592AE" />
        <rect x={x + w - 12} y={y + h * 0.12} width="4" height={h * 0.16} rx="2" fill="#8592AE" />
        <rect x={x + w - 12} y={y + h * 0.44} width="4" height={h * 0.22} rx="2" fill="#8592AE" />
      </g>
    );
  }
  if (it.kind === "wardrobe") {
    return (
      <g>
        <path d={sideFace} fill="#9C6B3E" {...thin} stroke="#6E4825" />
        <path d={topFace} fill="#CF9A64" {...thin} stroke="#6E4825" />
        <rect x={x} y={y} width={w} height={h} rx="3" fill="#B98552" {...thin} stroke="#6E4825" />
        <path d={`M${x + w / 2} ${y + 4} V${base - 4}`} {...thin} stroke="#6E4825" />
        <circle cx={x + w / 2 - 7} cy={y + h / 2} r="3" fill="#6E4825" />
        <circle cx={x + w / 2 + 7} cy={y + h / 2} r="3" fill="#6E4825" />
      </g>
    );
  }
  if (it.kind === "sofa") {
    const seat = h * 0.45;
    return (
      <g>
        <path d={sideFace} fill="#1E2F5E" {...thin} stroke="#101A36" />
        <path d={`M${x + 12} ${y} H${x + w - 12} Q${x + w} ${y} ${x + w} ${y + 12} V${base} H${x} V${y + 12} Q${x} ${y} ${x + 12} ${y} Z`} fill="#2A3F78" {...thin} stroke="#101A36" />
        <rect x={x + 10} y={base - seat} width={w - 20} height={seat - 10} rx="8" fill="#3A5294" {...thin} stroke="#101A36" />
        <path d={`M${x + w / 2} ${base - seat} V${base - 10}`} {...thin} stroke="#101A36" />
        <rect x={x + 12} y={base - 10} width="10" height="10" fill="#101A36" />
        <rect x={x + w - 22} y={base - 10} width="10" height="10" fill="#101A36" />
      </g>
    );
  }
  return (
    <g>
      <path d={sideFace} fill="#C28A50" {...thin} />
      <path d={topFace} fill={C.boxTop} {...thin} />
      <rect x={x} y={y} width={w} height={h} rx="2" fill={C.box} {...thin} />
      <rect x={x + w / 2 - 5} y={y} width="10" height={h * 0.45} fill={C.tape} opacity="0.9" />
    </g>
  );
}

// Card coordinate space (≈ CSS px at 343 wide).
const VB_W = 320;
const VB_H = 180;
const GROUND = 150;
const LEFT = 56; // room for the height arrow + label
const RIGHT = 8;
const TOP = 28; // room for the width arrow + label

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = (x: number, y: number, a: number) => {
    const s = 4.5;
    return `M${x} ${y} L${x - s * Math.cos(a - 0.45)} ${y - s * Math.sin(a - 0.45)} L${x - s * Math.cos(a + 0.45)} ${y - s * Math.sin(a + 0.45)} Z`;
  };
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.dim} strokeWidth="1" opacity="0.8" />
      <path d={head(x2, y2, ang)} fill={C.dim} opacity="0.8" />
      <path d={head(x1, y1, ang + Math.PI)} fill={C.dim} opacity="0.8" />
    </g>
  );
}

function Label({ x, y, text, anchor = "middle" }: { x: number; y: number; text: string; anchor?: "middle" | "end" | "start" }) {
  const w = text.length * 5.6 + 10;
  // Keep every label inside the card, whatever the vehicle or screen width.
  const rx = Math.min(VB_W - w - 4, Math.max(4, anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x));
  return (
    <g>
      <rect x={rx} y={y - 8} width={w} height="16" rx="8" fill="#FFFFFF" opacity="0.92" />
      <text x={rx + w / 2} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={C.dim} fontFamily="inherit" style={{ fontVariantNumeric: "tabular-nums" }}>
        {text}
      </text>
    </g>
  );
}

export function VehicleIllustration({
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
  const s = SPECS[vehicle];
  const { cargo } = s;
  const ox = cargo.d * OB_X;
  const oy = cargo.d * OB_Y;

  // Fit the vehicle (plus the oblique back edge) into the card.
  const vehH = -Math.min(s.top, cargo.floor - cargo.h - oy - (s.openBed ? 110 : 0));
  const scale = Math.min((VB_W - LEFT - RIGHT) / s.len, (GROUND - TOP) / vehH);
  const tx = LEFT + (VB_W - LEFT - RIGHT - s.len * scale) / 2;
  const P = (x: number, y: number) => [tx + x * scale, GROUND + y * scale] as const;

  // Cargo corners in card space.
  const [fx0, fFloor] = P(cargo.x, cargo.floor);
  const [fx1, fTop] = P(cargo.x + cargo.w, cargo.floor - cargo.h);
  const [bx0, bFloor] = P(cargo.x + ox, cargo.floor - oy);
  const items = layoutItems(cargo, !!s.openBed);
  const t = 8; // box wall thickness (cm)
  const itemsTop = Math.min(...items.map((it) => it.base - it.h - oy * 0.74));
  const [, loadTop] = P(0, Math.min(itemsTop, cargo.floor - cargo.h - (s.openBed ? 0 : t)));
  const wy = Math.min(fTop, loadTop) - 12;
  // depth: oblique arrow out of the rear-bottom corner, toward the viewer
  const dLen = Math.hypot(bx0 - fx0, bFloor - fFloor);
  const dx = (-OB_X / Math.hypot(OB_X, OB_Y)) * dLen;
  const dy = (OB_Y / Math.hypot(OB_X, OB_Y)) * dLen;

  const interior = (
    <>
      {/* back wall, left wall, floor — the opened cargo space in shallow oblique */}
      <rect x={cargo.x + ox} y={cargo.floor - cargo.h - oy} width={cargo.w} height={cargo.h} fill={C.backWall} />
      <path
        d={`M${cargo.x} ${cargo.floor} L${cargo.x + ox} ${cargo.floor - oy} L${cargo.x + ox} ${cargo.floor - cargo.h - oy} L${cargo.x} ${cargo.floor - cargo.h} Z`}
        fill={C.sideWall}
      />
      <path
        d={`M${cargo.x} ${cargo.floor} L${cargo.x + ox} ${cargo.floor - oy} L${cargo.x + cargo.w + ox} ${cargo.floor - oy} L${cargo.x + cargo.w} ${cargo.floor} Z`}
        fill={C.floor}
      />
      {/* items stand a little way back from the open side */}
      <g transform={`translate(${ox * 0.42} ${-oy * 0.42})`}>
        {items.map((it, i) => (
          <ItemShape key={i} it={it} ox={ox * 0.32} oy={oy * 0.32} />
        ))}
      </g>
    </>
  );

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={className} aria-hidden="true" focusable="false">
      {/* warm ground shadow */}
      <ellipse cx={tx + (s.len * scale) / 2} cy={GROUND + 2} rx={(s.len * scale) / 2 + 6} ry="5" fill={C.shadow} />

      <g transform={`translate(${tx} ${GROUND}) scale(${scale})`}>
        {s.openBed ? (
          <>
            {s.shell(`body-${id}`)}
            {/* far bed wall, load, then the near wall in front */}
            <rect x={cargo.x + ox} y={cargo.floor - cargo.h - oy} width={cargo.w} height={cargo.h} fill={C.yellowShade} {...outline} />
            <path
              d={`M${cargo.x} ${cargo.floor} L${cargo.x + ox} ${cargo.floor - oy} L${cargo.x + cargo.w + ox} ${cargo.floor - oy} L${cargo.x + cargo.w} ${cargo.floor} Z`}
              fill={C.floor}
            />
            <g transform={`translate(${ox * 0.42} ${-oy * 0.42})`}>
              {items.map((it, i) => (
                <ItemShape key={i} it={it} ox={ox * 0.32} oy={oy * 0.32} />
              ))}
            </g>
            <rect x={cargo.x} y={cargo.floor - cargo.h} width={cargo.w} height={cargo.h} fill={C.yellow} {...outline} />
            <rect x={cargo.x} y={cargo.floor - 14} width={cargo.w} height="14" fill={C.yellowShade} opacity="0.55" />
            <path d={`M${cargo.x + cargo.w / 3} ${cargo.floor - cargo.h} V${cargo.floor} M${cargo.x + (2 * cargo.w) / 3} ${cargo.floor - cargo.h} V${cargo.floor}`} {...outline} opacity="0.35" fill="none" />
          </>
        ) : vehicle === "spark" || vehicle === "damas" ? (
          <>
            {s.shell(`body-${id}`)}
            {/* cut-away rear of the body, clipped to the body outline */}
            <g clipPath={`url(#body-${id})`}>
              <svg x={cargo.x} y={cargo.floor - cargo.h} width={cargo.w} height={cargo.h} overflow="hidden">
                <g transform={`translate(${-cargo.x} ${-(cargo.floor - cargo.h)})`}>{interior}</g>
              </svg>
            </g>
            {/* the opening follows the body: frame clipped by the outline, which is redrawn on top */}
            <g clipPath={`url(#body-${id})`}>
              <rect x={cargo.x} y={cargo.floor - cargo.h} width={cargo.w} height={cargo.h + 40} rx="6" fill="none" {...outline} />
            </g>
            <path d={BODY_PATHS[vehicle]} fill="none" {...outline} />
          </>
        ) : (
          <>
            {s.shell(`body-${id}`)}
            {/* box body: wall frame around the opened side */}
            <rect
              x={cargo.x - t}
              y={cargo.floor - cargo.h - t}
              width={cargo.w + 2 * t + ox * 0.4}
              height={cargo.h + t}
              rx="6"
              fill={C.yellow}
              {...outline}
            />
            <svg x={cargo.x} y={cargo.floor - cargo.h} width={cargo.w} height={cargo.h} overflow="hidden">
              <g transform={`translate(${-cargo.x} ${-(cargo.floor - cargo.h)})`}>{interior}</g>
            </svg>
            <rect x={cargo.x} y={cargo.floor - cargo.h} width={cargo.w} height={cargo.h} fill="none" {...outline} />
            <rect x={cargo.x - t} y={cargo.floor - 18} width={cargo.w + 2 * t + ox * 0.4} height="18" fill={C.yellowShade} opacity="0.6" />
          </>
        )}

        {s.wheels.map(({ cx, r }) => (
          <g key={cx}>
            <circle cx={cx} cy={-r} r={r + 3} fill={C.navy} opacity="0.25" />
            <circle cx={cx} cy={-r} r={r} fill={C.tire} />
            <circle cx={cx} cy={-r} r={r * 0.5} fill={C.hub} />
            <circle cx={cx} cy={-r} r={r * 0.18} fill={C.navy} />
          </g>
        ))}
      </g>

      {/* ── dimension arrows (card space, constant size) ── */}
      {/* width: above the cargo (and above a pickup's load) */}
      <Arrow x1={fx0} y1={wy} x2={fx1} y2={wy} />
      <line x1={fx0} y1={fTop - 2} x2={fx0} y2={wy - 5} stroke={C.dim} strokeWidth="0.75" opacity="0.35" />
      <line x1={fx1} y1={fTop - 2} x2={fx1} y2={wy - 5} stroke={C.dim} strokeWidth="0.75" opacity="0.35" />
      <Label x={(fx0 + fx1) / 2} y={wy} text={`${dims.width} ${unit}`} />
      {/* height: left of the cargo */}
      <Arrow x1={fx0 - 10} y1={fFloor} x2={fx0 - 10} y2={fTop} />
      <line x1={fx0 - 14} y1={fFloor} x2={fx0 - 2} y2={fFloor} stroke={C.dim} strokeWidth="0.75" opacity="0.4" />
      <line x1={fx0 - 14} y1={fTop} x2={fx0 - 2} y2={fTop} stroke={C.dim} strokeWidth="0.75" opacity="0.4" />
      <Label x={fx0 - 15} y={(fFloor + fTop) / 2} text={`${dims.height} ${unit}`} anchor="end" />
      {/* depth: same oblique as the drawn interior, out of the rear-bottom corner */}
      <Arrow x1={fx0 - 4} y1={fFloor + 3} x2={fx0 - 4 + dx} y2={fFloor + 3 + dy} />
      <Label x={fx0 - 6 + dx} y={fFloor + 12 + dy} text={`${dims.depth} ${unit}`} anchor="end" />
    </svg>
  );
}
