import type { OfferPlace, Place, TripPlace } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { KeyRound } from "@/lib/icons";
import { detailsText } from "./orderText";

type AnyPlace = Place | OfferPlace | TripPlace;

/**
 * Pickup → stops → dropoff, stacked, with a dotted connector. City is the
 * glance line; podyezd/qavat/kvartira and the intercom code sit under the
 * address when the adapter sends them.
 */
export function RouteLine({
  pickup,
  dropoff,
  stops = [],
  pickupLabel,
  dropoffLabel,
  stopLabel,
  size = "lg",
  showEndLabels = false,
}: {
  pickup: AnyPlace;
  dropoff: AnyPlace;
  stops?: AnyPlace[];
  pickupLabel: string;
  dropoffLabel: string;
  /** Visible label for the n-th stop (1-based). */
  stopLabel?: (n: number) => string;
  size?: "lg" | "md";
  /** Show the pickup/dropoff labels (cargo: "Yuklash" / "2-tushirish"), not just to screen readers. */
  showEndLabels?: boolean;
}) {
  const city = size === "lg" ? "text-lg" : "text-base";
  const points = [
    { p: pickup, label: pickupLabel, kind: "end" as const, dot: "bg-yellow ring-4 ring-yellow/20" },
    ...stops.map((p, i) => ({ p, label: stopLabel?.(i + 1) ?? "", kind: "stop" as const, dot: "" })),
    { p: dropoff, label: dropoffLabel, kind: "end" as const, dot: "bg-ink ring-4 ring-ink/15" },
  ];
  return (
    <ol className="relative space-y-3">
      <span aria-hidden="true" className="absolute bottom-[22px] left-[7px] top-[22px] border-l-2 border-dotted border-ink/25" />
      {points.map(({ p, label, kind, dot }, i) => (
        <li key={i} className="relative flex items-start gap-3">
          {kind === "stop" ? (
            <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-surface ring-2 ring-ink/60" />
            </span>
          ) : (
            <span aria-hidden="true" className={`mt-1.5 h-4 w-4 shrink-0 rounded-full ${dot}`} />
          )}
          <div className="min-w-0 flex-1">
            {kind === "stop" ? (
              <p className="truncate text-sm text-ink">
                <span className="text-muted">{label} · </span>
                {p.address}, {p.city.name}
              </p>
            ) : (
              <>
                {showEndLabels ? <p className="text-xs text-muted">{label}</p> : <span className="sr-only">{label}: </span>}
                <p className={`truncate font-bold text-ink ${city}`}>{p.city.name}</p>
                <p className="truncate text-sm text-muted">{p.address}</p>
              </>
            )}
            <PlaceDetails place={p} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Podyezd · qavat · kvartira, then the intercom (or a note that it comes after accepting). */
export function PlaceDetails({ place }: { place: AnyPlace }) {
  const { t } = useT();
  const d = "details" in place ? place.details : undefined;
  if (!d) return null;
  const line = detailsText(d, t);
  const intercom = "intercom" in d ? d.intercom : undefined;
  const later = "intercomOnAccept" in d && d.intercomOnAccept;
  return (
    <>
      {line && <p className="tabular text-sm text-ink">{line}</p>}
      {intercom ? (
        <p className="tabular mt-1 inline-flex h-7 items-center gap-1.5 rounded-button bg-yellow/15 px-2 text-sm font-bold text-gold">
          <KeyRound className="h-4 w-4" />
          {t("addr.intercom", { v: intercom })}
        </p>
      ) : later ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          {t("addr.intercomLater")}
        </p>
      ) : null}
    </>
  );
}
