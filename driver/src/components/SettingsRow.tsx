import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";

// Telegram-style colored icon tiles. Each fill pairs with white or navy so
// the glyph clears 3:1 against its tile.
export const TILE = {
  blue: "bg-[#3B6FE0] text-white",
  yellow: "bg-yellow text-on-yellow",
  green: "bg-[#169C5B] text-white",
  purple: "bg-[#7451D9] text-white",
  orange: "bg-[#D9661F] text-white",
  slate: "bg-[#5B6B8C] text-white",
  red: "bg-[#D93A3A] text-white",
  teal: "bg-[#0E8C8C] text-white",
} as const;

type Props = {
  icon: LucideIcon;
  tile: keyof typeof TILE;
  label: string;
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
  description?: string;
};

export function SettingsRow({ icon: Icon, tile, label, value, to, onClick, trailing, danger, description }: Props) {
  const body = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-button", TILE[tile])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-base", danger ? "text-danger" : "text-ink")}>{label}</span>
        {description && <span className="block truncate text-sm text-muted">{description}</span>}
      </span>
      {value != null && <span className="tabular shrink-0 text-sm text-muted">{value}</span>}
      {trailing}
      {(to || onClick) && !trailing && !danger && <ChevronRight className="h-5 w-5 shrink-0 text-muted" />}
    </>
  );
  const cls = "press flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left";
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function SettingsGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section className="mb-4" aria-label={label}>
      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-1">{children}</div>
    </section>
  );
}
