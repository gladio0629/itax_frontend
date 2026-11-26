import type { ReactNode } from "react";
import type { OrderMode } from "@/api/types";
import { passengerSeats, type LayoutSeat, type SeatCabin, type SeatLayout } from "@/api/seatLayout";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { Switch } from "@/ui";
import { CAR_AFTER_SEATS, CAR_BEFORE_SEATS, ROAD_BG, VAN_AFTER_SEATS, VAN_BEFORE_SEATS } from "./seatArt";

type SeatState = "free" | "selected" | "taken";
type T = ReturnType<typeof useT>["t"];
type Box = { left: number; top: number; width: number; height: number };

// Seat palette of the design (a drawing, the same in both themes).
const FREE = { bol: "#D6C19B", cush: "#ECDFC7", back: "#E4D4B6", st: "#CFBA94" };
const PICKED = { bol: "#1FB86A", cush: "#2EDB85", back: "#28CC7B", st: "#1FB86A" };
const TAKEN = { bol: "#2B3A4E", cush: "#3A4C63", back: "#34455B", st: "#2B3A4E" };
const colors = (state: SeatState) => (state === "selected" ? PICKED : state === "taken" ? TAKEN : FREE);

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
function FrontSeat({ transform, state }: { transform: string; state: SeatState }) {
  const c = colors(state);
  return (
    <g transform={transform}>
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

function BackSeat({ x, y, state }: { x: number; y: number; state: SeatState }) {
  const c = colors(state);
  return (
    <g transform={`translate(${x} ${y})`}>
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

/** Where a passenger seat is drawn and tapped. Hit boxes are px in the car box. */
type Slot = { draw: (state: SeatState) => ReactNode; hit: Box; label: (t: T) => string };

const frontSlot = (transform: string, hit: Box): Slot => ({
  draw: (state) => <FrontSeat transform={transform} state={state} />,
  hit,
  label: (t) => t("seats.front"),
});
const ROW_LABEL = ["seats.rowLeft", "seats.rowMid", "seats.rowRight"] as const;
const SEDAN_BACK_LABEL = ["seats.backLeft", "seats.backMid", "seats.backRight"] as const;
/** A row of three seats; `row` is 1-based (2 = the row behind the driver). */
function benchSlots(y: number, xs: number[], hitTop: number, hitLefts: number[], hitHeight: number, row: number, sedan: boolean): Slot[] {
  return xs.map((x, i) => ({
    draw: (state) => <BackSeat x={x} y={y} state={state} />,
    hit: { left: hitLefts[i], top: hitTop, width: 31, height: hitHeight },
    label: (t) => (sedan ? t(SEDAN_BACK_LABEL[i]) : t(ROW_LABEL[i], { row })),
  }));
}

/** The two cabins of the design: Trip (sedan) and TripVan (minivan). */
const CABINS: Record<
  SeatCabin,
  {
    cardHeight: number;
    box: { top: number; width: number; height: number };
    viewBox: string;
    before: ReactNode;
    after: ReactNode;
    driverHit: Box;
    /** Passenger slots per row, front to back. */
    rows: Slot[][];
  }
> = {
  sedan: {
    cardHeight: 447,
    box: { top: 19, width: 190, height: 407 },
    viewBox: "8 10 244 522",
    before: CAR_BEFORE_SEATS,
    after: CAR_AFTER_SEATS,
    driverHit: { left: 48, top: 173, width: 36, height: 66 },
    rows: [
      [frontSlot("translate(144 232) scale(0.88 0.9)", { left: 106, top: 173, width: 36, height: 66 })],
      benchSlots(332, [66, 110, 154], 251, [45, 80, 114], 66, 2, true),
    ],
  },
  minivan: {
    cardHeight: 381,
    box: { top: 16, width: 186, height: 349 },
    viewBox: "0 0 240 450",
    before: VAN_BEFORE_SEATS,
    after: VAN_AFTER_SEATS,
    driverHit: { left: 37, top: 87, width: 34, height: 60 },
    rows: [
      [frontSlot("translate(148 112) scale(0.84)", { left: 115, top: 87, width: 34, height: 60 })],
      benchSlots(204, [50, 100, 150], 158, [39, 78, 116], 65, 2, false),
      benchSlots(300, [50, 100, 150], 232, [39, 78, 116], 65, 3, false),
    ],
  },
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
 * Seat picker (design: Trip, and TripVan for the minivan). The layout of the
 * chosen class comes from the server (getSeatLayouts): rows, seat ids, taken
 * seats, the passenger count and whether "Butun mashina" can be booked.
 * Several seats can be picked. Prices are not shown per seat: the total is
 * the server's quote at the bottom of the screen.
 */
export function SeatPicker({
  layout,
  classLabel,
  mode,
  seatIds,
  onChange,
}: {
  layout: SeatLayout;
  /** Name of the class, shown with the passenger count for the minivan. */
  classLabel?: string;
  mode: OrderMode;
  seatIds: string[];
  onChange: (mode: OrderMode, seatIds: string[]) => void;
}) {
  const { t } = useT();
  const cabin = CABINS[layout.cabin];
  const seats = passengerSeats(layout);
  const free = seats.filter((s) => !s.taken).map((s) => s.id);
  const whole = mode === "car";
  const stateOf = (s: LayoutSeat): SeatState => (s.taken ? "taken" : whole || seatIds.includes(s.id) ? "selected" : "free");
  const picked = whole ? free.length : seatIds.length;
  const hasDriver = layout.rows.some((row) => row.some((s) => s.kind === "driver"));

  // The server's seats placed on the drawing's slots, row by row.
  const placed: { seat: LayoutSeat; slot: Slot }[] = [];
  layout.rows.forEach((row, r) => {
    const slots = cabin.rows[r] ?? [];
    row.filter((s) => s.kind === "passenger").forEach((seat, i) => {
      if (slots[i]) placed.push({ seat, slot: slots[i] });
    });
  });

  function toggle(s: LayoutSeat) {
    if (s.taken) return;
    const current = whole ? free : seatIds;
    const next = current.includes(s.id) ? current.filter((id) => id !== s.id) : [...current, s.id];
    onChange("seat", next);
  }

  const info = layout.cabin === "minivan" && classLabel ? t("seats.infoClass", { name: classLabel, n: layout.passengerSeats }) : t("seats.info", { n: layout.passengerSeats });

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="seat-title">
      <div className="flex items-end justify-between">
        <span className="flex flex-col gap-0.5">
          <h2 id="seat-title" className="text-[18px] font-extrabold text-iz-ink">
            {t("seats.title")}
          </h2>
          <span className="text-[12px] font-semibold text-iz-muted">{info}</span>
        </span>
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
      <div
        className="relative overflow-hidden rounded-iz-card border border-iz-border bg-white transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={{ height: cabin.cardHeight }}
      >
        <svg aria-hidden width="100%" height="445" viewBox="0 0 348 445" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 block">
          {ROAD_BG}
        </svg>
        <div
          key={layout.cabin}
          className="absolute left-1/2 -translate-x-1/2 motion-safe:animate-fade-in"
          style={{ top: cabin.box.top, width: cabin.box.width, height: cabin.box.height }}
        >
          <svg
            role="img"
            aria-label={layout.cabin === "minivan" ? t("seats.vanLabel", { n: layout.passengerSeats }) : t("seats.carLabel")}
            width={cabin.box.width}
            height={cabin.box.height}
            viewBox={cabin.viewBox}
            className="block"
          >
            {cabin.before}
            {placed.map(({ seat, slot }) => (
              <g key={seat.id}>{slot.draw(stateOf(seat))}</g>
            ))}
            {cabin.after}
          </svg>
          {hasDriver && (
            <button type="button" disabled aria-label={t("seats.driver")} className="absolute cursor-not-allowed rounded-xl" style={cabin.driverHit} />
          )}
          {placed.map(({ seat, slot }) => {
            const st = stateOf(seat);
            const label = slot.label(t);
            return (
              <button
                key={seat.id}
                type="button"
                disabled={seat.taken}
                aria-pressed={seat.taken ? undefined : st === "selected"}
                aria-label={seat.taken ? t("seats.takenLabel", { seat: label }) : label}
                onClick={() => toggle(seat)}
                className="absolute rounded-[10px] outline-offset-2 disabled:cursor-not-allowed"
                style={slot.hit}
              />
            );
          })}
        </div>
      </div>
      <div className="flex h-[60px] items-center gap-3 rounded-iz-field border border-iz-border pl-4 pr-2">
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className={cn("text-[15px] font-extrabold", layout.wholeCarAvailable ? "text-iz-ink" : "text-iz-muted")}>{t("seats.wholeCar")}</span>
          {!layout.wholeCarAvailable && <span className="text-[12px] text-iz-muted">{t("seats.wholeCarUnavailable")}</span>}
        </span>
        <Switch
          checked={whole}
          disabled={!layout.wholeCarAvailable}
          label={t("seats.wholeCar")}
          onChange={(on) => onChange(on ? "car" : "seat", [])}
        />
      </div>
    </section>
  );
}
