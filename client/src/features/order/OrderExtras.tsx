import { useEffect, useId, useRef, useState } from "react";
import { Lightbulb, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { CarClassId, CommentHint, OrderOption, OrderOptionId, ServiceType } from "@/api/types";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

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
  carClass,
  options,
  selectedOptionIds,
  onApplyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  /** The adapter's limit; undefined while the rules load. */
  maxLength?: number;
  serviceType: ServiceType;
  carClass: CarClassId;
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
        .getCommentHints({ text, serviceType, carClass, selectedOptionIds })
        .then((h) => {
          if (req === request.current) setHints(h);
        })
        .catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, serviceType, carClass, selectedKey]);

  const visible = hints.filter((h) => !dismissed.includes(h.optionId) && !selectedOptionIds.includes(h.optionId));

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2">
      <label id={`${id}-title`} htmlFor={id} className="block text-control font-semibold text-ink">
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
          className="block w-full resize-none rounded-control bg-fill px-4 py-3 text-control text-ink outline-none transition-shadow placeholder:text-ink/60 focus:ring-2 focus:ring-accent/40"
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
            <div key={hint.optionId} className="flex animate-fade-in gap-2.5 rounded-xl bg-accent-5 pb-1 pl-3 pr-1 pt-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-on-yellow">
                <Lightbulb className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="pt-1.5 text-sm text-ink">{t(hint.messageKey as TranslationKey)}</p>
                <button type="button" onClick={() => onApplyHint(hint.optionId)} className="group flex h-11 items-center">
                  <span className="flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-bg transition-opacity group-hover:opacity-90 group-active:opacity-80">
                    {t("hint.apply")}
                    <span className="font-normal opacity-80 tabular">+{formatSom(option.price, intlTag)}</span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDismissed((d) => [...d, hint.optionId])}
                aria-label={t("hint.dismiss")}
                className="-mt-2 flex h-11 w-9 shrink-0 items-center justify-center text-ink/60 hover:text-ink"
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
