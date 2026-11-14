import { useRef, type KeyboardEvent } from "react";
import { Bus, Car } from "@/lib/icons";
import type { CarClass, CarClassId } from "@/api/types";
import { Skeleton } from "@/components/Skeleton";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

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
}: {
  status: "loading" | "error" | "success";
  classes: CarClass[];
  value: CarClassId;
  onChange: (id: CarClassId) => void;
  onRetry: () => void;
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
    <section aria-labelledby="class-title" className="space-y-2">
      <p id="class-title" className="text-sm font-semibold text-ink">
        {t("class.title")}
      </p>
      {status === "error" ? (
        <button onClick={onRetry} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
          {t("common.loadFailedRetry")}
        </button>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby="class-title"
          onKeyDown={onKeyDown}
          className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1"
        >
          {status === "loading" && classes.length === 0
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[108px] w-[112px] shrink-0" />)
            : classes.map((c) => {
                const selected = c.id === value;
                const Icon = c.id === "miniven" ? Bus : Car;
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
                      "flex w-[112px] shrink-0 snap-start flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors",
                      selected ? "border-accent bg-accent-5" : "border-border hover:border-accent/40",
                      !c.available && "cursor-not-allowed opacity-50 hover:border-border",
                      "ios:border-0 ios:bg-[var(--ios-fill-quaternary)]",
                      selected && "ios:bg-accent-10 ios:ring-2 ios:ring-inset ios:ring-accent"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", selected ? "text-accent" : "text-ink/60")} />
                    <span className="text-sm font-semibold text-ink">{t(c.nameKey as TranslationKey)}</span>
                    <span className="text-xs text-ink/60">{t("class.seats", { n: c.seats })}</span>
                    {c.available ? (
                      <span className={cn("text-xs font-semibold tabular", status === "loading" ? "text-ink/40" : "text-ink")}>
                        {formatSom(c.price, intlTag)}
                      </span>
                    ) : (
                      <span className="text-xs leading-tight text-ink/70">{t(c.reasonKey as TranslationKey)}</span>
                    )}
                  </button>
                );
              })}
        </div>
      )}
    </section>
  );
}
