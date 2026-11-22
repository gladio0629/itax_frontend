import type { ReactNode } from "react";
import type { Address, CarClass, CarClassId, Quote, Seat } from "@/api/types";
import type { OrderDraft } from "@/stores/orderStore";
import { formatNumber, formatSom, SOM_LABEL } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, PrimaryButton, Screen, SectionLabel, Steps } from "@/ui";
import { detailsSummary } from "@/features/order/addressDetails";
import standartImg from "@/assets/v2/class-standart.png";
import komfortImg from "@/assets/v2/class-komfort.png";
import biznesImg from "@/assets/v2/class-biznes.png";
import minivenImg from "@/assets/v2/class-miniven.png";
import { SeatPicker } from "./SeatPicker";

export type RoutePoint = "from" | "to" | { stop: string };

/** Car picture per class and its placement in the tile (design: Trip). */
const CLASS_ART: Record<CarClassId, { src: string; box: [number, number, number, number] }> = {
  standart: { src: standartImg, box: [-17, 6.7, 120, 51.3] },
  komfort: { src: komfortImg, box: [-18, 1.3, 121, 56.7] },
  biznes: { src: biznesImg, box: [-19, 6, 122, 52] },
  miniven: { src: minivenImg, box: [-22, 2.3, 125, 55.7] },
};

export function stepNames(t: (k: TranslationKey) => string) {
  return [t("trip.step.trip"), t("trip.step.payment"), t("trip.step.search")];
}

function Dot({ kind }: { kind: "from" | "stop" | "to" }) {
  if (kind === "to") return <span aria-hidden className="h-[13px] w-[13px] shrink-0 rounded-[4px] bg-iz-ink" />;
  return (
    <span
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-iz-ink", kind === "from" ? "bg-iz-green" : "bg-iz-sheet")}
    />
  );
}

function PointRow({
  kind,
  label,
  value,
  placeholder,
  sub,
  onPick,
  trailing,
}: {
  kind: "from" | "stop" | "to";
  label: string;
  value: string | null;
  placeholder: string;
  sub?: string;
  onPick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-[50px] items-center gap-3.5 border-b border-iz-divider-in-field">
      <Dot kind={kind} />
      <button type="button" onClick={onPick} className="flex min-w-0 flex-1 flex-col py-1.5 text-left active:opacity-70">
        <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
        <span className={cn("truncate text-[15px]", value ? "font-bold text-iz-ink" : "font-semibold text-iz-muted")}>{value ?? placeholder}</span>
        {sub && <span className="truncate text-[12px] text-iz-muted">{sub}</span>}
      </button>
      {trailing}
    </div>
  );
}

function ClassTile({ c, selected, onPick }: { c: CarClass; selected: boolean; onPick: () => void }) {
  const { t, intlTag } = useT();
  const art = CLASS_ART[c.id];
  const name = t(`class.${c.id}` as TranslationKey);
  const reason = c.reasonKey ? t(c.reasonKey as TranslationKey) : t("class.reason.unavailable");
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!c.available}
      aria-label={c.available ? t("trip.classLabel", { name, price: formatSom(c.price, intlTag) }) : t("trip.classUnavailable", { name, reason })}
      onClick={onPick}
      className={cn("relative h-[112px] w-[106px] shrink-0 snap-start overflow-hidden rounded-[18px] text-left disabled:opacity-50", selected && "bg-iz-field")}
    >
      <span className="absolute left-0 top-0 h-[62px] w-[106px] [mask-image:linear-gradient(to_right,transparent_0px,#000_34px)]">
        <img
          src={art.src}
          alt=""
          className={cn("absolute max-w-none", !selected && "opacity-[0.42] saturate-[0.35]")}
          style={{ left: art.box[0], top: art.box[1], width: art.box[2], height: art.box[3] }}
        />
      </span>
      {selected ? (
        <span aria-hidden className="absolute right-[5px] top-[5px] flex h-5 w-5 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
          <Icon name="check" size={13} strokeWidth={3} />
        </span>
      ) : c.id === "biznes" ? (
        <span aria-hidden className="absolute right-[5px] top-[5px] flex h-5 w-5 items-center justify-center rounded-full bg-iz-badge-gold text-iz-badge-gold-fg shadow-[0_2px_6px_var(--iz-shadow)]">
          <Icon name="starSharp" size={12} filled />
        </span>
      ) : c.id === "miniven" ? (
        <span aria-hidden className="absolute right-[5px] top-[5px] flex h-5 w-5 items-center justify-center rounded-full bg-iz-badge-blue text-iz-badge-blue-fg shadow-[0_2px_6px_var(--iz-shadow)]">
          <Icon name="seats" size={14} filled />
        </span>
      ) : null}
      <span className="absolute left-2.5 top-[50px] text-[12px] font-medium text-iz-muted">{t("class.seats", { n: c.seats })}</span>
      <span className="absolute left-2.5 top-[66px] text-[14px] font-semibold text-iz-muted">{name}</span>
      <span className="absolute left-2.5 top-[84px] whitespace-nowrap text-iz-ink">
        {c.available ? (
          <>
            <span className="text-[15px] font-extrabold tabular-nums">{formatNumber(c.price, intlTag)}</span>
            <span className="text-[11px] font-bold"> {SOM_LABEL}</span>
          </>
        ) : (
          <span className="text-[11px] font-bold text-iz-muted">{reason}</span>
        )}
      </span>
    </button>
  );
}

type Load<T> = { status: "loading" } | { status: "error" } | { status: "success"; data: T };

/**
 * Step 1 of the passenger order (design: Trip): route with up to N stops,
 * seat picker, car class, "Bagaj va izoh", price from the server.
 */
export function TripScreen({
  draft,
  from,
  to,
  stops,
  maxStops,
  seats,
  classes,
  quote,
  quoteReady,
  onRetryQuote,
  onRetryClasses,
  onPick,
  onRemoveStop,
  onAddStop,
  onDetails,
  onSeats,
  onClass,
  onExtras,
  onRetrySeats,
  onContinue,
  onBack,
}: {
  draft: OrderDraft;
  from: Address | null;
  to: Address | null;
  stops: (Address | undefined)[];
  /** null: no limit known yet; 0: stops not offered. */
  maxStops: number | null;
  seats: Load<Seat[]>;
  classes: Load<CarClass[]>;
  quote: Load<Quote>;
  /** The quote matches what is on screen (false while re-pricing). */
  quoteReady: boolean;
  onRetryQuote: () => void;
  onRetryClasses: () => void;
  onPick: (p: RoutePoint) => void;
  onRemoveStop: (uid: string) => void;
  onAddStop: () => void;
  onDetails?: (p: RoutePoint) => void;
  onSeats: (mode: OrderDraft["mode"], seatIds: string[]) => void;
  onClass: (id: CarClassId) => void;
  onExtras: () => void;
  onRetrySeats: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t, intlTag } = useT();
  const needSeats = draft.mode === "seat" && draft.seatIds.length === 0;
  const canContinue = !!from && !!to && !needSeats && quote.status === "success" && quoteReady;

  const detailsButton = (p: RoutePoint, place: string | undefined) =>
    onDetails && place ? (
      <button
        type="button"
        onClick={() => onDetails(p)}
        aria-label={t("trip.details", { place })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-iz-muted active:bg-iz-sheet"
      >
        <Icon name="building" size={18} />
      </button>
    ) : null;

  const extrasParts: string[] = [];
  if (draft.luggage > 0) extrasParts.push(t("trip.extrasBags", { n: draft.luggage }));
  if (draft.comment.trim()) extrasParts.push(t("trip.extrasNote"));
  if (draft.rider.kind === "other" && draft.rider.name.trim()) extrasParts.push(t("trip.extrasFor", { name: draft.rider.name.trim() }));

  const footer = (
    <div className="flex flex-col gap-1">
      {needSeats && <span className="text-center text-[13px] font-semibold text-iz-muted">{t("trip.pickSeat")}</span>}
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 flex-col gap-0.5" aria-live="polite">
          <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("trip.price")}</span>
          <span className="whitespace-nowrap text-[20px] font-extrabold tabular-nums text-iz-ink">
            {quote.status === "success" ? formatSom(quote.data.total, intlTag) : quote.status === "error" ? "—" : "…"}
          </span>
        </div>
        <PrimaryButton className="flex-1" disabled={!canContinue} onClick={onContinue}>
          {t("trip.continue")}
        </PrimaryButton>
      </div>
      {quote.status === "error" && (
        <button type="button" onClick={onRetryQuote} role="alert" className="flex h-11 items-center justify-center gap-2 text-[13px] font-bold text-iz-danger">
          <Icon name="refresh" size={16} />
          {t("trip.priceFailed")} · {t("common.retry")}
        </button>
      )}
    </div>
  );

  return (
    <Screen title={t("trip.title")} onBack={onBack} top={<Steps steps={stepNames(t)} current={0} label={t("trip.steps")} />} footer={footer} bodyClassName="gap-3.5 pt-[18px]">
      <div className="flex shrink-0 flex-col rounded-iz-card bg-iz-field py-1 pl-4 pr-2">
        <PointRow
          kind="from"
          label={t("home.fromLabel")}
          value={from?.label ?? null}
          placeholder={t("home.fromPlaceholder")}
          sub={detailsSummary(draft.fromDetails, t) || undefined}
          onPick={() => onPick("from")}
          trailing={detailsButton("from", from?.label)}
        />
        {draft.stops.map((st, i) => (
          <PointRow
            key={st.uid}
            kind="stop"
            label={t("trip.stopLabel", { n: i + 1 })}
            value={stops[i]?.label ?? null}
            placeholder={t("home.toPlaceholder")}
            sub={detailsSummary(st.details, t) || undefined}
            onPick={() => onPick({ stop: st.uid })}
            trailing={
              <>
                {detailsButton({ stop: st.uid }, stops[i]?.label)}
                <button
                  type="button"
                  onClick={() => onRemoveStop(st.uid)}
                  aria-label={t("trip.removeStop", { n: i + 1 })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-iz-ink active:bg-iz-sheet"
                >
                  <Icon name="close" size={16} />
                </button>
              </>
            }
          />
        ))}
        <PointRow
          kind="to"
          label={t("home.toLabel")}
          value={to?.label ?? null}
          placeholder={t("home.toPlaceholder")}
          sub={detailsSummary(draft.toDetails, t) || undefined}
          onPick={() => onPick("to")}
          trailing={detailsButton("to", to?.label)}
        />
        {maxStops !== 0 && (
          <button
            type="button"
            onClick={onAddStop}
            disabled={maxStops != null && draft.stops.length >= maxStops}
            className="flex h-11 items-center gap-3 text-[14px] font-extrabold text-iz-green-text disabled:text-iz-muted"
          >
            <Icon name="plus" size={16} />
            {t("trip.addStop")}
            {maxStops != null && (
              <span className="ml-auto mr-2 text-[12px] font-bold text-iz-muted">{t("trip.stopsCount", { n: draft.stops.length, max: maxStops })}</span>
            )}
          </button>
        )}
      </div>

      {seats.status === "success" ? (
        <SeatPicker seats={seats.data} mode={draft.mode} seatIds={draft.seatIds} onChange={onSeats} />
      ) : seats.status === "error" ? (
        <button type="button" onClick={onRetrySeats} className="flex h-11 items-center gap-2 self-start text-[14px] font-bold text-iz-danger">
          <Icon name="refresh" size={18} />
          {t("seats.loadFailed")} · {t("common.retry")}
        </button>
      ) : (
        <div aria-busy="true" aria-label={t("state.loading")} className="h-[520px] animate-pulse rounded-iz-card bg-iz-skeleton" />
      )}

      <section className="flex shrink-0 flex-col gap-2" aria-label={t("trip.classTitle")}>
        <SectionLabel as="h2">{t("trip.classTitle")}</SectionLabel>
        <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-1 overflow-x-auto px-5">
          {classes.status === "success" ? (
            classes.data.map((c) => <ClassTile key={c.id} c={c} selected={draft.carClass === c.id} onPick={() => onClass(c.id)} />)
          ) : classes.status === "error" ? (
            <button type="button" onClick={onRetryClasses} className="flex h-11 items-center gap-2 text-[14px] font-bold text-iz-danger">
              <Icon name="refresh" size={18} />
              {t("state.error.title")} · {t("common.retry")}
            </button>
          ) : (
            Array.from({ length: 4 }, (_, i) => <span key={i} className="h-[112px] w-[106px] shrink-0 animate-pulse rounded-[18px] bg-iz-skeleton" />)
          )}
        </div>
      </section>

      <button type="button" onClick={onExtras} className="flex h-[68px] shrink-0 items-center gap-3 rounded-iz-field bg-iz-field pl-3 pr-3.5 text-left active:opacity-80">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-iz-sheet text-iz-ink">
            <Icon name="luggage" size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("trip.extrasTitle")}</span>
            <span className="truncate text-[14px] font-extrabold text-iz-ink">{extrasParts.length ? extrasParts.join(" · ") : t("trip.extrasEmpty")}</span>
          </span>
          <Icon name="chevronRight" size={18} className="shrink-0 text-iz-muted" />
        </button>
    </Screen>
  );
}
