import type { OrderMode, Seat, SeatPosition } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { Switch } from "@/ui";
import { CAR_AFTER_SEATS, CAR_BEFORE_SEATS, ROAD_BG } from "./seatArt";

type SeatState = "free" | "selected" | "taken";

// Seat palette of the design (a drawing, the same in both themes).
const FREE = { bol: "#D6C19B", cush: "#ECDFC7", back: "#E4D4B6", st: "#CFBA94" };
const PICKED = { bol: "#1FB86A", cush: "#2EDB85", back: "#28CC7B", st: "#1FB86A" };
const TAKEN = { bol: "#2B3A4E", cush: "#3A4C63", back: "#34455B", st: "#2B3A4E" };

function Check({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0B1524" />
      <path d={`M${cx - 5.5} ${cy} L${cx - 1.5} ${cy + 4} L${cx + 6} ${cy - 4.5}`} stroke="#2EDB85" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  );
}
function Person({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy - 5} r={5} fill="#8EA0B6" />
      <path d={`M${cx - 9} ${cy + 12} C${cx - 9} ${cy + 4} ${cx + 9} ${cy + 4} ${cx + 9} ${cy + 12} Z`} fill="#8EA0B6" />
    </g>
  );
}

/** Front passenger seat (bigger, same shape as the driver's). */
function FrontSeat({ state }: { state: SeatState }) {
  const c = state === "selected" ? PICKED : state === "taken" ? TAKEN : FREE;
  return (
    <g transform="translate(144 232) scale(0.88 0.9)">
      <path d="M8 0 C3 0 0 4 0 10 L0 54 C0 62 3 68 7 72 L9 78 C11 84 15 86 21 86 L31 86 C37 86 41 84 43 78 L45 72 C49 68 52 62 52 54 L52 10 C52 4 49 0 44 0 Z" fill={c.bol} />
      <rect x="9" y="5" width="34" height="36" rx="9" fill={c.cush} />
      {state === "free" && <path d="M20 11 L20 35 M32 11 L32 35" stroke={c.st} strokeWidth="2" strokeLinecap="round" fill="none" />}
      <rect x="9" y="45" width="34" height="32" rx="9" fill={c.back} />
      <path d="M14 54 L38 54 M14 64 L38 64" stroke={c.st} strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="14" y="82" width="24" height="11" rx="5.5" fill={c.bol} />
      {state === "selected" && <Check cx={26} cy={23} r={11} />}
      {state === "taken" && <Person cx={26} cy={22} />}
    </g>
  );
}

function BackSeat({ x, state }: { x: number; state: SeatState }) {
  const c = state === "selected" ? PICKED : state === "taken" ? TAKEN : FREE;
  return (
    <g transform={`translate(${x} 332)`}>
      <rect x="0" y="0" width="40" height="36" rx="10" fill={c.cush} />
      {state === "free" && <path d="M14 7 L14 29 M26 7 L26 29" stroke={c.st} strokeWidth="1.8" strokeLinecap="round" fill="none" />}
      <rect x="0" y="40" width="40" height="30" rx="9" fill={c.back} />
      {state !== "taken" && <path d="M6 50 L34 50 M6 60 L34 60" stroke={c.st} strokeWidth="1.8" strokeLinecap="round" fill="none" />}
      <rect x="10" y="74" width="20" height="10" rx="5" fill={c.bol} />
      {state === "selected" && <Check cx={20} cy={18} r={10} />}
      {state === "taken" && <Person cx={20} cy={18} />}
    </g>
  );
}

const BACK_X: Record<Exclude<SeatPosition, "front">, number> = { "back-left": 66, "back-mid": 110, "back-right": 154 };

/** Tap targets over the drawing (px in the 190×407 car box). */
const HIT: Record<SeatPosition, { left: number; top: number; width: number; height: number }> = {
  front: { left: 106, top: 173, width: 36, height: 66 },
  "back-left": { left: 45, top: 251, width: 31, height: 66 },
  "back-mid": { left: 80, top: 251, width: 31, height: 66 },
  "back-right": { left: 114, top: 251, width: 31, height: 66 },
};
const SEAT_LABEL: Record<SeatPosition, TranslationKey> = {
  front: "seats.front",
  "back-left": "seats.backLeft",
  "back-mid": "seats.backMid",
  "back-right": "seats.backRight",
};

function Legend({ color, label, ring }: { color: string; label: string; ring?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-iz-muted">
      <span aria-hidden className="h-3 w-3 rounded-[4px]" style={{ background: color, boxShadow: ring ? `inset 0 0 0 1px ${ring}` : undefined }} />
      {label}
    </span>
  );
}

/**
 * Seat picker (design: Trip). Which seats are taken comes from the server
 * (getSeatMap); several seats can be picked. "Butun mashina" is offered only
 * while no seat is taken. Prices are not shown per seat: the total is the
 * server's quote at the bottom of the screen.
 */
export function SeatPicker({
  seats,
  mode,
  seatIds,
  onChange,
}: {
  seats: Seat[];
  mode: OrderMode;
  seatIds: string[];
  onChange: (mode: OrderMode, seatIds: string[]) => void;
}) {
  const { t } = useT();
  const byPos = new Map(seats.map((s) => [s.position, s]));
  const anyTaken = seats.some((s) => s.taken);
  const whole = mode === "car";
  const stateOf = (p: SeatPosition): SeatState => {
    const s = byPos.get(p);
    if (!s || s.taken) return "taken";
    return whole || seatIds.includes(s.id) ? "selected" : "free";
  };
  const picked = whole ? seats.filter((s) => !s.taken).length : seatIds.length;

  function toggle(p: SeatPosition) {
    const s = byPos.get(p);
    if (!s || s.taken) return;
    const free = seats.filter((x) => !x.taken).map((x) => x.id);
    const current = whole ? free : seatIds;
    const next = current.includes(s.id) ? current.filter((id) => id !== s.id) : [...current, s.id];
    onChange("seat", next);
  }

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="seat-title">
      <div className="flex items-baseline justify-between">
        <h2 id="seat-title" className="text-[18px] font-extrabold text-iz-ink">
          {t("seats.title")}
        </h2>
        <span className="text-[13px] font-bold text-iz-green-text" aria-live="polite">
          {picked === 0 ? t("seats.none") : t("seats.count", { n: picked })}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        <Legend color={FREE.cush} ring="#D6C19B" label={t("seats.legendFree")} />
        <Legend color={PICKED.cush} label={t("seats.legendPicked")} />
        <Legend color={TAKEN.cush} label={t("seats.legendTaken")} />
        <Legend color="#A9774B" label={t("seats.legendDriver")} />
      </div>
      <div className="relative h-[447px] overflow-hidden rounded-iz-card border border-iz-border bg-white">
        <svg aria-hidden width="100%" height="445" viewBox="0 0 348 445" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 block">
          {ROAD_BG}
        </svg>
        <div className="absolute left-1/2 top-[19px] h-[407px] w-[190px] -translate-x-1/2">
          <svg role="img" aria-label={t("seats.carLabel")} width="190" height="407" viewBox="8 10 244 522" className="block">
            {CAR_BEFORE_SEATS}
            <FrontSeat state={stateOf("front")} />
            {(Object.keys(BACK_X) as (keyof typeof BACK_X)[]).map((p) => (
              <BackSeat key={p} x={BACK_X[p]} state={stateOf(p)} />
            ))}
            {CAR_AFTER_SEATS}
          </svg>
          <button
            type="button"
            disabled
            aria-label={t("seats.driver")}
            className="absolute cursor-not-allowed rounded-xl"
            style={{ left: 48, top: 173, width: 36, height: 66 }}
          />
          {(Object.keys(HIT) as SeatPosition[]).map((p) => {
            const st = stateOf(p);
            const taken = st === "taken";
            return (
              <button
                key={p}
                type="button"
                disabled={taken}
                aria-pressed={taken ? undefined : st === "selected"}
                aria-label={taken ? t("seats.takenLabel", { seat: t(SEAT_LABEL[p]) }) : t(SEAT_LABEL[p])}
                onClick={() => toggle(p)}
                className="absolute rounded-[10px] outline-offset-2 disabled:cursor-not-allowed"
                style={HIT[p]}
              />
            );
          })}
        </div>
      </div>
      <div className="flex h-[60px] items-center gap-3 rounded-iz-field border border-iz-border pl-4 pr-2">
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className={anyTaken ? "text-[15px] font-extrabold text-iz-muted" : "text-[15px] font-extrabold text-iz-ink"}>{t("seats.wholeCar")}</span>
          {anyTaken && <span className="text-[12px] text-iz-muted">{t("seats.wholeCarUnavailable")}</span>}
        </span>
        <Switch checked={whole} disabled={anyTaken} label={t("seats.wholeCar")} onChange={(on) => onChange(on ? "car" : "seat", [])} />
      </div>
    </section>
  );
}
