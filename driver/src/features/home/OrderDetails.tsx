import type { ReactNode } from "react";
import type { CarClass, OrderOption, OrderOptionKind } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Accessibility, Baby, Briefcase, Car, Luggage, MessageSquareText, PawPrint, UserRound, type LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { optionLabel } from "./orderText";

const OPTION_ICON: Record<OrderOptionKind, LucideIcon> = {
  child_seat: Baby,
  pet: PawPrint,
  big_luggage: Luggage,
  wheelchair: Accessibility,
  text_only: MessageSquareText,
};

/** Small rounded tag. `tone` picks the fill; text always clears AA on it. */
export function Tag({ icon: Icon, children, tone = "plain", label }: { icon?: LucideIcon; children: ReactNode; tone?: "plain" | "accent" | "yellow"; label?: string }) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-button px-2 text-xs font-medium",
        tone === "accent" ? "bg-accent/15 text-accent" : tone === "yellow" ? "bg-yellow text-on-yellow" : "bg-raised text-ink"
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Car class + "Boshqa odam uchun: <name>" (+ any extra tags, e.g. cargo badges). */
export function OrderTags({ carClass, forOther, children }: { carClass: CarClass; forOther: { name: string } | null; children?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      <Tag icon={Car} label={t("order.carClass", { cls: t(`carClass.${carClass}`) })}>
        {t(`carClass.${carClass}`)}
      </Tag>
      {children}
      {forOther && (
        <Tag icon={UserRound} tone="accent">
          {t("order.forOtherName", { name: forOther.name })}
        </Tag>
      )}
    </div>
  );
}

/**
 * Options as icons: universal glyphs (pet, luggage, wheelchair, text-only)
 * stand alone; the child seat keeps its age group and luggage its count.
 * Every chip carries the full label for screen readers and on hover.
 */
export function OptionChips({ options, luggageCount }: { options: OrderOption[]; luggageCount: number }) {
  const { t } = useT();
  if (!options.length && !luggageCount) return null;
  return (
    <ul aria-label={t("order.requirements")} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const Icon = OPTION_ICON[o.kind];
        const label = optionLabel(o, t);
        return (
          <li
            key={o.kind}
            title={label}
            className={cn(
              "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-button px-2 text-xs font-medium",
              o.kind === "text_only" ? "bg-accent/15 text-accent" : "bg-raised text-ink"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="sr-only">{label}</span>
            {o.kind === "child_seat" && <span aria-hidden="true">{t(`childAge.${o.ageGroup}`)}</span>}
          </li>
        );
      })}
      {luggageCount > 0 && (
        <li title={t("order.luggage", { n: luggageCount })} className="tabular inline-flex h-8 items-center gap-1 rounded-button bg-raised px-2 text-xs font-medium text-ink">
          <Briefcase className="h-[18px] w-[18px] shrink-0" />
          <span className="sr-only">{t("order.luggage", { n: luggageCount })}</span>
          <span aria-hidden="true">{luggageCount}</span>
        </li>
      )}
    </ul>
  );
}

/** The passenger's own words, quoted as typed. */
export function CommentNote({ text }: { text: string | null }) {
  const { t } = useT();
  if (!text) return null;
  return (
    <figure className="flex gap-2 rounded-button bg-raised px-3 py-2">
      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <figcaption className="text-xs text-muted">{t("order.comment")}</figcaption>
        <blockquote className="text-sm text-ink">{text}</blockquote>
      </div>
    </figure>
  );
}
