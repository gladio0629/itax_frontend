import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Armchair, Car, ChevronRight, Package, Search, UserRound } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FilterChips } from "@/components/FilterChips";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { driverBadge } from "@/features/drivers/driverLabels";
import { ORDER_STATUS, PASSENGER_STATUS, opPath, orderNo } from "./labels";
import type { OpSearchResult } from "@/api/opCards/types";

type Group = "all" | "passengers" | "drivers" | "orders";
/** Rows per group in the "Hammasi" view; a group chip shows all hits. */
const PREVIEW = 5;

/** "Qidiruv" (design OpSearch): one field for phone, name, order ID or
 * plate; results grouped into passengers, drivers and orders. The query
 * lives in ?q= so Back returns to the same results. */
export function OpSearchScreen() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const [group, setGroup] = useState<Group>("all");
  const [result, setResult] = useState<OpSearchResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setText(q), [q]);
  useEffect(() => inputRef.current?.focus(), []);

  const run = () => {
    const id = ++reqRef.current;
    if (!q.trim()) {
      setResult(null);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    api
      .opSearch(q)
      .then((r) => id === reqRef.current && setResult(r))
      .catch(() => id === reqRef.current && setError(true))
      .finally(() => id === reqRef.current && setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, [q]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    setGroup("all");
    if (v === q) run();
    else setParams(v ? { q: v } : {}, { replace: false });
  }

  const c = result?.counts;
  const chips = [
    { key: "all" as const, label: "Hammasi", count: c ? c.passengers + c.drivers + c.orders : undefined },
    { key: "passengers" as const, label: "Yo'lovchilar", count: c?.passengers },
    { key: "drivers" as const, label: "Haydovchilar", count: c?.drivers },
    { key: "orders" as const, label: "Buyurtmalar", count: c?.orders },
  ];
  const show = (g: Exclude<Group, "all">) => (group === "all" || group === g) && !!result && result[g].length > 0;
  const empty = result && c && c.passengers + c.drivers + c.orders === 0;
  const cut = <T,>(rows: T[]) => (group === "all" ? rows.slice(0, PREVIEW) : rows);

  const passengers = show("passengers") && result && (
    <ResultCard title="Yo'lovchilar" count={result.counts.passengers}>
      {cut(result.passengers).map((p) => (
        <ResultRow
          key={p.id}
          to={opPath.passenger(p.id)}
          icon={<UserRound />}
          title={p.name}
          sub={`${p.phone} · ${formatNumber(p.ordersCount)} ta buyurtma`}
          badge={<Badge tone={PASSENGER_STATUS[p.status].tone}>{PASSENGER_STATUS[p.status].label}</Badge>}
        />
      ))}
    </ResultCard>
  );
  const drivers = show("drivers") && result && (
    <ResultCard title="Haydovchilar" count={result.counts.drivers}>
      {cut(result.drivers).map((d) => {
        const b = driverBadge({ ...d, archived: false });
        return (
          <ResultRow
            key={d.id}
            to={opPath.driver(d.id)}
            icon={<Car />}
            title={d.name}
            sub={[d.phone, d.carModel, d.plate].filter(Boolean).join(" · ")}
            badge={<Badge tone={b.tone}>{b.label}</Badge>}
          />
        );
      })}
    </ResultCard>
  );
  const orders = show("orders") && result && (
    <ResultCard title="Buyurtmalar" count={result.counts.orders}>
      {cut(result.orders).map((o) => (
        <ResultRow
          key={o.id}
          to={opPath.order(o.id)}
          icon={o.kind === "delivery" ? <Package /> : <Armchair />}
          title={`${orderNo(o.id)} · ${o.from} → ${o.to}`}
          sub={[
            formatShortDateTime(o.createdAt),
            o.person && `${o.person.role === "driver" ? "haydovchi" : "yo'lovchi"} ${o.person.name}`,
            formatNumber(o.price),
          ]
            .filter(Boolean)
            .join(" · ")}
          badge={<Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>}
        />
      ))}
    </ResultCard>
  );

  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Qidiruv" />

      <form role="search" onSubmit={submit} className="flex flex-col gap-2.5">
        <label className="flex h-[68px] items-center gap-3.5 rounded-field bg-white pl-5 pr-2.5 shadow-[inset_0_0_0_2px_var(--ink)] focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]">
          <Search className="h-[22px] w-[22px] shrink-0 text-ink" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Telefon, ism, buyurtma ID yoki davlat raqami"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-xl font-bold text-ink outline-none focus-visible:shadow-none"
          />
          <Button type="submit" loading={loading}>
            Qidirish
          </Button>
        </label>
        <span className="text-13 font-semibold text-muted">
          Telefon, ism, buyurtma ID yoki davlat raqami bo'yicha. Masalan: +998 90 000 00 01, #48213, 01 A 123 BC
        </span>
      </form>

      {result && !empty && <FilterChips label="Natija turi" items={chips} value={group} onChange={setGroup} />}

      {error ? (
        <ErrorState onRetry={run} retrying={loading} />
      ) : !q.trim() ? (
        <EmptyState icon={<Search />} title="Kimni qidiramiz?" description="Telefon, ism, buyurtma ID yoki davlat raqamini yozing." />
      ) : !result ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy>
          <Skeleton className="h-[220px] rounded-card" />
          <Skeleton className="h-[220px] rounded-card" />
        </div>
      ) : empty ? (
        <EmptyState icon={<Search />} title="Hech narsa topilmadi" description="Raqam yoki ismni tekshirib, qayta qidiring." />
      ) : group === "all" ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {(passengers || drivers) && (
            <div className="flex min-w-0 flex-col gap-4">
              {passengers}
              {drivers}
            </div>
          )}
          {orders}
        </div>
      ) : (
        <div className="grid items-start gap-4">{passengers || drivers || orders || <NothingInGroup />}</div>
      )}
    </>
  );
}

function NothingInGroup() {
  return <EmptyState icon={<Search />} title="Bu turda natija yo'q" description="Boshqa turni tanlang yoki qidiruvni o'zgartiring." />;
}

function ResultCard({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-card bg-white px-5 py-[18px] shadow-card animate-fade-in">
      <h2 className="text-base font-extrabold text-ink">
        {title} <span className="tabular font-bold text-muted">{formatNumber(count)}</span>
      </h2>
      <ul className="-mt-1.5 flex flex-col">{children}</ul>
    </section>
  );
}

function ResultRow({ to, icon, title, sub, badge }: { to: string; icon: ReactNode; title: string; sub: string; badge: ReactNode }) {
  return (
    <li className="border-b border-line last:border-0">
      <Link to={to} className="group flex min-h-16 items-center gap-3.5 rounded-box py-2.5 text-ink hover:bg-row-hover">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-surface [&_svg]:h-[18px] [&_svg]:w-[18px]" aria-hidden>
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-15 font-extrabold">{title}</span>
          <span className="tabular truncate text-13 font-semibold text-muted">{sub}</span>
        </span>
        {badge}
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted group-hover:text-ink" aria-hidden />
      </Link>
    </li>
  );
}
