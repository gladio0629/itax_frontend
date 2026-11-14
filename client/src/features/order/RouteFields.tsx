import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, GripVertical, Plus, X } from "@/lib/icons";
import type { Address } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export type RouteTarget = "from" | "to" | { stop: string };

export type RouteStopItem = {
  uid: string;
  address: Address | null;
  /** detailsSummary() of the stop's Tafsilotlar, "" when empty. */
  detailsLine: string;
};

/** Past this many px to the left, a swipe removes the stop on release. */
const SWIPE_REMOVE_PX = 88;

function PointButton({
  dot,
  label,
  value,
  detailsLine,
  wrap,
  onClick,
}: {
  /** null: the row draws its own marker (a stop's grip) in the dot column. */
  dot: ReactNode | null;
  /** Let a long label take two lines instead of truncating. */
  wrap?: boolean;
  label: string;
  value: string;
  detailsLine?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2 pr-2 text-left hover:bg-ink/5", dot ? "pl-2" : "pl-1")}
    >
      {dot}
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink/60">{label}</span>
        <span className={cn("text-sm font-semibold text-ink", wrap ? "line-clamp-2" : "block truncate")}>{value}</span>
        {detailsLine && <span className="line-clamp-2 text-xs text-ink/60">{detailsLine}</span>}
      </span>
    </button>
  );
}

function DetailsButton({ filled, place, onClick }: { filled: boolean; place: string; onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("details.buttonFor", { place })}
      className="group flex h-11 shrink-0 items-center"
    >
      <span
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
          filled ? "bg-accent text-bg" : "bg-card text-accent shadow-softer ios:bg-[var(--ios-fill-tertiary)]"
        )}
      >
        {t("details.button")}
      </span>
    </button>
  );
}

const fromDot = <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />;
const toDot = <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-yellow ring-1 ring-on-yellow/40" aria-hidden="true" />;

/**
 * Qayerdan, the stops, Qayerga. The swap control never covers a row's hit
 * area: it sits in its own column, or — with stops enabled — at the end of
 * the add-stop row between the points. Every row is a div of sibling
 * buttons, no nesting.
 *
 * The stop props are optional: without them this is the plain from/to pair
 * (the track screen's sheet uses it that way).
 */
export function RouteFields({
  from,
  to,
  onPick,
  onSwap,
  fromDetailsLine,
  toDetailsLine,
  onDetails,
  stops,
  maxStops,
  onAddStop,
  onPickStop,
  onRemoveStop,
  onReorderStops,
}: {
  from: Address | null;
  to: Address | null;
  onPick: (which: "from" | "to") => void;
  onSwap: () => void;
  fromDetailsLine?: string;
  toDetailsLine?: string;
  /** Shows the "Tafsilotlar" button on every row that has an address. */
  onDetails?: (target: RouteTarget) => void;
  stops?: RouteStopItem[];
  /** The adapter's limit; null while it loads (no add row yet). */
  maxStops?: number | null;
  onAddStop?: () => void;
  onPickStop?: (uid: string) => void;
  onRemoveStop?: (uid: string) => void;
  onReorderStops?: (fromIndex: number, toIndex: number) => void;
}) {
  const { t } = useT();
  const hintId = useId();
  const list = stops ?? [];
  const [announce, setAnnounce] = useState("");
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<{ index: number; startY: number; dy: number; heights: number[] } | null>(null);

  // Final index of the dragged stop, from its centre against the others'
  // midpoints in the resting layout.
  function targetIndex(d: NonNullable<typeof drag>) {
    let top = 0;
    const mids: number[] = [];
    d.heights.forEach((h) => {
      mids.push(top + h / 2);
      top += h;
    });
    const center = mids[d.index] + d.dy;
    return mids.filter((m, i) => i !== d.index && m < center).length;
  }

  function moveBy(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    onReorderStops?.(index, next);
    setAnnounce(t("stops.moved", { n: next + 1 }));
  }

  const target = drag ? targetIndex(drag) : -1;
  // With stops enabled, the swap control lives in the row between the
  // points (the add-stop row), so the address rows keep their full width.
  const withStops = !!onAddStop;
  const atLimit = withStops && maxStops != null && list.length >= maxStops;
  const swapButton = (
    <button
      onClick={onSwap}
      aria-label={t("order.swap")}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-accent shadow-softer active:scale-95"
    >
      <ArrowUpDown className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent-5 p-3">
      <div className="min-w-0 flex-1 divide-y divide-border">
        <div className="flex items-center gap-1">
          <PointButton dot={fromDot} label={t("order.from")} value={from?.label ?? t("order.choosePlace")} detailsLine={fromDetailsLine} wrap={!!onDetails} onClick={() => onPick("from")} />
          {onDetails && from && <DetailsButton filled={!!fromDetailsLine} place={t("order.from")} onClick={() => onDetails("from")} />}
        </div>

        {list.map((stop, i) => {
          let shift = 0;
          if (drag && i !== drag.index) {
            const h = drag.heights[drag.index];
            if (i > drag.index && i <= target) shift = -h;
            else if (i < drag.index && i >= target) shift = h;
          }
          const dragging = drag?.index === i;
          return (
            <StopRow
              key={stop.uid}
              rowRef={(el) => {
                if (el) rowRefs.current.set(stop.uid, el);
                else rowRefs.current.delete(stop.uid);
              }}
              stop={stop}
              n={i + 1}
              hintId={hintId}
              translateY={dragging ? drag.dy : shift}
              dragging={dragging}
              animate={!!drag && !dragging}
              onPick={() => onPickStop?.(stop.uid)}
              onDetails={onDetails && stop.address ? () => onDetails({ stop: stop.uid }) : undefined}
              onRemove={() => onRemoveStop?.(stop.uid)}
              onMoveKey={(delta) => moveBy(i, delta)}
              onGripDown={(e) => {
                if (list.length < 2) return;
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                const heights = list.map((s) => rowRefs.current.get(s.uid)?.offsetHeight ?? 56);
                setDrag({ index: i, startY: e.clientY, dy: 0, heights });
              }}
              onGripMove={(e) => {
                if (!drag || drag.index !== i) return;
                const before = drag.heights.slice(0, i).reduce((a, b) => a + b, 0);
                const after = drag.heights.slice(i + 1).reduce((a, b) => a + b, 0);
                const dy = Math.max(-before, Math.min(after, e.clientY - drag.startY));
                setDrag({ ...drag, dy });
              }}
              onGripUp={() => {
                if (!drag) return;
                const to = targetIndex(drag);
                setDrag(null);
                if (to !== drag.index) {
                  onReorderStops?.(drag.index, to);
                  setAnnounce(t("stops.moved", { n: to + 1 }));
                }
              }}
            />
          );
        })}

        {withStops && (
          <div className="flex items-center gap-2">
            {atLimit ? (
              <p className="flex min-h-[48px] flex-1 items-center gap-3 px-2 text-xs text-ink/60">
                <span className="w-2.5 shrink-0" aria-hidden="true" />
                {t("stops.limit", { max: maxStops ?? 0 })}
              </p>
            ) : (
              <button
                type="button"
                onClick={onAddStop}
                // Disabled only until the adapter's limit has loaded.
                disabled={maxStops == null}
                className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left text-sm font-semibold text-accent hover:bg-ink/5 disabled:opacity-50"
              >
                <span className="-mx-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-dashed border-accent" aria-hidden="true">
                  <Plus className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1 truncate">{t("stops.add")}</span>
                {maxStops != null && (
                  <span className="text-xs font-normal text-ink/60 tabular">
                    {list.length}/{maxStops}
                  </span>
                )}
              </button>
            )}
            {swapButton}
          </div>
        )}

        <div className="flex items-center gap-1">
          <PointButton dot={toDot} label={t("order.to")} value={to?.label ?? t("order.choosePlace")} detailsLine={toDetailsLine} wrap={!!onDetails} onClick={() => onPick("to")} />
          {onDetails && to && <DetailsButton filled={!!toDetailsLine} place={t("order.to")} onClick={() => onDetails("to")} />}
        </div>
      </div>
      {!withStops && swapButton}
      {list.length > 0 && (
        <>
          <span id={hintId} className="sr-only">
            {t("stops.reorderHint")}
          </span>
          <span className="sr-only" aria-live="polite">
            {announce}
          </span>
        </>
      )}
    </div>
  );
}

function StopRow({
  rowRef,
  stop,
  n,
  hintId,
  translateY,
  dragging,
  animate,
  onPick,
  onDetails,
  onRemove,
  onMoveKey,
  onGripDown,
  onGripMove,
  onGripUp,
}: {
  rowRef: (el: HTMLDivElement | null) => void;
  stop: RouteStopItem;
  n: number;
  hintId: string;
  translateY: number;
  dragging: boolean;
  animate: boolean;
  onPick: () => void;
  onDetails?: () => void;
  onRemove: () => void;
  onMoveKey: (delta: number) => void;
  onGripDown: (e: React.PointerEvent) => void;
  onGripMove: (e: React.PointerEvent) => void;
  onGripUp: () => void;
}) {
  const { t } = useT();
  const label = t("stops.label", { n });
  // Swipe-left to remove: horizontal intent is decided after a few px, so a
  // vertical scroll through the sheet is left alone (touch-action: pan-y).
  const swipe = useRef<{ x: number; y: number; id: number; active: boolean; dead: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, dead: false };
    setSettling(false);
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = swipe.current;
    if (!s || s.dead || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(my) > 8 && Math.abs(my) > Math.abs(mx)) {
        s.dead = true;
        return;
      }
      if (mx < -8 && Math.abs(mx) > Math.abs(my) * 1.2) {
        s.active = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } else return;
    }
    setDx(Math.min(0, mx));
  }
  function onPointerUp() {
    const s = swipe.current;
    swipe.current = null;
    if (!s?.active) return;
    suppressClick.current = true;
    setSettling(true);
    if (dx < -SWIPE_REMOVE_PX) {
      setDx(-400);
      window.setTimeout(onRemove, 160);
    } else setDx(0);
  }

  return (
    <div
      ref={rowRef}
      className={cn("relative", dragging && "z-10")}
      style={{
        transform: translateY ? `translateY(${translateY}px)` : undefined,
        transition: animate ? "transform 160ms ease-out" : undefined,
      }}
    >
      {dx < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden rounded-lg bg-danger pr-4 text-xs font-semibold text-white"
          style={{ width: Math.min(-dx, 400) }}
          aria-hidden="true"
        >
          {t("stops.delete")}
        </div>
      )}
      <div
        className={cn(
          "relative flex touch-pan-y items-center",
          dragging && "rounded-lg bg-card shadow-soft",
          dx < 0 && "bg-card"
        )}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: settling ? "transform 160ms ease-out" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <button
          type="button"
          aria-label={t("stops.reorder", { n })}
          aria-describedby={hintId}
          onPointerDown={(e) => {
            e.stopPropagation();
            onGripDown(e);
          }}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onMoveKey(e.key === "ArrowUp" ? -1 : 1);
            }
          }}
          // Sits in the dot column: the grip is the stop's route marker too.
          className={cn("flex h-11 w-[26px] shrink-0 touch-none items-center justify-center text-ink/60", dragging ? "cursor-grabbing" : "cursor-grab")}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <PointButton
          dot={null}
          label={label}
          value={stop.address?.label ?? t("order.choosePlace")}
          detailsLine={stop.detailsLine}
          wrap
          onClick={onPick}
        />
        {onDetails && (
          <span className="ml-1 flex">
            <DetailsButton filled={!!stop.detailsLine} place={label} onClick={onDetails} />
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("stops.remove", { n })}
          className="flex h-11 w-8 shrink-0 items-center justify-center text-ink/60 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
