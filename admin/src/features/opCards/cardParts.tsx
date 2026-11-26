import { Fragment } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { overlayFromList } from "@/hooks/useCloseOverlay";
import { CheckCheck, Phone } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { OpCardAction, OpTimelineItem } from "@/api/opCards/types";

const pad = (n: number) => String(n).padStart(2, "0");
/** "03.02.2025" */
export const opDate = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
/** "18.11.2026, 14:20" */
export const opDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${opDate(ts)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** "18.11, 14:20" this year, "03.02.2025" for older dates (timelines). */
export const opStamp = (ts: number) => {
  const d = new Date(ts);
  return d.getFullYear() === new Date().getFullYear() ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : opDate(ts);
};
/** "+130 000" / "−5 000" for signed amounts. */
export const signedNumber = (v: number) => (v > 0 ? `+${formatNumber(v)}` : formatNumber(v));

/** Opens the "Menejerga so'rov" modal (built by the other terminal) by
 * setting ?request=<kind>:<id> on the current page. */
export function useOpenRequest() {
  const [params, setParams] = useSearchParams();
  return (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("request", value);
        return next;
      },
      { state: overlayFromList(params) }
    );
}

/** "Yo'lovchilar / P-20931 / Umumiy": the first crumb goes back to the list. */
export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Yo'l" className="flex min-w-0 items-center gap-1.5">
      {items.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>/</span>}
          {c.to ? (
            <Link to={c.to} className="hover:text-ink hover:underline">
              {c.label}
            </Link>
          ) : (
            <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/** Card header: avatar, name + status, info line, "Qo'ng'iroq" and
 * "Menejerga so'rov" (each only when the server allows it). */
export function ProfileHeader({
  name,
  avatarTone = "light",
  badge,
  phone,
  info,
  actions,
  requestValue,
}: {
  name: string;
  avatarTone?: "light" | "green";
  badge: ReactNode;
  phone: string;
  info: ReactNode[];
  actions: OpCardAction[];
  requestValue: string;
}) {
  const openRequest = useOpenRequest();
  return (
    <Card className="flex flex-wrap items-center gap-[18px] px-[22px] py-5">
      <Avatar name={name} size={64} tone={avatarTone} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="text-2xl font-extrabold text-ink">{name}</span>
          {badge}
        </span>
        <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm font-semibold text-muted">
          <span className="tabular text-base font-extrabold tracking-[0.3px] text-ink">{phone}</span>
          {info.map((x, i) => (
            <span key={i} className="tabular">
              {x}
            </span>
          ))}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {actions.includes("call") && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-green px-[18px] text-sm font-extrabold text-ink hover:bg-green-hover"
          >
            <Phone className="h-[18px] w-[18px]" aria-hidden /> Qo'ng'iroq
          </a>
        )}
        {actions.includes("request") && (
          <button
            type="button"
            onClick={() => openRequest(requestValue)}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-[18px] text-sm font-extrabold text-white hover:bg-ink/90"
          >
            <CheckCheck className="h-[18px] w-[18px] text-green" aria-hidden /> Menejerga so'rov
          </button>
        )}
      </div>
    </Card>
  );
}

export type CardTab = { to: string; label: string; count?: number; dot?: boolean; end?: boolean };

/** Card sections as pill links (design: "Karta bo'limlari"). */
export function CardTabs({ items, label }: { items: CardTab[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-13 font-bold transition-colors",
              isActive ? "bg-ink text-white" : "bg-white text-ink shadow-hairline hover:bg-surface"
            )
          }
        >
          {({ isActive }) => (
            <>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={cn("tabular inline-flex h-5 items-center rounded-full px-[7px] text-2xs font-extrabold", isActive ? "bg-white/[0.16]" : "bg-surface")}>
                  {formatNumber(t.count)}
                </span>
              )}
              {t.dot && (
                <>
                  <span aria-hidden className="h-2 w-2 rounded-full bg-[#F04438]" />
                  <span className="sr-only">(diqqat)</span>
                </>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** White section card with a 16/800 title and an optional right slot. */
export function Section({ title, sub, right, children, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("flex min-w-0 flex-col gap-3 animate-fade-in", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-extrabold text-ink">{title}</h2>
          {sub && <span className="text-13 font-semibold text-muted">{sub}</span>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

/** Label / value rows with hairlines ("Profil", "Mashina va imkoniyatlar"). */
export function KvRows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="-mt-1 flex flex-col">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex min-h-[47px] items-center justify-between gap-4 border-b border-line py-2 last:border-0">
          <dt className="text-sm font-semibold text-muted">{k}</dt>
          <dd className="tabular text-right text-sm font-extrabold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** KPI tile (caps label, big value, sub line). */
export function OpStat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "info" | "success" }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-1 rounded-card bg-white px-4 py-3.5 shadow-card">
      <span className="label-caps text-muted">{label}</span>
      <span
        className={cn(
          "tabular text-2xl font-extrabold",
          tone === "danger" ? "text-error" : tone === "info" ? "text-info" : tone === "success" ? "text-green-text" : "text-ink"
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs font-semibold text-muted">{sub}</span>}
    </section>
  );
}

export function StatRow({ cols = 4, children }: { cols?: 3 | 4; children: ReactNode }) {
  return <div className={cn("grid gap-4", cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 xl:grid-cols-4")}>{children}</div>;
}

/** "Holat tarixi": newest first; the first dot is the current state. */
export function Timeline({ items }: { items: OpTimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((t, i) => (
        <li key={t.id} className="relative flex gap-3 pb-3 last:pb-0">
          {i < items.length - 1 && (
            <span aria-hidden className={cn("absolute bottom-0 left-[7px] top-[20px] w-0.5 rounded", i === 0 ? "bg-green" : "bg-line")} />
          )}
          <span
            aria-hidden
            className={cn(
              "relative mt-[3px] h-4 w-4 shrink-0 rounded-full",
              i === 0
                ? "border-[3px] border-green bg-white shadow-[0_0_0_3px_var(--green-soft)]"
                : t.tone === "danger"
                  ? "bg-error"
                  : "border-[3px] border-ink bg-green"
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-15 font-bold text-ink">{t.title}</span>
            {t.detail && <span className="text-13 font-semibold leading-[17px] text-muted">{t.detail}</span>}
          </span>
          <span className="tabular shrink-0 pt-0.5 text-xs font-bold text-muted">{opStamp(t.at)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Info strip: grey (rules, lock icon), warning (orange) or danger (red). */
export function Notice({ icon, tone = "grey", children }: { icon: ReactNode; tone?: "grey" | "warning" | "danger"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-box px-4 py-3 text-13 leading-[19px]",
        tone === "warning" ? "bg-warn-soft text-ink" : tone === "danger" ? "bg-error-soft text-ink" : "bg-surface text-ink/80"
      )}
    >
      <span className={cn("mt-px shrink-0 [&_svg]:h-4 [&_svg]:w-4", tone === "warning" ? "text-warn" : tone === "danger" ? "text-error" : "text-muted")} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Green order link ("#48213") to the operator order page. */
export function OrderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="font-extrabold text-green-text hover:underline">
      {children}
    </Link>
  );
}
