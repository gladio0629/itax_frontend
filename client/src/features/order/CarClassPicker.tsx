import { useRef, type KeyboardEvent } from "react";
import type { CarClass, CarClassId } from "@/api/types";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { ClassCarArt } from "./ClassCarArt";

/**
 * "Klass" — horizontal cards: icon, name, seats, the adapter's price (or why
 * the class can't be booked). A single-choice radiogroup: arrow keys move
 * between the classes that can be booked.
 */
export function CarClassPicker({
  status,
  classes,
  value,
  onChange,
  onRetry,
  errorKey,
}: {
  status: "loading" | "error" | "success";
  classes: CarClass[];
  value: CarClassId;
  onChange: (id: CarClassId) => void;
  onRetry: () => void;
  /** A rule the person can fix (e.g. a same-city route): shown, no retry. */
  errorKey?: string | null;
}) {
  const { t, intlTag } = useT();
  const refs = useRef(new Map<CarClassId, HTMLButtonElement>());

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const bookable = classes.filter((c) => c.available);
    const i = bookable.findIndex((c) => c.id === value);
    const next = bookable[(i + delta + bookable.length) % bookable.length];
    if (!next) return;
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  }

  return (
    <section aria-label={t("class.title")}>
      {status === "error" && errorKey ? (
        <p role="alert" className="text-sub font-semibold text-danger">
          {t(errorKey as TranslationKey)}
        </p>
      ) : status === "error" ? (
        <button onClick={onRetry} className="inline-flex min-h-[44px] items-center text-sub font-semibold text-danger underline">
          {t("common.loadFailedRetry")}
        </button>
      ) : (
        // Reference carousel: car, ETA, name, price; the selected card sits
        // on a light gray tile (105×87, radius 15 — measured).
        <div
          role="radiogroup"
          aria-label={t("class.title")}
          onKeyDown={onKeyDown}
          className="no-scrollbar -mx-4 flex snap-x gap-1 overflow-x-auto overscroll-x-contain px-4"
        >
          {status === "loading" && classes.length === 0
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[88px] w-[106px] shrink-0 rounded-thumb" />)
            : classes.map((c) => {
                const selected = c.id === value;
                return (
                  <button
                    key={c.id}
                    ref={(el) => {
                      if (el) refs.current.set(c.id, el);
                      else refs.current.delete(c.id);
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={!c.available}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => c.available && onChange(c.id)}
                    className={cn(
                      "flex min-h-[88px] min-w-[106px] shrink-0 snap-start flex-col items-start rounded-thumb px-2.5 pb-2 pt-1.5 text-left transition-colors",
                      selected ? "bg-selected" : "hover:bg-ink/[0.03]",
                      !c.available && "cursor-not-allowed opacity-45"
                    )}
                  >
                    <ClassCarArt id={c.id} className="h-7 w-[72px]" />
                    {c.etaMinutes != null && c.available && (
                      <span className="text-[11px] leading-[14px] text-ink/60 tabular">{t("order.etaMin", { n: c.etaMinutes })}</span>
                    )}
                    <span className="text-sub text-ink">{t(c.nameKey as TranslationKey)}</span>
                    {c.available ? (
                      // Number bold, currency small (reference "21000 сум").
                      <span className={cn("whitespace-nowrap tabular", status === "loading" ? "text-ink/40" : "text-ink")}>
                        <span className="text-control font-semibold">{formatNumber(c.price, intlTag)}</span>
                        <span className="text-[11px] font-medium"> so'm</span>
                      </span>
                    ) : (
                      <span className="text-[11px] leading-[14px] text-ink/70">{t(c.reasonKey as TranslationKey)}</span>
                    )}
                  </button>
                );
              })}
        </div>
      )}
    </section>
  );
}
