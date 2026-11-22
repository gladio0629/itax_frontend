import type { ReactNode } from "react";
import type { CarClass, Contact, Freight, OrderOption, OrderOptionKind } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import {
  Accessibility, Baby, Briefcase, Car, Luggage, MessageSquareText, Package, PawPrint, Phone, Truck, UserRound, Users, type LucideIcon,
} from "@/lib/icons";
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
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-button px-2 text-xs font-medium",
        tone === "accent" ? "bg-brand-ink/15 text-brand-ink" : tone === "yellow" ? "bg-brand text-on-brand" : "bg-raised text-ink"
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {/* aria-label on a plain span is not announced reliably; give readers the full phrase as text. */}
      {label && <span className="sr-only">{label}</span>}
      <span className="truncate" aria-hidden={label ? true : undefined}>
        {children}
      </span>
    </span>
  );
}

/** Car class + "Boshqa odam uchun: <name>" (+ any extra tags, e.g. cargo badges). */
export function OrderTags({ carClass, forOther, children }: { carClass?: CarClass; forOther: { name: string } | null; children?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      {carClass && (
        <Tag icon={Car} label={t("order.carClass", { cls: t(`carClass.${carClass}`) })}>
          {t(`carClass.${carClass}`)}
        </Tag>
      )}
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
              o.kind === "text_only" ? "bg-brand-ink/15 text-brand-ink" : "bg-raised text-ink"
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
export function CommentNote({ text, clamp }: { text: string | null; clamp?: boolean }) {
  const { t } = useT();
  if (!text) return null;
  return (
    <figure className="flex gap-2 rounded-button bg-raised px-3 py-2">
      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <figcaption className="text-xs text-muted">{t("order.comment")}</figcaption>
        <blockquote className={cn("break-words text-sm text-ink", clamp && "line-clamp-2")}>{text}</blockquote>
      </div>
    </figure>
  );
}

/** Cargo badges: which client tab the order came from, and "owner rides along". */
export function FreightTags({ freight }: { freight: Freight }) {
  const { t } = useT();
  const tab = t(`freight.tab.${freight.tab}`);
  return (
    <>
      <Tag icon={freight.tab === "kargo" ? Truck : Package} tone="yellow" label={t("freight.tabLabel", { tab })}>
        {tab}
      </Tag>
      {freight.rideAlong && (
        <Tag icon={Users} tone="accent">
          {t("freight.rideAlong")}
        </Tag>
      )}
    </>
  );
}

/** Body size, loaders and billing as three glance tiles. */
export function FreightGrid({ freight, showDims = false }: { freight: Freight; showDims?: boolean }) {
  const { t } = useT();
  const { body, billing } = freight;
  const dims = t("freight.dims", { w: body.dimensionsCm.width, d: body.dimensionsCm.depth, h: body.dimensionsCm.height });
  return (
    <dl className="grid grid-cols-3 gap-2">
      <Tile label={t("freight.body")} value={body.sizeLabel} sub={showDims ? dims : undefined} title={dims} />
      <Tile
        label={t("freight.loaders")}
        value={freight.loaders > 0 ? t("freight.loadersN", { n: freight.loaders }) : t("freight.loadersNone")}
      />
      {billing.mode === "hourly" ? (
        <Tile label={t("freight.hourly")} value={t("freight.hours", { n: billing.hours })} />
      ) : (
        <Tile label={t("freight.billing")} value={t("freight.route")} />
      )}
    </dl>
  );
}

function Tile({ label, value, sub, title }: { label: string; value: ReactNode; sub?: string; title?: string }) {
  return (
    <div title={title} className="min-w-0 rounded-button bg-raised px-2.5 py-2">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="tabular truncate text-base font-bold text-ink">{value}</dd>
      {sub && <dd className="tabular truncate text-xs text-muted">{sub}</dd>}
    </div>
  );
}

/** Sender and receiver. Before accepting: names only. After: masked phone + call button. */
export function ContactList({ freight, callable }: { freight: Freight; callable: boolean }) {
  const { t } = useT();
  const rows: { role: string; c: Contact }[] = [
    { role: t("freight.sender"), c: freight.sender },
    { role: t("freight.receiver"), c: freight.receiver },
  ];
  return (
    <ul aria-label={t("freight.contacts")} className={cn("grid gap-2", callable ? "grid-cols-1" : "grid-cols-2")}>
      {rows.map(({ role, c }) => (
        <li key={role} className="flex min-w-0 items-center gap-3 rounded-button bg-raised px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{role}</p>
            <p className="truncate text-sm font-bold text-ink">{c.name}</p>
            {callable && <p className="tabular truncate text-xs text-muted">{c.phoneMasked}</p>}
          </div>
          {callable && <CallButton name={c.name} phoneMasked={c.phoneMasked} size={40} />}
        </li>
      ))}
    </ul>
  );
}

/** Masked number: shown instead of dialling. */
export function CallButton({ name, phoneMasked, size = 48 }: { name: string; phoneMasked: string; size?: 40 | 48 }) {
  const { t } = useT();
  return (
    <a
      href={`tel:${phoneMasked.replace(/[^\d+]/g, "")}`}
      onClick={(e) => {
        e.preventDefault();
        toast(t("trip.callMasked", { phone: phoneMasked }));
      }}
      aria-label={t("trip.call", { name })}
      className={cn("press flex shrink-0 items-center justify-center rounded-full bg-success/15 text-success", size === 48 ? "h-12 w-12" : "h-10 w-10")}
    >
      <Phone className="h-5 w-5" />
    </a>
  );
}
