import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Driver, OrderWithDetails } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { MapCanvas } from "@/components/MapCanvas";
import { Icon, type IconName } from "@/ui";
import type { DrawnProgress } from "@/features/order/TrackMap";

/** The four phases of a live trip (design: Driver / Arrived / OnTrip). */
const PHASES: TranslationKey[] = ["live.step.onWay", "live.step.arrived", "live.step.trip", "live.step.done"];

/** "Yo'lda — Yetib keldi — Safarda — Tugadi": done ink, current green. */
export function PhaseBar({ current }: { current: 0 | 1 | 2 | 3 }) {
  const { t } = useT();
  return (
    <div>
      <p className="sr-only" role="status">
        {t("live.phaseStatus", { phase: t(PHASES[current]), n: current + 1, total: PHASES.length })}
      </p>
      <ol aria-hidden className="grid grid-cols-4 gap-1.5">
        {PHASES.map((key, i) => (
          <li key={key} className="flex min-w-0 flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full", i < current ? "bg-iz-ink" : i === current ? "bg-iz-green" : "bg-iz-skeleton-strong")} />
            <span className={cn("truncate text-[11px]", i === current ? "font-extrabold text-iz-ink" : "font-semibold text-iz-muted")}>{t(key)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Small caps green label over a 24px heading and an optional muted line. */
export function LiveHeading({ label, title, sub }: { label?: string; title: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-green-text">{label}</span>}
      <h1 className="text-[24px] font-extrabold leading-8 text-iz-ink">{title}</h1>
      {sub && <span className="text-[13px] text-iz-muted">{sub}</span>}
    </div>
  );
}

/** "Jasur Toshmatov" → "Jasur T." (display only). */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0].toUpperCase()}.` : first ?? "";
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function DriverAvatar({ name, size = 48, tone }: { name: string; size?: number; tone: "dark" | "ring" | "light" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold",
        tone === "ring" && "border-2 border-iz-green bg-iz-head-card text-iz-head-text",
        tone === "dark" && "bg-iz-head text-iz-head-text",
        tone === "light" && "bg-iz-field text-iz-ink"
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Uzbek plate "01 A 123 BC": the region in its own box, like the real plate. */
export function Plate({ plate }: { plate: string }) {
  const m = /^\s*(\d{2})\s*(.+?)\s*$/.exec(plate);
  return (
    <span className="flex h-[38px] items-center rounded-[10px] border-2 border-iz-plate-ink bg-iz-plate text-[15px] font-extrabold tracking-[1px] text-iz-plate-ink shadow-[0_0_0_1px_var(--iz-plate)]">
      {m ? (
        <>
          <span className="flex h-full items-center border-r-2 border-iz-plate-ink px-[9px]">{m[1]}</span>
          <span className="px-[11px]">{m[2]}</span>
        </>
      ) : (
        <span className="px-[11px]">{plate}</span>
      )}
    </span>
  );
}

/** Green call button: a phone link when the server gives a number,
 * otherwise `onUnavailable` (a short note). */
export function CallButton({ phone, onUnavailable, outline }: { phone?: string; onUnavailable: () => void; outline?: boolean }) {
  const { t } = useT();
  const cls = cn(
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:scale-95",
    outline ? "border border-iz-chip-border text-iz-ink" : "bg-iz-green text-iz-on-green"
  );
  if (phone) {
    return (
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label={t("driver.call")} className={cls}>
        <Icon name="phone" size={20} />
      </a>
    );
  }
  return (
    <button type="button" onClick={onUnavailable} aria-label={t("driver.call")} className={cls}>
      <Icon name="phone" size={20} />
    </button>
  );
}

/** "Haydovchiga yozish": the phone's messages app to the driver's number when
 * the server gives one, otherwise `onUnavailable` (a short note). */
export function MessageButton({ phone, onUnavailable, tone }: { phone?: string; onUnavailable: () => void; tone: "dark" | "light" }) {
  const { t } = useT();
  const cls = cn(
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:scale-95",
    tone === "dark" ? "border border-iz-head-border-strong text-iz-head-text" : "border border-iz-chip-border text-iz-ink"
  );
  if (phone) {
    return (
      <a href={`sms:${phone.replace(/[^\d+]/g, "")}`} aria-label={t("driver.message")} className={cls}>
        <Icon name="chat" size={20} />
      </a>
    );
  }
  return (
    <button type="button" onClick={onUnavailable} aria-label={t("driver.message")} className={cls}>
      <Icon name="chat" size={20} />
    </button>
  );
}

const payKey = (o: OrderWithDetails): TranslationKey => {
  const m = o.extras?.payMethod ?? o.paymentMethod;
  return m === "cash" ? "order.cash" : m === "payme" ? "pay.payme" : m === "click" ? "pay.click" : "order.card";
};
export const payLabel = (o: OrderWithDetails, t: (k: TranslationKey) => string) => t(payKey(o));

/** Driver found (design: Driver): the dark card with car, plate and price. */
export function DriverCardDark({ driver, order, onCall, onMessage }: { driver: Driver; order: OrderWithDetails; onCall: () => void; onMessage: () => void }) {
  const { t, intlTag } = useT();
  const name = driver.name ? shortName(driver.name) : t("driver.unnamed");
  const car = [driver.carModel, driver.carColor].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-3 rounded-iz-card bg-iz-head px-4 py-3.5">
      <div className="flex items-center gap-3">
        <DriverAvatar name={driver.name || t("driver.unnamed")} size={52} tone="ring" />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-[17px] font-extrabold text-iz-head-text">{name}</span>
          {(driver.rating > 0 || car) && (
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-iz-head-muted">
              {driver.rating > 0 && (
                <>
                  <Icon name="star" size={14} filled className="shrink-0 text-iz-green" />
                  <span className="font-extrabold text-iz-head-text">{driver.rating.toLocaleString(intlTag, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                </>
              )}
              {car && <span className="truncate">{driver.rating > 0 ? `· ${car}` : car}</span>}
            </span>
          )}
        </div>
        <MessageButton phone={order.driverPhone} onUnavailable={onMessage} tone="dark" />
        <CallButton phone={order.driverPhone} onUnavailable={onCall} />
      </div>
      <div className="flex items-center justify-between gap-3">
        {driver.plate ? <Plate plate={driver.plate} /> : <span />}
        <span className="whitespace-nowrap text-[13px] font-bold text-iz-head-muted">
          {payLabel(order, t)} · <span className="font-extrabold tabular-nums text-iz-head-text">{formatNumber(order.price, intlTag)}</span>
        </span>
      </div>
    </div>
  );
}

/** A compact driver line (design: Arrived, OnTrip). */
export function DriverRow({ driver, phone, tone, sub, onCall, onMessage }: { driver: Driver; phone?: string; tone: "light" | "dark"; sub: string; onCall: () => void; onMessage: () => void }) {
  const { t, intlTag } = useT();
  const name = driver.name ? shortName(driver.name) : t("driver.unnamed");
  const rating = driver.rating > 0 ? ` · ${driver.rating.toLocaleString(intlTag, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : "";
  return (
    <div className="flex items-center gap-3">
      <DriverAvatar name={driver.name || t("driver.unnamed")} tone={tone} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-extrabold text-iz-ink">
          {name}
          {rating}
        </span>
        {sub && <span className={cn("truncate text-[13px]", tone === "light" ? "font-bold tracking-[0.5px] text-iz-ink" : "text-iz-muted")}>{sub}</span>}
      </div>
      <MessageButton phone={phone} onUnavailable={onMessage} tone="light" />
      <CallButton phone={phone} onUnavailable={onCall} outline={tone === "dark"} />
    </div>
  );
}

export type LiveAction = { key: string; icon: IconName; label: string; onClick: () => void; danger?: boolean };

/** O'zgartirish / Ulashish / Bekor qilish tiles; only the allowed ones. */
export function ActionTiles({ actions, compact }: { actions: LiveAction[]; compact?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onClick}
          className={cn(
            "flex min-w-0 items-center justify-center rounded-[18px] px-1 text-[12px] font-bold active:opacity-80",
            compact ? "h-14 gap-1.5" : "h-16 flex-col gap-1",
            a.danger ? "bg-iz-danger-soft text-iz-danger" : "bg-iz-field text-iz-ink"
          )}
        >
          <Icon name={a.icon} size={compact ? 16 : 18} className={cn("shrink-0", compact && "max-[379px]:hidden")} />
          <span className="max-w-full truncate">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Ring with the time left (design: Arrived, "Bepul kutish"). */
export function WaitRing({ fraction, label }: { fraction: number; label: string }) {
  const c = 2 * Math.PI * 36;
  const dash = Math.max(0, Math.min(1, fraction)) * c;
  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg aria-hidden width="84" height="84" viewBox="0 0 84 84" className="block">
        <circle cx="42" cy="42" r="36" fill="none" stroke="var(--iz-head-border)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r="36"
          fill="none"
          stroke="var(--iz-green)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 42 42)"
          className="transition-[stroke-dasharray] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[19px] font-extrabold tabular-nums text-iz-head-text">{label}</span>
    </div>
  );
}

// ── The drawn map (no Mapbox token): MapCanvas plus the live markers ──────

/** Points in MapCanvas's 0–100 viewBox: the approach to the pickup and the trip. */
const APPROACH: [number, number][] = [[71, 77], [47, 77], [47, 62], [28, 62]];
const TRIP: [number, number][] = [[28, 62], [47, 62], [47, 38], [71, 38], [70, 26]];

function along(path: [number, number][], f: number): [number, number] {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) {
      const k = seg[i] ? d / seg[i] : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= seg[i];
  }
  return path[path.length - 1];
}

/**
 * The drawn map for a live order, sized to the part above the sheet so the
 * route stays in view. The car follows the sample drive's progress.
 */
export function DrawnLiveMap({
  phase,
  progress,
  etaLabel,
  bottomInset,
}: {
  phase: "search" | "toPickup" | "arrived" | "trip" | "none";
  progress: DrawnProgress;
  etaLabel?: string;
  /** Height of the sheet over the map (px): the drawing fits above it. */
  bottomInset: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // MapCanvas draws with preserveAspectRatio "slice": same transform here.
  const scale = Math.max(size.w, size.h) / 100;
  const px = ([x, y]: [number, number]) => ({ left: (size.w - 100 * scale) / 2 + x * scale, top: (size.h - 100 * scale) / 2 + y * scale });

  let car: [number, number] | null = null;
  if (phase === "toPickup") car = along(APPROACH, progress?.leg === "to_pickup" ? progress.fraction : 0.25);
  else if (phase === "arrived") car = APPROACH[APPROACH.length - 1];
  else if (phase === "trip") car = along(TRIP, progress?.leg === "trip" ? progress.fraction : 0.4);
  const pickup = px(TRIP[0]);

  return (
    <div className="absolute inset-0 bg-iz-map">
      <div ref={ref} className="absolute inset-x-0 top-0" style={{ height: `max(240px, calc(100% - ${bottomInset}px + 24px))` }}>
        <MapCanvas route={phase !== "none"} className={cn("absolute inset-0", phase === "search" && "opacity-70")} />
        {size.w > 0 && phase !== "none" && phase !== "trip" && (
          <span
            aria-hidden
            className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-iz-map-pin bg-iz-green"
            style={pickup}
          />
        )}
        {size.w > 0 && car && (
          <div className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 transition-[left,top] duration-1000 ease-linear" style={px(car)}>
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-iz-head-text bg-iz-map-pin text-iz-head-text shadow-[0_6px_14px_var(--iz-shadow-strong)]">
              <Icon name="car" size={18} />
            </span>
          </div>
        )}
        {size.w > 0 && car && etaLabel && (
          <span
            aria-hidden
            className="absolute flex h-8 -translate-y-1/2 items-center whitespace-nowrap rounded-2xl bg-iz-map-pin px-3 text-[12px] font-extrabold text-iz-head-text transition-[left,top] duration-1000 ease-linear"
            style={{ left: px(car).left + 26, top: px(car).top }}
          >
            {etaLabel}
          </span>
        )}
      </div>
    </div>
  );
}
