// Pieces shared by the request and trip screens (design v2).
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { platform } from "@/lib/native";
import { getDevicePrefs } from "@/lib/devicePrefs";
import { api } from "@/api/client";
import type { OfferPlace, PassengerInfo, Place, PriceLine, TripPlace } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { formatAmount } from "@/lib/format";
import { MessageCircle, Phone, Star, type LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { PlaceDetails } from "@/features/home/RouteLine";

// ------------------------------------------------------------ route line

export type RoutePoint = { kind: "pickup" | "stop" | "dropoff"; label: string; place: OfferPlace | TripPlace | Place; details?: boolean };

/** Vertical route: green ring (pickup), grey ring (stops), Ink square (drop-off), dotted between. */
export function RouteTimeline({ points, compact }: { points: RoutePoint[]; compact?: boolean }) {
  return (
    <ol className="flex flex-col">
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <li key={i} className="relative flex gap-3">
            <span className="relative flex w-3.5 shrink-0 flex-col items-center" aria-hidden="true">
              <span
                className={cn(
                  "mt-1 shrink-0",
                  p.kind === "pickup" && "h-3.5 w-3.5 rounded-full border-[3px] border-brand-ink bg-surface ring-2 ring-brand-soft",
                  p.kind === "stop" && "h-3 w-3 rounded-full border-2 border-muted bg-surface",
                  p.kind === "dropoff" && "h-3 w-3 rounded-[3px] bg-ink"
                )}
              />
              {!last && <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-line" />}
            </span>
            <span className={cn("flex min-w-0 flex-col gap-0.5", !last && (compact ? "pb-2" : "pb-3.5"))}>
              <span className="label-caps text-muted">{p.label}</span>
              <span className={cn("font-bold text-ink", compact ? "text-15 leading-5" : "text-base leading-[22px]")}>
                {p.place.address}
                {p.place.city.name && !p.place.address.includes(p.place.city.name) ? `, ${p.place.city.name}` : ""}
              </span>
              {p.details && <PlaceDetails place={p.place} />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------ chips

/** Pill on the Ink top: icon + text (distance, duration, payment). */
export function NightChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-night-2 px-3 text-13 font-bold text-white">
      <Icon className="h-4 w-4 text-brand" />
      {children}
    </span>
  );
}

// ------------------------------------------------------------ people

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Ink circle with the first letter (passenger) or green with initials (the driver). */
export function Monogram({ name, size = 52, tone = "night" }: { name: string; size?: number; tone?: "night" | "brand" }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-full font-extrabold", tone === "night" ? "bg-night text-white dark:bg-night-line" : "bg-brand text-on-brand")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {tone === "night" ? name.trim()[0]?.toUpperCase() ?? "?" : initials(name)}
    </span>
  );
}

/**
 * Passenger row: monogram, name + rating, a line under it, then call (only
 * with a dialable number from the server) and chat (when the backend has it).
 */
export function PassengerRow({ passenger, subtitle, bookingId }: { passenger: PassengerInfo; subtitle?: ReactNode; bookingId: string }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3.5">
      <Monogram name={passenger.name} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-17 font-extrabold text-ink">{passenger.name}</span>
          {passenger.rating > 0 && (
            <span className="tabular flex shrink-0 items-center gap-1 text-13 font-bold text-muted">
              <Star className="h-3.5 w-3.5 fill-star text-star" />
              {passenger.rating.toFixed(1)}
            </span>
          )}
        </span>
        {subtitle && <span className="truncate text-13 font-semibold text-muted">{subtitle}</span>}
      </span>
      {passenger.callNumber && (
        <a
          href={`tel:${passenger.callNumber.replace(/[^\d+]/g, "")}`}
          aria-label={t("trip.callName", { name: passenger.name })}
          className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
        >
          <Phone className="h-5 w-5" />
        </a>
      )}
      {api.capabilities.tripChat && (
        <Link
          to={`/trip/chat/${bookingId}`}
          aria-label={t("trip.chatName", { name: passenger.name })}
          className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-raised text-ink"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

// ------------------------------------------------------------ money

/** The server's price lines, then "Sizga qoladi". Unknown keys show without a label. */
export function PriceLines({ lines, net }: { lines: PriceLine[]; net?: number }) {
  const { t } = useT();
  const label = (l: PriceLine) => {
    if (l.key === "commission") return l.pct != null ? t("price.commission", { pct: l.pct }) : t("price.commissionNoPct");
    const k = `price.${l.key}`;
    return isKey(k) ? t(k) : "";
  };
  return (
    <dl className="flex flex-col">
      {lines.map((l, i) => (
        <div key={i} className="flex min-h-[44px] items-center justify-between gap-3 border-b border-line">
          <dt className="text-sm font-semibold text-muted">{label(l)}</dt>
          <dd className={cn("tabular text-15 font-bold", l.amount < 0 ? "text-danger" : "text-ink")}>{formatAmount(l.amount, { signed: l.amount < 0 || l.key !== "trip" })}</dd>
        </div>
      ))}
      {net != null && (
        <div className="flex min-h-[48px] items-center justify-between gap-3">
          <dt className="text-15 font-bold text-ink">{t("price.net")}</dt>
          <dd className="tabular text-17 font-extrabold text-brand-ink">
            {formatAmount(net)} {t("common.som")}
          </dd>
        </div>
      )}
    </dl>
  );
}

// ------------------------------------------------------------ time

/** Re-renders every second while `active`. */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** mm:ss */
export const clock = (sec: number) => `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

/** Ring that empties as `ratio` goes 1 → 0, with a label in the middle. */
export function Ring({ ratio, size, stroke = 7, tone = "brand", track, children }: { ratio: number; size: number; stroke?: number; tone?: "brand" | "warning"; track: string; children: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === "brand" ? "rgb(var(--color-brand-rgb))" : "var(--color-warning-icon)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ratio)))}
          style={{ transition: "stroke-dashoffset 900ms linear" }}
        />
      </svg>
      <span className="relative flex flex-col items-center">{children}</span>
    </span>
  );
}

// ------------------------------------------------------------ navigator

/**
 * Opens a navigator at a place, as chosen in Sozlamalar → Navigator: the
 * phone's choice (geo: on Android, Apple Maps on iOS), Yandex Navigator or
 * Google Maps. App links only, no web request; without coordinates the
 * address goes to the phone's choice.
 */
export function navigatorHref(place: Place): string {
  const app = getDevicePrefs().navigator;
  const has = place.lat != null && place.lng != null;
  const ios = platform() === "ios";
  if (has && app === "yandex") return `yandexnavi://build_route_on_map?lat_to=${place.lat}&lon_to=${place.lng}`;
  if (has && app === "google") return ios ? `comgooglemaps://?daddr=${place.lat},${place.lng}&directionsmode=driving` : `google.navigation:q=${place.lat},${place.lng}`;
  const q = has ? `${place.lat},${place.lng}` : encodeURIComponent(`${place.address}, ${place.city.name}`);
  return ios ? `maps:?daddr=${q}` : `geo:0,0?q=${q}`;
}

/** "a · b · c" from the parts that exist. */
export function joinDots(parts: Array<ReactNode | null | undefined | false>): ReactNode {
  const list = parts.filter((p): p is ReactNode => p != null && p !== false && p !== "");
  return list.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && " · "}
      {p}
    </Fragment>
  ));
}
