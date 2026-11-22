import { useRef, useState } from "react";
import type { Address, CargoRules, CargoTab, DeliveryVehicle, DeliveryVehicleSpec, Quote } from "@/api/types";
import type { OrderDraft } from "@/stores/orderStore";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, Screen, Segmented, Steps, TextAreaField } from "@/ui";
import { detailsSummary } from "@/features/order/addressDetails";
import { PriceFooter } from "@/features/trip/PriceFooter";
import bodyS from "@/assets/v2/body-s.jpg";
import bodyM from "@/assets/v2/body-m.jpg";
import bodyL from "@/assets/v2/body-l.jpg";
import bodyXl from "@/assets/v2/body-xl.jpg";
import bodyXxl from "@/assets/v2/body-xxl.jpg";
import body3xl from "@/assets/v2/body-3xl.jpg";
import { InfoButton } from "./CargoSheets";

/** The design's body pictures, by the server's size label. */
const BODY_ART: Record<string, string> = { S: bodyS, M: bodyM, L: bodyL, XL: bodyXl, XXL: bodyXxl, "3XL": body3xl };

type Load<T> = { status: "loading" } | { status: "error" } | { status: "success"; data: T };

/** Drop-off i of n: the extra drop-offs first, "Qayerga" last (route order). */
export type DropRef = { kind: "stop"; uid: string } | { kind: "to" };

export function CargoRouteCard({
  draft,
  from,
  drops,
  maxExtra,
  onPickFrom,
  onPickDrop,
  onAddDrop,
  onRemoveDrop,
  onDetails,
  onSwap,
  onReorder,
  lockLast,
}: {
  draft: OrderDraft;
  from: Address | null;
  /** In route order, with their addresses. */
  drops: { ref: DropRef; address: Address | null; details?: OrderDraft["toDetails"] }[];
  /** null: unknown; 0: no extra drop-offs on this tab. */
  maxExtra: number | null;
  onPickFrom: () => void;
  onPickDrop: (ref: DropRef) => void;
  onAddDrop: () => void;
  onRemoveDrop: (ref: DropRef) => void;
  onDetails?: (ref: DropRef | "from") => void;
  /** Reverse the route (pickup ↔ last drop-off); unset where it can't (warehouse). */
  onSwap?: () => void;
  /** Move drop-off `from` to place `to` (indexes in `drops`). */
  onReorder?: (from: number, to: number) => void;
  /** The last drop-off stays last (Marketpleys: the warehouse). */
  lockLast?: boolean;
}) {
  const { t } = useT();
  const extras = drops.length - 1;
  const movable = onReorder && drops.length > 1 ? (lockLast ? drops.length - 1 : drops.length) : 0;
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<{ index: number; startY: number; dy: number; heights: number[] } | null>(null);
  const [announce, setAnnounce] = useState("");

  /** Where the dragged row would land: its centre against the others'. */
  function targetIndex(d: NonNullable<typeof drag>) {
    const tops = d.heights.map((_, i) => d.heights.slice(0, i).reduce((a, b) => a + b, 0));
    const centre = tops[d.index] + d.heights[d.index] / 2 + d.dy;
    let to = d.index;
    if (d.dy > 0) for (let i = d.index + 1; i < movable; i++) if (centre > tops[i] + d.heights[i] / 2) to = i;
    if (d.dy < 0) for (let i = d.index - 1; i >= 0; i--) if (centre < tops[i] + d.heights[i] / 2) to = i;
    return to;
  }
  function move(fromIndex: number, to: number) {
    if (to === fromIndex || to < 0 || to >= movable) return;
    onReorder?.(fromIndex, to);
    setAnnounce(t("cargo.v2.moved", { n: to + 1 }));
  }
  const target = drag ? targetIndex(drag) : -1;

  const detailsBtn = (point: DropRef | "from", place?: string) =>
    onDetails && place ? (
      <button
        type="button"
        onClick={() => onDetails(point)}
        aria-label={t("trip.details", { place })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-iz-muted active:bg-iz-sheet"
      >
        <Icon name="building" size={18} />
      </button>
    ) : null;
  return (
    <div className="flex shrink-0 flex-col rounded-iz-card bg-iz-field py-1 pl-4 pr-2">
      <div className="flex min-h-[50px] items-center gap-3.5 border-b border-iz-divider-in-field">
        <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-iz-ink bg-iz-green" />
        <button type="button" onClick={onPickFrom} className="flex min-w-0 flex-1 flex-col py-1.5 text-left active:opacity-70">
          <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("cargo.v2.pickup")}</span>
          <span className={cn("truncate text-[15px]", from ? "font-bold text-iz-ink" : "font-semibold text-iz-muted")}>{from?.label ?? t("home.fromPlaceholder")}</span>
          {detailsSummary(draft.fromDetails, t) && <span className="truncate text-[12px] text-iz-muted">{detailsSummary(draft.fromDetails, t)}</span>}
        </button>
        {detailsBtn("from", from?.label)}
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            disabled={!draft.toAddressId}
            aria-label={t("home.swap")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-iz-sheet text-iz-ink shadow-[0_4px_12px_var(--iz-shadow)] disabled:opacity-40"
          >
            <Icon name="swap" size={18} />
          </button>
        )}
      </div>
      {drops.map((d, i) => {
        let shift = 0;
        if (drag && i !== drag.index) {
          const h = drag.heights[drag.index];
          if (i > drag.index && i <= target) shift = -h;
          else if (i < drag.index && i >= target) shift = h;
        }
        const dragging = drag?.index === i;
        const canMove = i < movable;
        return (
          <div
            key={d.ref.kind === "stop" ? d.ref.uid : "to"}
            ref={(el) => (rowRefs.current[i] = el)}
            style={{ transform: `translateY(${dragging ? drag.dy : shift}px)` }}
            className={cn(
              "relative flex min-h-[50px] items-center gap-3.5 border-b border-iz-divider-in-field bg-iz-field",
              dragging ? "z-10 rounded-iz-tile shadow-[0_8px_20px_var(--iz-shadow)]" : drag ? "transition-transform duration-150" : ""
            )}
          >
            <span aria-hidden className="h-[13px] w-[13px] shrink-0 rounded-[4px] bg-iz-ink" />
            <button type="button" onClick={() => onPickDrop(d.ref)} className="flex min-w-0 flex-1 flex-col py-1.5 text-left active:opacity-70">
              <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("cargo.v2.drop", { n: i + 1 })}</span>
              <span className={cn("truncate text-[15px]", d.address ? "font-bold text-iz-ink" : "font-semibold text-iz-muted")}>
                {d.address?.label ?? (draft.cargo.tab === "marketplace" && d.ref.kind === "to" ? t("kargo.chooseWarehouse") : t("home.toPlaceholder"))}
              </span>
              {detailsSummary(d.details, t) && <span className="truncate text-[12px] text-iz-muted">{detailsSummary(d.details, t)}</span>}
            </button>
            {detailsBtn(d.ref, d.address?.label)}
            {extras > 0 && (
              <button
                type="button"
                onClick={() => onRemoveDrop(d.ref)}
                aria-label={t("cargo.v2.removeDrop", { n: i + 1 })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-iz-ink active:bg-iz-sheet"
              >
                <Icon name="close" size={16} />
              </button>
            )}
            {movable > 1 &&
              (canMove ? (
                <button
                  type="button"
                  aria-label={t("cargo.v2.reorder", { n: i + 1 })}
                  aria-describedby="cargo-reorder-hint"
                  className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-iz-muted active:cursor-grabbing"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      move(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                    }
                  }}
                  onPointerDown={(e) => {
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    const heights = drops.map((_, k) => rowRefs.current[k]?.offsetHeight ?? 50);
                    setDrag({ index: i, startY: e.clientY, dy: 0, heights });
                  }}
                  onPointerMove={(e) => {
                    if (!drag || drag.index !== i) return;
                    const before = drag.heights.slice(0, i).reduce((a, b) => a + b, 0);
                    const after = drag.heights.slice(i + 1, movable).reduce((a, b) => a + b, 0);
                    setDrag({ ...drag, dy: Math.max(-before, Math.min(after, e.clientY - drag.startY)) });
                  }}
                  onPointerUp={() => {
                    if (!drag) return;
                    const to = targetIndex(drag);
                    setDrag(null);
                    move(drag.index, to);
                  }}
                  onPointerCancel={() => setDrag(null)}
                >
                  <Icon name="grip" size={18} />
                </button>
              ) : (
                <span aria-hidden className="w-9 shrink-0" />
              ))}
          </div>
        );
      })}
      {movable > 1 && (
        <>
          <span id="cargo-reorder-hint" className="sr-only">
            {t("cargo.v2.reorderHint")}
          </span>
          <span className="sr-only" aria-live="polite">
            {announce}
          </span>
        </>
      )}
      {maxExtra !== 0 && (
        <button
          type="button"
          onClick={onAddDrop}
          disabled={!draft.toAddressId || (maxExtra != null && extras >= maxExtra)}
          className="flex h-11 items-center gap-3 text-[14px] font-extrabold text-iz-green-text disabled:text-iz-muted"
        >
          <Icon name="plus" size={16} />
          {t("cargo.v2.addDrop")}
          {maxExtra != null && <span className="ml-auto mr-2 text-[12px] font-bold text-iz-muted">{t("trip.stopsCount", { n: extras, max: maxExtra })}</span>}
        </button>
      )}
    </div>
  );
}

/**
 * Delivery, step 1 (design: Cargo): scope (Shahar ichi / Shaharlararo /
 * Marketpleys), pickup and drop-offs, body size S–3XL with the server's
 * size, max weight and description, price from the server.
 */
export function CargoScreen({
  draft,
  stepNames,
  current,
  rules,
  rulesError,
  onRetryRules,
  vehicles,
  route,
  quote,
  quoteReady,
  quoteError,
  onRetryQuote,
  onRetryVehicles,
  onTab,
  onVehicle,
  onNote,
  showNote,
  onInfo,
  onNext,
  onBack,
}: {
  draft: OrderDraft;
  stepNames: string[];
  current: number;
  rules: CargoRules | null;
  /** The Kargo rules (tabs, limits) failed to load. */
  rulesError?: boolean;
  onRetryRules?: () => void;
  vehicles: Load<DeliveryVehicleSpec[]>;
  route: React.ReactNode;
  quote: Load<Quote>;
  quoteReady: boolean;
  quoteError: string | null;
  onRetryQuote: () => void;
  onRetryVehicles: () => void;
  onTab: (tab: CargoTab) => void;
  onVehicle: (v: DeliveryVehicle) => void;
  onNote: (note: string) => void;
  /** No contacts step (backend without cargo extras): the note lives here. */
  showNote: boolean;
  onInfo?: (topic: "body") => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t, intlTag } = useT();
  const tab = draft.cargo.tab ?? rules?.defaultTab ?? "intercity";
  const spec = vehicles.status === "success" ? vehicles.data.find((v) => v.id === draft.cargo.vehicle) : undefined;
  const dims = spec ? `${spec.dimensionsCm.width} × ${spec.dimensionsCm.depth} × ${spec.dimensionsCm.height}` : "";

  return (
    <Screen
      title={t("cargo.v2.title")}
      onBack={onBack}
      top={<Steps steps={stepNames} current={current} label={t("trip.steps")} />}
      bodyClassName="gap-3 pt-[18px]"
      footer={
        <PriceFooter
          quote={quote}
          ready={quoteReady}
          label={t("trip.continue")}
          onNext={onNext}
          disabled={!draft.fromAddressId || !draft.toAddressId}
          error={quoteError}
          onRetry={onRetryQuote}
        />
      }
    >
      {rulesError && (
        <button type="button" onClick={onRetryRules} className="flex h-11 shrink-0 items-center gap-2 self-start text-[14px] font-bold text-iz-danger">
          <Icon name="refresh" size={18} />
          {t("common.loadFailedRetry")}
        </button>
      )}
      {rules && (
        <Segmented
          label={t("kargo.tabs.label")}
          value={tab}
          onChange={onTab}
          className="h-[52px] [&>button]:text-[13px]"
          options={rules.tabs.map((x) => ({ value: x.id, label: t(x.labelKey as TranslationKey) }))}
        />
      )}

      {route}

      {vehicles.status === "error" ? (
        <button type="button" onClick={onRetryVehicles} className="flex h-11 items-center gap-2 self-start text-[14px] font-bold text-iz-danger">
          <Icon name="refresh" size={18} />
          {t("cargo.loadError")} · {t("common.retry")}
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col overflow-hidden rounded-iz-card bg-iz-field">
            {spec && BODY_ART[spec.sizeLabel] ? (
              <img src={BODY_ART[spec.sizeLabel]} alt={t("cargo.v2.bodyAlt", { dims })} width={350} height={140} className="block h-[140px] w-full object-contain" />
            ) : (
              <span aria-hidden className="block h-[140px] w-full animate-pulse bg-iz-skeleton" />
            )}
            <div className="flex flex-col items-center gap-0.5 px-4 pb-3 text-center" aria-live="polite">
              <span className="text-[13px] font-semibold text-iz-muted">{spec ? t(spec.descKey as TranslationKey) : " "}</span>
              <span className="text-[13px] font-extrabold text-iz-ink">{spec ? t("cargo.maxWeight", { kg: formatNumber(spec.maxWeightKg, intlTag) }) : " "}</span>
              {dims && <span className="text-[12px] text-iz-muted">{t("cargo.dimensions", { dims })}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[15px] font-extrabold text-iz-ink">{t("cargo.v2.body")}</span>
            <div role="radiogroup" aria-label={t("cargo.v2.bodySize")} className="grid h-11 flex-1 gap-0.5 rounded-[22px] bg-iz-field p-1" style={{ gridTemplateColumns: `repeat(${vehicles.status === "success" ? vehicles.data.length : 6}, minmax(0, 1fr))` }}>
              {vehicles.status === "success"
                ? vehicles.data.map((v) => {
                    const on = v.id === draft.cargo.vehicle;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={t("cargo.v2.bodyPick", { size: v.sizeLabel })}
                        onClick={() => onVehicle(v.id)}
                        className={cn("min-w-0 rounded-[18px] text-[13px]", on ? "bg-iz-selected font-extrabold text-iz-on-selected" : "font-bold text-iz-muted")}
                      >
                        {v.sizeLabel}
                      </button>
                    );
                  })
                : null}
            </div>
            {onInfo && <InfoButton label={t("cargo.v2.info", { topic: t("kargo.info.body.chip") })} onClick={() => onInfo("body")} />}
          </div>
        </div>
      )}

      {showNote && (
        <TextAreaField
          label={t("cargo.v2.note")}
          placeholder={t("cargo.v2.notePlaceholder")}
          value={draft.cargo.note ?? ""}
          onChange={(e) => onNote(e.target.value)}
        />
      )}
    </Screen>
  );
}
