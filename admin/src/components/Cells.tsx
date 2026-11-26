import { ArrowRight, Box, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";
import type { DriverLevel, OrderKind } from "@/api/types";

/** Order type tag: Yo'lovchi (surface) / Dostavka (Ink). */
export function KindTag({ kind }: { kind: OrderKind }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-bold",
        kind === "delivery" ? "bg-ink text-white" : "bg-surface text-ink"
      )}
    >
      {kind === "delivery" ? "Dostavka" : "Yo'lovchi"}
    </span>
  );
}

/** Small type line under an order id: icon + label. */
export function KindLine({ kind }: { kind: OrderKind }) {
  const Icon = kind === "delivery" ? Box : User;
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-muted">
      <Icon className="h-3 w-3" aria-hidden />
      {kind === "delivery" ? "Dostavka" : "Yo'lovchi"}
    </span>
  );
}

/** "Toshkent → Samarqand" */
export function RouteText({ from, to, className }: { from: string; to: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap font-bold", className)}>
      {from}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="dan" />
      {to}
    </span>
  );
}

/** Avatar + name + second line (phone etc.). */
export function PersonCell({ name, sub, tone }: { name: string; sub?: ReactNode; tone?: "light" | "green" }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={36} tone={tone} />
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-sm font-bold text-ink">{name}</span>
        {sub && <span className="tabular truncate text-xs font-semibold text-muted">{sub}</span>}
      </span>
    </span>
  );
}

const LEVEL: Record<DriverLevel, { label: string; dot: string }> = {
  bronze: { label: "Bronza", dot: "bg-[var(--level-bronze)]" },
  silver: { label: "Kumush", dot: "bg-[var(--level-silver)]" },
  gold: { label: "Oltin", dot: "bg-[var(--level-gold)]" },
};
export const LEVEL_LABEL: Record<DriverLevel, string> = { bronze: "Bronza", silver: "Kumush", gold: "Oltin" };

/** Driver level from the server, with its colour dot. */
export function LevelBadge({ level }: { level: DriverLevel | null }) {
  if (!level) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 text-xs font-bold text-ink">
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", LEVEL[level].dot)} />
      {LEVEL[level].label}
    </span>
  );
}

/** Small KPI card (profile pages): caps label, value, sub line. */
export function MiniStat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-card bg-white px-[18px] py-4 shadow-card">
      <span className="label-caps text-muted">{label}</span>
      <span className={cn("tabular text-2xl font-extrabold", tone === "danger" ? "text-error" : "text-ink")}>{value}</span>
      {sub && <span className="text-xs font-semibold text-muted">{sub}</span>}
    </section>
  );
}

/** Grey info strip (lists, panels). */
export function InfoNote({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-box bg-white px-4 py-3 text-13 leading-[19px] text-muted">
      {icon && <span className="mt-0.5 shrink-0 text-green-text">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
