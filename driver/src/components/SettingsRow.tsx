import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ExternalLink, type LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";

// Redesign v2 rows: a 44px soft icon tile (radius 14) and a 68px row with a
// hairline under it. Tile tones: most rows are neutral; destructive rows red.
export const TILE = {
  blue: "bg-raised text-ink",
  yellow: "bg-brand-soft text-brand-ink",
  green: "bg-brand-soft text-brand-ink",
  purple: "bg-raised text-ink",
  orange: "bg-warning-soft text-warning",
  slate: "bg-raised text-ink",
  red: "bg-danger-soft text-danger",
  teal: "bg-raised text-ink",
} as const;

type Props = {
  icon: LucideIcon;
  tile?: keyof typeof TILE;
  label: string;
  value?: ReactNode;
  to?: string;
  /** External page: opens in the system browser. */
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
  description?: string;
};

export function SettingsRow({ icon: Icon, tile = "slate", label, value, to, href, onClick, trailing, danger, description }: Props) {
  const body = (
    <>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-tile", danger ? TILE.red : TILE[tile])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("block truncate text-15 font-bold", danger ? "text-danger" : "text-ink")}>{label}</span>
        {description && <span className="block text-xs font-semibold text-muted">{description}</span>}
      </span>
      {value != null && <span className="tabular shrink-0 text-sm font-semibold text-muted">{value}</span>}
      {trailing}
      {href && !trailing && <ExternalLink className="h-[18px] w-[18px] shrink-0 text-muted" />}
      {(to || onClick) && !trailing && !danger && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted" />}
    </>
  );
  const cls = "press focus-inset flex min-h-[68px] w-full items-center gap-3.5 border-b border-line py-2 text-left last:border-b-0";
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    );
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** A titled block of rows. `label` shows as a small caps heading. */
export function SettingsGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section className="mb-4" aria-label={label}>
      {label && <h2 className="label-caps mb-1 text-muted">{label}</h2>}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
