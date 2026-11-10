import { useId } from "react";
import { Check, Lock } from "@/lib/icons";
import type { Seat, SeatPosition } from "@/api/types";
import { Switch } from "@/components/Switch";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import "./seat3d.css";

const SEAT_LABEL_KEY: Record<SeatPosition, TranslationKey> = {
  front: "seat.front",
  "back-left": "seat.backLeft",
  "back-mid": "seat.backMid",
  "back-right": "seat.backRight",
};

// Footprints on the 240×400 car plane (front of the car at the top). Each
// footprint is the seat's hit area: cushion in the upper 60%, the hinged
// backrest rising from its rear edge. Sized so the projected box stays ≥44px
// and neighbouring seats stay ≥8px apart once projected.
type Box = { x: number; y: number; w: number; h: number };
const PLANE_W = 240;
const PLANE_H = 400;
const SEAT_BOX: Record<SeatPosition, Box> = {
  front: { x: 134, y: 150, w: 66, h: 90 },
  "back-left": { x: 20, y: 262, w: 58, h: 88 },
  "back-mid": { x: 91, y: 262, w: 58, h: 88 },
  "back-right": { x: 162, y: 262, w: 58, h: 88 },
};
const DRIVER_BOX: Box = { x: 40, y: 150, w: 66, h: 90 };
const ORDER: SeatPosition[] = ["front", "back-left", "back-mid", "back-right"];

function boxStyle({ x, y, w, h }: Box) {
  return {
    left: `${(x / PLANE_W) * 100}%`,
    top: `${(y / PLANE_H) * 100}%`,
    width: `${(w / PLANE_W) * 100}%`,
    height: `${(h / PLANE_H) * 100}%`,
  };
}

function CarBody() {
  const uid = useId().replace(/:/g, "");
  const paint = `paint-${uid}`;
  const sheen = `sheen-${uid}`;
  const glass = `glass-${uid}`;
  const cabin = `cabin-${uid}`;
  const console = `console-${uid}`;
  return (
    <svg viewBox="0 0 240 400" className="seat3d-body" aria-hidden="true">
      <defs>
        <linearGradient id={paint} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3457b0" />
          <stop offset="0.55" stopColor="#21397a" />
          <stop offset="1" stopColor="#13234f" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1430" />
          <stop offset="1" stopColor="#24345e" />
        </linearGradient>
        <linearGradient id={cabin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2440" />
          <stop offset="1" stopColor="#111a31" />
        </linearGradient>
        <linearGradient id={console} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a3554" />
          <stop offset="0.5" stopColor="#46557d" />
          <stop offset="1" stopColor="#2a3554" />
        </linearGradient>
      </defs>

      {/* Wheels, tucked under the body */}
      {[
        [4, 62],
        [222, 62],
        [4, 286],
        [222, 286],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="14" height="54" rx="6" fill="#0a0f1e" />
      ))}

      {/* Body shell */}
      <path
        d="M120 4 C168 4 206 14 214 54 L222 128 C228 180 228 250 222 302 L214 346 C206 384 168 396 120 396 C72 396 34 384 26 346 L18 302 C12 250 12 180 18 128 L26 54 C34 14 72 4 120 4 Z"
        fill={`url(#${paint})`}
      />
      {/* Side mirrors */}
      <ellipse cx="13" cy="128" rx="9" ry="6" fill="#1a2f66" />
      <ellipse cx="227" cy="128" rx="9" ry="6" fill="#1a2f66" />
      {/* Headlights / taillights */}
      <path d="M40 22 Q56 12 76 12 L72 22 Q56 24 44 30 Z" fill="#e8eefc" opacity="0.85" />
      <path d="M200 22 Q184 12 164 12 L168 22 Q184 24 196 30 Z" fill="#e8eefc" opacity="0.85" />
      <path d="M36 372 Q52 386 74 388 L74 380 Q56 378 42 366 Z" fill="#c43b3b" opacity="0.9" />
      <path d="M204 372 Q188 386 166 388 L166 380 Q184 378 198 366 Z" fill="#c43b3b" opacity="0.9" />
      {/* Hood crease */}
      <path d="M86 30 Q120 22 154 30" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" fill="none" />

      {/* Windshield, then the open (transparent-roof) cabin, then rear window */}
      <path d="M38 118 Q120 86 202 118 L196 136 Q120 112 44 136 Z" fill={`url(#${glass})`} />
      <rect x="28" y="134" width="184" height="226" rx="22" fill={`url(#${cabin})`} />
      <rect x="28" y="134" width="184" height="226" rx="22" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
      {/* Dashboard */}
      <rect x="34" y="138" width="172" height="10" rx="5" fill="#0d1428" />
      {/* Door seams / B-pillars */}
      <rect x="18" y="248" width="10" height="4" rx="2" fill="#0f1b3d" />
      <rect x="212" y="248" width="10" height="4" rx="2" fill="#0f1b3d" />
      {/* Centre console between the front seats, running back toward the rear row */}
      <rect x="112" y="150" width="16" height="104" rx="6" fill={`url(#${console})`} />
      <rect x="115" y="168" width="10" height="16" rx="3" fill="#0d1428" opacity="0.7" />
      <path d="M44 360 Q120 384 196 360 L194 368 Q120 388 46 368 Z" fill={`url(#${glass})`} opacity="0.9" />

      {/* Metallic sheen over the whole shell */}
      <path
        d="M120 4 C168 4 206 14 214 54 L222 128 C228 180 228 250 222 302 L214 346 C206 384 168 396 120 396 C72 396 34 384 26 346 L18 302 C12 250 12 180 18 128 L26 54 C34 14 72 4 120 4 Z"
        fill={`url(#${sheen})`}
        pointerEvents="none"
      />
    </svg>
  );
}

function SteeringWheel() {
  return (
    <svg viewBox="0 0 24 24" className="seat3d-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <path d="M3.5 11 H9.6 M14.4 11 H20.5 M12 14.4 V21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

type SeatState = "free" | "selected" | "taken" | "whole" | "driver";

function SeatShape({ state, children }: { state: SeatState; children?: React.ReactNode }) {
  return (
    <>
      <span className="seat3d-shadow" aria-hidden="true" />
      <span className="seat3d-back" aria-hidden="true" />
      <span className="seat3d-cushion" aria-hidden="true">
        {children ??
          (state === "selected" || state === "whole" ? (
            <Check className="seat3d-icon" strokeWidth={3} />
          ) : state === "taken" ? (
            <Lock className="seat3d-icon" strokeWidth={2.4} />
          ) : null)}
      </span>
      <span className="seat3d-glow" aria-hidden="true" />
    </>
  );
}

export function seatCountLabel(t: (key: TranslationKey, params?: Record<string, string | number>) => string, count: number, intlTag: string) {
  const rule = new Intl.PluralRules(intlTag).select(count);
  const key: TranslationKey =
    rule === "one" ? "seat.selectedCount.one" : rule === "few" ? "seat.selectedCount.few" : "seat.selectedCount.other";
  return t(key, { count });
}

/**
 * Premium high-angle 3D sedan seat selector. Taken seats (from the adapter)
 * are dimmed and locked; a seat this order already holds is never shown as
 * taken. In whole-car mode every passenger seat is lit and the toggle below
 * is the way back to picking individual seats.
 */
export function SeatMap({
  seats,
  selected,
  onToggle,
  wholeCar,
  onWholeCarChange,
}: {
  seats: Seat[];
  selected: string[];
  onToggle: (seatId: string) => void;
  wholeCar: boolean;
  onWholeCarChange: (wholeCar: boolean) => void;
}) {
  const { t, intlTag } = useT();
  const byId = Object.fromEntries(seats.map((s) => [s.id, s]));

  const summary = wholeCar
    ? seatCountLabel(t, ORDER.length, intlTag)
    : selected.length === 0
    ? t("seat.noneSelected")
    : seatCountLabel(t, selected.length, intlTag);

  return (
    <div className="rounded-xl border border-border bg-bg px-3 pb-3 pt-2">
      <div className="seat3d-stage">
        <div className="seat3d-ground" aria-hidden="true" />
        <div className="seat3d-float">
          <div className="seat3d-plane">
            <CarBody />
            <span className="seat3d" data-state="driver" style={boxStyle(DRIVER_BOX)} aria-hidden="true">
              <SeatShape state="driver">
                <SteeringWheel />
              </SeatShape>
            </span>
            {ORDER.map((position) => {
              const seat = byId[position];
              const isSelected = selected.includes(position);
              const taken = !!seat?.taken && !isSelected;
              const state: SeatState = wholeCar ? "whole" : taken ? "taken" : isSelected ? "selected" : "free";
              const label = [
                t(SEAT_LABEL_KEY[position]),
                seat?.price != null ? formatSom(seat.price, intlTag) : null,
                taken ? t("seat.taken") : null,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={position}
                  type="button"
                  className="seat3d"
                  data-state={state}
                  style={boxStyle(SEAT_BOX[position])}
                  disabled={taken}
                  aria-disabled={wholeCar || undefined}
                  aria-pressed={wholeCar || isSelected}
                  aria-label={label}
                  onClick={() => {
                    if (!wholeCar) onToggle(position);
                  }}
                >
                  <SeatShape state={state} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-1 text-center text-sm font-semibold text-ink" aria-live="polite">
        {summary}
      </p>
      {!wholeCar && <p className="mt-1 text-center text-xs text-ink/60 text-pretty">{t("seat.frontSurchargeNote")}</p>}

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-softer">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t("order.wholeCar")}</p>
          <p className="text-xs text-ink/60">{t("seat.wholeCarHint")}</p>
        </div>
        <Switch checked={wholeCar} onChange={() => onWholeCarChange(!wholeCar)} label={t("order.wholeCar")} />
      </div>
    </div>
  );
}
