import { useEffect, useId, useRef, useState } from "react";
import { Baby, Lightbulb, Luggage, Package, X } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { api } from "@/api/client";
import type { CommentHint, OrderOption, OrderOptionId, ServiceType } from "@/api/types";
import { Switch } from "@/components/Switch";
import { Skeleton } from "@/components/Skeleton";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

const OPTION_ICONS: Partial<Record<OrderOptionId, LucideIcon>> = { child_seat: Baby, big_luggage: Luggage };

/**
 * "Haydovchiga izoh" with smart hints. The adapter reads the text and says
 * which add-ons it suggests; nothing is applied until the passenger taps
 * "Qo'shish".
 */
export function DriverComment({
  value,
  onChange,
  maxLength,
  serviceType,
  options,
  selectedOptionIds,
  onApplyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  /** The adapter's limit; undefined while the rules load. */
  maxLength?: number;
  serviceType: ServiceType;
  options: OrderOption[];
  selectedOptionIds: OrderOptionId[];
  onApplyHint: (id: OrderOptionId) => void;
}) {
  const { t, intlTag } = useT();
  const id = useId();
  const [hints, setHints] = useState<CommentHint[]>([]);
  const [dismissed, setDismissed] = useState<OrderOptionId[]>([]);
  const request = useRef(0);
  const selectedKey = selectedOptionIds.join(",");

  // Debounced; only the latest request may set hints, and a failed call
  // just means no hints this time.
  useEffect(() => {
    const req = ++request.current;
    const text = value.trim();
    if (!text) {
      setHints([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .getCommentHints({ text, serviceType, selectedOptionIds })
        .then((h) => {
          if (req === request.current) setHints(h);
        })
        .catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, serviceType, selectedKey]);

  const visible = hints.filter((h) => !dismissed.includes(h.optionId) && !selectedOptionIds.includes(h.optionId));

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2">
      <label id={`${id}-title`} htmlFor={id} className="block text-sm font-semibold text-ink">
        {t("comment.title")}
      </label>
      <div>
        <textarea
          id={id}
          name="driver-comment"
          autoComplete="off"
          rows={3}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("comment.placeholder")}
          className="block w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink/60 focus:border-accent ios:border-0 ios:bg-[var(--ios-fill-tertiary)] ios:placeholder:text-[color:var(--ios-label-tertiary)]"
        />
        {maxLength != null && (
          <p className="mt-1 text-right text-xs text-ink/60 tabular" aria-hidden={value.length < maxLength * 0.9}>
            {t("comment.count", { n: value.length, max: maxLength })}
          </p>
        )}
      </div>

      <div aria-live="polite" className="space-y-2">
        {visible.map((hint) => {
          const option = options.find((o) => o.id === hint.optionId);
          if (!option) return null;
          return (
            <div key={hint.optionId} className="flex animate-fade-in gap-2.5 rounded-xl bg-accent-5 pb-1 pl-3 pr-1 pt-3 ios:bg-[var(--ios-fill-quaternary)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-on-yellow">
                <Lightbulb className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="pt-1.5 text-sm text-ink">{t(hint.messageKey as TranslationKey)}</p>
                <button type="button" onClick={() => onApplyHint(hint.optionId)} className="flex h-11 items-center">
                  <span className="flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-bg">
                    {t("hint.apply")}
                    <span className="font-normal opacity-80 tabular">+{formatSom(option.price, intlTag)}</span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDismissed((d) => [...d, hint.optionId])}
                aria-label={t("hint.dismiss")}
                className="-mt-2 flex h-11 w-9 shrink-0 items-center justify-center text-ink/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Add-ons the adapter offers for this service type, with its prices. */
export function OrderOptions({
  status,
  options,
  selected,
  onToggle,
  onRetry,
}: {
  status: "loading" | "error" | "success";
  options: OrderOption[];
  selected: OrderOptionId[];
  onToggle: (id: OrderOptionId) => void;
  onRetry: () => void;
}) {
  const { t, intlTag } = useT();
  if (status === "success" && options.length === 0) return null;
  return (
    <section aria-labelledby="options-title" className="space-y-3">
      <p id="options-title" className="text-sm font-semibold text-ink">
        {t("options.title")}
      </p>
      {status === "loading" && <Skeleton className="h-[64px] w-full" />}
      {status === "error" && (
        <button onClick={onRetry} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
          {t("common.loadFailedRetry")}
        </button>
      )}
      {status === "success" && (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border ios:border-0 ios:bg-[var(--ios-fill-quaternary)]">
          {options.map((o) => {
            const Icon = OPTION_ICONS[o.id] ?? Package;
            const on = selected.includes(o.id);
            const title = t(o.titleKey as TranslationKey);
            return (
              <div key={o.id} className="flex min-h-[60px] items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent ios:bg-card">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{title}</span>
                  <span className="block text-xs text-ink/60">
                    <span className="font-semibold text-ink/80 tabular">+{formatSom(o.price, intlTag)}</span>
                    {" \u00b7 "}
                    {t(o.descKey as TranslationKey)}
                  </span>
                </span>
                <Switch checked={on} onChange={() => onToggle(o.id)} label={title} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
