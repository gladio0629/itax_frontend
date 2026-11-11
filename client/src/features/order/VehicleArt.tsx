import { useId } from "react";
import type { DeliveryVehicle } from "@/api/types";

/**
 * Side-view vehicle silhouettes for the delivery picker. All six share one
 * 160×72 canvas and one ground line, so a Spark really is smaller than a
 * semi truck. Body uses the accent token (navy in light, light blue in dark);
 * a clipped shade darkens the lower body; yellow marks one accent detail.
 */
type Spec = {
  body: string[];
  windows: string[];
  wheels: { cx: number; r: number }[];
  accents: string[];
  /** Yellow details that sit outside the body outline (e.g. cargo in a bed). */
  freeAccents?: string[];
  /** Darker chassis / bumper strips drawn under the body. */
  chassis?: string[];
};

const GROUND = 64;

const SPECS: Record<DeliveryVehicle, Spec> = {
  spark: {
    body: ["M48 58 V48 Q49 43 55 42 L62 41 L71 31 Q73 29 77 29 H96 Q100 29 102 32 L108 41 Q112 42 112 47 V58 Z"],
    windows: ["M64 41 L72 32.5 H83 V41 Z", "M86 32.5 H96.5 Q98.5 32.5 99.5 34 L104.5 41 H86 Z"],
    wheels: [{ cx: 59, r: 6 }, { cx: 101, r: 6 }],
    accents: ["M108.5 44.5 h3 v3 h-3 Z"],
  },
  damas: {
    body: ["M42 58 V30 Q42 25 47 25 H103 Q109 25 111.5 30 L117.5 42 Q118 44 118 47 V58 Z"],
    windows: ["M47 30 H61 V40 H47 Z", "M64 30 H78 V40 H64 Z", "M81 30 H95 V40 H81 Z", "M99 30 H105 L111.5 41 H99 Z"],
    wheels: [{ cx: 55, r: 6 }, { cx: 105, r: 6 }],
    accents: ["M42 46 H118 V48.5 H42 Z"],
  },
  labo: {
    body: [
      "M92 58 V26 Q92 23 95 23 H108 Q112 23 114 27 L122 40 Q124 42 124 46 V58 Z",
      "M36 58 V40 Q36 38 38 38 H90 V58 Z",
    ],
    windows: ["M96 28 H108 L115.5 40 H96 Z"],
    wheels: [{ cx: 50, r: 6 }, { cx: 110, r: 6 }],
    accents: ["M120.5 44 h3.5 v3 h-3.5 Z"],
    // cargo crate in the open bed
    freeAccents: ["M45 29 H67 Q68.5 29 68.5 30.5 V38 H43.5 V30.5 Q43.5 29 45 29 Z"],
  },
  isuzu: {
    body: [
      "M28 52 V19 Q28 16 31 16 H97 Q100 16 100 19 V52 Z",
      "M102 58 V28 Q102 24 106 24 H118 Q122 24 124 28 L130 40 Q132 42 132 46 V58 Z",
    ],
    windows: ["M106 29 H118 L124.5 40 H106 Z"],
    chassis: ["M28 52 H104 V57 H28 Z"],
    wheels: [{ cx: 44, r: 7 }, { cx: 118, r: 7 }],
    accents: ["M28 42 H100 V45 H28 Z"],
  },
  isuzu2: {
    body: [
      "M20 52 V11 Q20 8 23 8 H105 Q108 8 108 11 V52 Z",
      "M110 58 V22 Q110 18 114 18 H126 Q130 18 132 22 L138 38 Q140 40 140 44 V58 Z",
    ],
    windows: ["M114 23 H126 L132.5 37 H114 Z"],
    chassis: ["M20 52 H112 V57 H20 Z"],
    wheels: [{ cx: 34, r: 7 }, { cx: 50, r: 7 }, { cx: 127, r: 7 }],
    accents: ["M20 40 H108 V43 H20 Z"],
  },
  fura: {
    body: [
      "M5 50 V9 Q5 6 8 6 H114 Q117 6 117 9 V50 Z",
      "M121 58 V14 Q121 10 125 10 H140 Q145 10 147 15 L153 34 Q155 36 155 40 V58 Z",
    ],
    windows: ["M125 15 H139 L145.5 32 H125 Z"],
    chassis: ["M5 50 H122 V55 H5 Z"],
    wheels: [{ cx: 17, r: 6.5 }, { cx: 31, r: 6.5 }, { cx: 45, r: 6.5 }, { cx: 130, r: 6.5 }, { cx: 146, r: 6.5 }],
    accents: ["M5 38 H117 V41 H5 Z", "M150.5 44 h4 v3 h-4 Z"],
  },
};

export function VehicleArt({ vehicle, className }: { vehicle: DeliveryVehicle; className?: string }) {
  const clip = useId().replace(/:/g, "");
  const s = SPECS[vehicle];
  return (
    <svg viewBox="0 2 160 66" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`vb-${clip}`}>
          {s.body.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
      </defs>
      {/* ground shadow */}
      <ellipse cx="80" cy={GROUND} rx="76" ry="2.5" fill="rgb(var(--color-text-rgb))" opacity="0.06" />
      {s.chassis?.map((d, i) => (
        <path key={i} d={d} fill="rgb(var(--color-accent-rgb))" opacity="0.55" />
      ))}
      <g clipPath={`url(#vb-${clip})`}>
        {s.body.map((d, i) => (
          <path key={i} d={d} fill="rgb(var(--color-accent-rgb))" />
        ))}
        {/* top highlight + lower shade give the flat silhouette some volume */}
        <rect x="0" y="0" width="160" height="22" fill="#fff" opacity="0.08" />
        <rect x="0" y="47" width="160" height="12" fill="#000" opacity="0.14" />
        {s.accents.map((d, i) => (
          <path key={i} d={d} fill="var(--color-brand-yellow)" />
        ))}
      </g>
      {s.freeAccents?.map((d, i) => (
        <path key={i} d={d} fill="var(--color-brand-yellow)" />
      ))}
      {s.windows.map((d, i) => (
        <path key={i} d={d} fill="#E8EEF9" opacity="0.92" />
      ))}
      {s.wheels.map(({ cx, r }) => (
        <g key={cx}>
          <circle cx={cx} cy={GROUND - r} r={r} fill="#16264d" />
          <circle cx={cx} cy={GROUND - r} r={r * 0.45} fill="#C9D2E3" />
        </g>
      ))}
    </svg>
  );
}
