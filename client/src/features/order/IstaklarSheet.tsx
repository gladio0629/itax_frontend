import { Accessibility, Baby, ChevronRight, LocateFixed, Luggage, MessageSquareText, PawPrint, SlidersHorizontal } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import type { OptionVariants, OrderOption, OrderOptionId } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

const ICONS: Record<OrderOptionId, LucideIcon> = {
  child_seat: Baby,
  pet: PawPrint,
  big_luggage: Luggage,
  find_car: LocateFixed,
  wheelchair: Accessibility,
  text_only: MessageSquareText,
};

/** "Istaklar" row in the details panel: what's on, or "Tanlanmagan". */
export function IstaklarRow({
  options,
  selected,
  variants,
  onOpen,
}: {
  options: OrderOption[];
  selected: OrderOptionId[];
  variants: OptionVariants;
  onOpen: () => void;
}) {
  const { t } = useT();
  const summary = options
    .filter((o) => selected.includes(o.id))
    .map((o) => {
      const v = o.variants?.find((x) => x.id === variants[o.id]);
      return v ? `${t(o.titleKey as TranslationKey)} (${t(v.labelKey as TranslationKey)})` : t(o.titleKey as TranslationKey);
    })
    .join(", ");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[var(--size-row)] w-full items-center gap-3 border-b border-hairline py-2 text-left"
    >
      <span className="flex h-[var(--size-tile)] w-[var(--size-tile)] shrink-0 items-center justify-center rounded-tile bg-fill text-ink/70">
        <SlidersHorizontal className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-ink">{t("options.title")}</span>
        <span className={cn("line-clamp-2 text-sub", summary ? "text-ink/80" : "text-ink/60")}>{summary || t("options.none")}</span>
      </span>
      {selected.length > 0 && (
        <span className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-bg tabular">
          {selected.length}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink/60" />
    </button>
  );
}

/**
 * Switches with a short description and the adapter's extra price; options
 * the adapter marks unavailable are disabled with its reason. Changes apply
 * to the draft as they're made (and re-quote); "Tayyor" just closes.
 */
export function IstaklarSheet({
  options,
  selected,
  variants,
  onToggle,
  onVariant,
  onClose,
}: {
  options: OrderOption[];
  selected: OrderOptionId[];
  variants: OptionVariants;
  onToggle: (option: OrderOption) => void;
  onVariant: (id: OrderOptionId, variant: string) => void;
  onClose: () => void;
}) {
  const { t, intlTag } = useT();
  const price = (o: OrderOption) => (o.price > 0 ? `+${formatSom(o.price, intlTag)}` : t("option.free"));

  function variantPicker(o: OrderOption) {
    if (!o.variants || !selected.includes(o.id)) return null;
    const value = variants[o.id] ?? o.defaultVariant ?? o.variants[0].id;
    const label = t("option.child_seat.age");
    return (
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2 pb-3 pl-[60px] pr-3">
        {o.variants.map((v) => {
          const on = v.id === value;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onVariant(o.id, v.id)}
              className={cn(
                "min-h-[36px] rounded-full border px-3 text-xs font-semibold transition-colors",
                on ? "border-accent bg-accent text-bg" : "border-border text-ink/80 hover:border-accent/40"
              )}
            >
              {t(v.labelKey as TranslationKey)}
            </button>
          );
        })}
      </div>
    );
  }


  return (
    <Sheet open onClose={onClose} ariaLabel={t("options.title")}>
      <div className="px-5 pt-3">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("options.title")}</h2>
        <div className="divide-y divide-border">
          {options.map((o) => {
            const title = t(o.titleKey as TranslationKey);
            const Icon = ICONS[o.id];
            return (
              <div key={o.id}>
                <div className={cn("flex min-h-[64px] items-center gap-3 py-2.5", !o.available && "opacity-60")}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    {o.available ? (
                      <span className="block text-xs text-ink/60">{t(o.descKey as TranslationKey)}</span>
                    ) : (
                      <span className="block text-xs font-semibold text-ink/70">{t(o.reasonKey as TranslationKey)}</span>
                    )}
                  </span>
                  <span className={cn("shrink-0 text-xs tabular", o.price > 0 ? "font-semibold text-ink/80" : "text-ink/60")}>{price(o)}</span>
                  <Switch checked={selected.includes(o.id)} disabled={!o.available} onChange={() => onToggle(o)} label={title} />
                </div>
                {variantPicker(o)}
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 -mx-5 mt-2 border-t border-border bg-card px-5 pt-3">
          <Button fullWidth onClick={onClose}>
            {t("options.done")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
