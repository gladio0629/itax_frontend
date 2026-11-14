import { Accessibility, Baby, ChevronRight, LocateFixed, Luggage, MessageSquareText, PawPrint, SlidersHorizontal } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import type { OptionVariants, OrderOption, OrderOptionId } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { Segmented } from "@/components/ios/Segmented";
import { IconTile, ListSection } from "@/components/ios/List";
import { formatSom } from "@/lib/format";
import { useIsIOS } from "@/lib/platform";
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
      className="flex min-h-[60px] w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-ink/5 ios:border-0 ios:bg-[var(--ios-fill-quaternary)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent ios:bg-card">
        <SlidersHorizontal className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{t("options.title")}</span>
        <span className={cn("line-clamp-2 text-xs", summary ? "text-ink/80" : "text-ink/60")}>{summary || t("options.none")}</span>
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
  const ios = useIsIOS();
  const price = (o: OrderOption) => (o.price > 0 ? `+${formatSom(o.price, intlTag)}` : t("option.free"));

  function variantPicker(o: OrderOption) {
    if (!o.variants || !selected.includes(o.id)) return null;
    const value = variants[o.id] ?? o.defaultVariant ?? o.variants[0].id;
    const label = t("option.child_seat.age");
    if (ios) {
      return (
        <div className="bg-card px-4 pb-3 pt-1">
          <Segmented
            ariaLabel={label}
            value={value}
            onChange={(v) => onVariant(o.id, v)}
            options={o.variants.map((v) => ({ id: v.id, label: t(v.labelKey as TranslationKey) }))}
          />
        </div>
      );
    }
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

  if (ios) {
    return (
      <Sheet open onClose={onClose} ariaLabel={t("options.title")} panelClassName="ios:bg-bg">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-3 pt-1">
          <span />
          <h2 className="ios-headline text-ink">{t("options.title")}</h2>
          <button type="button" onClick={onClose} className="ios-headline min-h-[44px] justify-self-end text-accent">
            {t("options.done")}
          </button>
        </div>
        <ListSection className="mb-4">
          {options.map((o) => {
            const title = t(o.titleKey as TranslationKey);
            return (
              <div key={o.id} className="ios-sep relative" style={{ ["--sep-inset" as string]: "60px" }}>
                <div className={cn("flex min-h-[60px] items-center gap-[15px] bg-card px-4 py-[9px]", !o.available && "opacity-50")}>
                  <IconTile icon={ICONS[o.id]} tone={o.id === "child_seat" ? "yellow" : "accent"} />
                  <span className="min-w-0 flex-1">
                    <span className="ios-body block text-ink">{title}</span>
                    <span className="ios-subheadline block text-[color:var(--ios-label-secondary)]">
                      {o.available ? t(o.descKey as TranslationKey) : t(o.reasonKey as TranslationKey)}
                    </span>
                  </span>
                  <span className="ios-subheadline shrink-0 text-[color:var(--ios-label-secondary)] tabular">{price(o)}</span>
                  <Switch checked={selected.includes(o.id)} disabled={!o.available} onChange={() => onToggle(o)} label={title} />
                </div>
                {variantPicker(o)}
              </div>
            );
          })}
        </ListSection>
      </Sheet>
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
