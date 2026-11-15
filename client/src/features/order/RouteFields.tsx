import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, Flag, GripVertical, PersonStanding, Plus, X } from "@/lib/icons";
import { Chip } from "@/components/ui/Chip";
import type { Address } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export type RouteTarget = "from" | "to" | { stop: string };

export type RouteStopLabels = {
  add: string;
  item: (n: number) => string;
  remove: (n: number) => string;
  reorder: (n: number) => string;
  limit: (max: number) => string;
};

export type RouteStopItem = {
  uid: string;
  address: Address | null;
  /** detailsSummary() of the stop's Tafsilotlar, "" when empty. */
  detailsLine: string;
};

/** Past this many px to the left, a swipe removes the stop on release. */
const SWIPE_REMOVE_PX = 88;

function PointButton({
  label,
  value,
  detailsLine,
  wrap,
  showLabel = true,
  trailing,
  onClick,
}: {
  /** Let a long label take two lines instead of truncating. */
  wrap?: boolean;
  label: string;
  value: string;
  detailsLine?: string;
  /** Kargo shows "Qayerdan"/"Qayerga" above the address; the taxi sheet
   * shows the address alone (reference layout). The label still names the
   * button for assistive tech. */
  showLabel?: boolean;
  /** Text after the address, e.g. "· 4 soat 51 daq". */
  trailing?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-label={showLabel ? undefined : `${label}: ${value}`} className="flex min-h-[var(--size-row)] min-w-0 flex-1 items-center py-2 pr-2 text-left">
      <span className="min-w-0 flex-1">
        {showLabel && <span className="block text-sub text-ink/60">{label}</span>}
        <span className={cn("text-control text-ink", wrap ? "line-clamp-2" : "block truncate")}>
          {value}
          {trailing && <span className="text-ink/55"> · {trailing}</span>}
        </span>
        {detailsLine && <span className={cn("text-sub text-ink/60", wrap ? "line-clamp-2" : "block truncate")}>{detailsLine}</span>}
      </span>
    </button>
  );
}

function DetailsButton({ filled, place, onClick, text }: { filled: boolean; place: string; onClick: () => void; text?: string }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("details.buttonFor", { place })}
      className="group flex h-11 shrink-0 items-center"
    >
      {/* Outlined capsule (reference "details" button, 35px). */}
      <span
        className={cn(
          "flex h-9 items-center rounded-chip border px-3.5 text-sub font-medium transition-colors",
          filled ? "border-accent/40 bg-accent-5 text-accent" : "border-hairline bg-card text-ink/70 group-hover:border-ink/25"
        )}
      >
        {text ?? t("details.button")}
      </span>
    </button>
  );
}

/** Icon rail: the pickup person, the drop-off flag (no third-party glyphs). */
function RailIcon({ kind }: { kind: "from" | "to" }) {
  return (
    <span className="flex w-7 shrink-0 justify-center text-ink" aria-hidden="true">
      {kind === "from" ? <PersonStanding className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
    </span>
  );
}

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
  labels,
  toLabel,
  canSwap = true,
  addStyle = "chip",
  showLabels = true,
  fromDetailsText,
  toDetailsText,
  toTrailing,
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
  /** Wording for the in-between points (Kargo calls them drop-offs). */
  labels?: RouteStopLabels;
  /** Replaces "Qayerga" (e.g. "Ombor" for a marketplace drop-off). */
  toLabel?: string;
  /** False where reversing makes no sense (a warehouse can't be the pickup). */
  canSwap?: boolean;
  /** "plus": a round + on the drop-off row (taxi); "chip": "Manzil +" under
   * the rows (Kargo). */
  addStyle?: "plus" | "chip";
  showLabels?: boolean;
  /** Capsule text on the address rows (default "Tafsilotlar"). */
  fromDetailsText?: string;
  toDetailsText?: string;
  /** After the drop-off address, e.g. the travel time. */
  toTrailing?: string;
}) {
  const { t } = useT();
  const hintId = useId();
  const list = stops ?? [];
  const L: RouteStopLabels = labels ?? {
    add: t("stops.add"),
    item: (n) => t("stops.label", { n }),
    remove: (n) => t("stops.remove", { n }),
    reorder: (n) => t("stops.reorder", { n }),
    limit: (max) => t("stops.limit", { max }),
  };
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
      className="flex h-7 w-7 items-center justify-center rounded-full bg-fill text-ink/70 transition-colors hover:bg-ink/10"
    >
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
  const addPlus = withStops && addStyle === "plus" && (
    <button
      type="button"
      onClick={onAddStop}
      disabled={maxStops == null || atLimit}
      aria-label={atLimit ? L.limit(maxStops ?? 0) : L.add}
      title={atLimit ? L.limit(maxStops ?? 0) : undefined}
      className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fill text-ink">
        <Plus className="h-4 w-4" />
      </span>
    </button>
  );

  return (
    <div className="relative">
      <div className="flex items-center">
        <RailIcon kind="from" />
        <div className="ml-2 flex min-w-0 flex-1 items-center gap-1 border-b border-hairline">
          <PointButton
            label={t("order.from")}
            value={from?.label ?? t("order.choosePlace")}
            detailsLine={fromDetailsLine}
            wrap={showLabels}
            showLabel={showLabels}
            onClick={() => onPick("from")}
          />
          {onDetails && from && (
            <DetailsButton filled={!!fromDetailsLine} place={t("order.from")} text={fromDetailsText} onClick={() => onDetails("from")} />
          )}
        </div>
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
            labels={L}
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

      <div className="flex items-center">
        <RailIcon kind="to" />
        <div className={cn("ml-2 flex min-w-0 flex-1 items-center gap-1", addStyle === "chip" && withStops && "border-b border-hairline")}>
          <PointButton
            label={toLabel ?? t("order.to")}
            value={to?.label ?? t("order.choosePlace")}
            detailsLine={toDetailsLine}
            wrap={showLabels}
            showLabel={showLabels}
            trailing={toTrailing}
            onClick={() => onPick("to")}
          />
          {onDetails && to && (
            <DetailsButton filled={!!toDetailsLine} place={toLabel ?? t("order.to")} text={toDetailsText} onClick={() => onDetails("to")} />
          )}
          {addPlus}
        </div>
      </div>

      {withStops && addStyle === "chip" && (
        <div className="pt-3">
          {atLimit ? (
            <p className="text-sub text-ink/60">{L.limit(maxStops ?? 0)}</p>
          ) : (
            <Chip onClick={onAddStop} disabled={maxStops == null} trailing={<Plus className="h-4 w-4" />} className="disabled:opacity-50">
              {L.add}
              {maxStops != null && <span className="font-normal text-ink/60 tabular">{list.length}/{maxStops}</span>}
            </Chip>
          )}
        </div>
      )}

      {/* Swap sits on the icon rail between pickup and drop-off. */}
      {canSwap && list.length === 0 && <div className="absolute left-0 top-[calc(var(--size-row)-14px)]">{swapButton}</div>}
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
  labels,
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
  labels: RouteStopLabels;
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
  const label = labels.item(n);
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
          "relative flex touch-pan-y select-none items-center",
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
          aria-label={labels.reorder(n)}
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
          className={cn("flex h-11 w-7 shrink-0 touch-none items-center justify-center text-ink/60 hover:text-ink", dragging ? "cursor-grabbing" : "cursor-grab")}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="ml-2 flex min-w-0 flex-1 items-center gap-1 border-b border-hairline">
          <PointButton label={label} value={stop.address?.label ?? t("order.choosePlace")} detailsLine={stop.detailsLine} wrap onClick={onPick} />
          {onDetails && <DetailsButton filled={!!stop.detailsLine} place={label} onClick={onDetails} />}
          <button
            type="button"
            onClick={onRemove}
            aria-label={labels.remove(n)}
            className="flex h-11 w-9 shrink-0 items-center justify-center text-ink/60 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
