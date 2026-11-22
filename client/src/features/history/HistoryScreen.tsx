import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderStatus, OrderWithDetails, ServiceType } from "@/api/types";
import { formatNumber, monthNames, SOM_LABEL } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { HeaderBar, Icon, Screen, SectionLabel, StateEmpty, StateError, StateLoading, TextButton, useShellChrome } from "@/ui";
import { DriverAvatar, payLabel, shortName } from "@/features/live/LiveParts";

type Service = "all" | ServiceType;
const SERVICES: Service[] = ["all", "passenger", "delivery"];
const SERVICE_KEY: Record<Service, TranslationKey> = { all: "history.service.all", passenger: "history.service.passenger", delivery: "history.service.delivery" };

type Status = "all" | "completed" | "cancelled";
const STATUSES: Status[] = ["all", "completed", "cancelled"];
const STATUS_KEY: Record<Status, TranslationKey> = { all: "history.filter.all", completed: "history.filter.completed", cancelled: "history.filter.cancelled" };

const LIVE: OrderStatus[] = ["searching", "accepted", "in_progress"];
const BADGE: Partial<Record<OrderStatus, { key: TranslationKey; tone: "danger" | "green" | "muted" }>> = {
  cancelled: { key: "history.status.cancelled", tone: "danger" },
  no_driver: { key: "history.status.noDriver", tone: "muted" },
  searching: { key: "history.status.live", tone: "green" },
  accepted: { key: "history.status.live", tone: "green" },
  in_progress: { key: "history.status.live", tone: "green" },
};

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** The searched text, marked in a name (design KbHistory). */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-iz-green-soft font-extrabold text-iz-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function DateTile({ ts, light }: { ts: number; light?: boolean }) {
  const { intlTag } = useT();
  const d = new Date(ts);
  return (
    <span aria-hidden className={cn("flex h-[62px] w-[54px] shrink-0 flex-col items-center justify-center rounded-2xl", light ? "bg-iz-sheet" : "bg-iz-head")}>
      <span className={cn("text-[20px] font-extrabold leading-6", light ? "text-iz-ink" : "text-iz-head-text")}>{d.getDate()}</span>
      <span className={cn("text-[10px] font-extrabold uppercase tracking-[0.8px]", light ? "text-iz-muted" : "text-iz-green")}>{monthNames(intlTag)[d.getMonth()].slice(0, 3)}</span>
    </span>
  );
}

function OrderCard({ o, q }: { o: OrderWithDetails; q: string }) {
  const { t, intlTag } = useT();
  const badge = BADGE[o.status];
  const dimmed = o.status === "cancelled" || o.status === "no_driver";
  const delivery = o.extras?.serviceType === "delivery";
  const service = delivery ? (o.cargoSize ? t("history.deliverySize", { size: o.cargoSize }) : t("history.service.delivery")) : "";
  const sub = dimmed ? [o.fromCity.name, service || t("history.service.passenger")].join(" · ") : [`${o.fromCity.name}, ${hhmm(o.startedAt ?? o.createdAt)}`, service].filter(Boolean).join(" · ");
  const to = `/${LIVE.includes(o.status) ? "order/track" : "history"}/${o.id}`;
  const top = (
    <span className="flex items-center gap-3.5">
      <DateTile ts={o.createdAt} light={dimmed} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[12px] font-semibold text-iz-muted">{sub}</span>
        <span className="truncate text-[17px] font-extrabold text-iz-ink">
          <Highlight text={o.toCity.name} q={q} />
        </span>
      </span>
      {badge && dimmed ? (
        <span
          className={cn(
            "flex h-7 shrink-0 items-center whitespace-nowrap rounded-[14px] px-2.5 text-[12px] font-extrabold",
            badge.tone === "danger" ? "bg-iz-danger-soft text-iz-danger" : "bg-iz-sheet text-iz-muted"
          )}
        >
          {t(badge.key)}
        </span>
      ) : (
        <span className="flex shrink-0 flex-col items-end gap-[3px]">
          <span className="whitespace-nowrap text-[16px] font-extrabold tabular-nums text-iz-ink">{formatNumber(o.price, intlTag)}</span>
          <span className="text-[12px] font-semibold text-iz-muted">{`${SOM_LABEL} · ${payLabel(o, t).toLocaleLowerCase()}`}</span>
        </span>
      )}
    </span>
  );
  if (dimmed) {
    return (
      <Link to={to} className="flex shrink-0 flex-col rounded-iz-card bg-iz-field p-3.5 active:opacity-80">
        {top}
      </Link>
    );
  }
  return (
    <Link to={to} className="flex shrink-0 flex-col gap-3 rounded-iz-card border border-iz-border p-3.5 active:bg-iz-field">
      {top}
      {!q && (o.driver || badge) && (
        <>
          <span aria-hidden className="h-0 border-t-2 border-dashed border-iz-border" />
          <span className="flex items-center gap-2.5">
            {o.driver && <DriverAvatar name={o.driver.name || t("driver.unnamed")} size={32} tone="light" />}
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-iz-ink">{o.driver ? (o.driver.name ? shortName(o.driver.name) : t("driver.unnamed")) : ""}</span>
            {badge ? (
              <span className="flex h-[30px] items-center rounded-[15px] bg-iz-green-soft px-2.5 text-[13px] font-extrabold text-iz-green-text">{t(badge.key)}</span>
            ) : (
              o.rating != null &&
              o.rating > 0 && (
                <span className="flex h-[30px] items-center gap-[5px] rounded-[15px] bg-iz-field px-2.5 text-[13px] font-extrabold text-iz-ink" aria-label={t("rate.star", { n: o.rating })}>
                  <Icon name="star" size={14} filled />
                  {o.rating}
                </span>
              )
            )}
          </span>
        </>
      )}
    </Link>
  );
}

type List = { orders: OrderWithDetails[]; cursor: number | null; state: "loading" | "error" | "ready" };

/**
 * Tarix (design v2: History / KbHistory): search by city or driver, the
 * Yo'lovchi / Dostavka filter and the status filter (current app) — all
 * applied by the server; cards grouped by month. A live order opens its
 * tracking screen.
 */
export function HistoryScreen() {
  const { t, intlTag } = useT();
  const navigate = useNavigate();
  const shell = useShellChrome();
  const [params, setParams] = useSearchParams();
  const service: Service = (SERVICES as string[]).includes(params.get("service") ?? "") ? (params.get("service") as Service) : "all";
  const status: Status = (STATUSES as string[]).includes(params.get("status") ?? "") ? (params.get("status") as Status) : "all";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(q.trim());
  const [focused, setFocused] = useState(false);
  const [list, setList] = useState<List>({ orders: [], cursor: 0, state: "loading" });
  const inputRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const searchOn = api.capabilities.historySearch;
  const statusOn = api.capabilities.historyStatusFilter;

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  // The search goes to the server after a short pause in typing.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(q.trim());
      setParam("q", q.trim() || null);
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function load(reset: boolean) {
    const id = ++request.current;
    setList((l) => ({ ...l, state: "loading", ...(reset ? { orders: [], cursor: 0 } : {}) }));
    api
      .getOrderHistory({
        status: status === "all" ? undefined : status,
        service: searchOn && service !== "all" ? service : undefined,
        q: searchOn && query ? query : undefined,
        cursor: reset ? 0 : list.cursor ?? 0,
      })
      .then((page) => {
        if (id !== request.current) return;
        setList((l) => ({ orders: reset ? page.orders : [...l.orders, ...page.orders], cursor: page.nextCursor, state: "ready" }));
      })
      .catch(() => id === request.current && setList((l) => ({ ...l, state: "error" })));
  }
  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, status, query]);

  const searching = focused || q !== "";
  const filtered = service !== "all" || status !== "all" || !!query;

  // Month headings ("NOYABR 2026") over the cards.
  const groups: { label: string; orders: OrderWithDetails[] }[] = [];
  for (const o of list.orders) {
    const d = new Date(o.createdAt);
    const label = `${monthNames(intlTag)[d.getMonth()]} ${d.getFullYear()}`;
    const last = groups[groups.length - 1];
    if (last?.label === label) last.orders.push(o);
    else groups.push({ label, orders: [o] });
  }

  const search = searchOn && (
    <div className="flex items-center gap-2.5">
      <label
        className={cn(
          "flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 transition-colors",
          searching ? "bg-iz-sheet text-iz-ink shadow-[0_0_0_4px_rgb(var(--iz-green-rgb)/0.25)]" : "border border-iz-head-border text-iz-head-muted"
        )}
      >
        <Icon name="search" size={18} className="shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={t("history.searchLabel")}
          placeholder={t("history.searchPlaceholder")}
          enterKeyHint="search"
          className={cn(
            "iz-input h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] outline-none placeholder:font-semibold",
            searching ? "font-bold text-iz-ink placeholder:text-iz-muted" : "font-semibold text-iz-head-text placeholder:text-iz-head-muted"
          )}
        />
      </label>
      {searching && (
        <button
          type="button"
          // Keeps the input from blurring first, so one tap clears and closes.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQ("");
            inputRef.current?.blur();
          }}
          className="flex h-11 shrink-0 items-center px-1 text-[14px] font-bold text-iz-green"
        >
          {t("history.searchCancel")}
        </button>
      )}
    </div>
  );

  const serviceSwitch = searchOn && (
    <div role="radiogroup" aria-label={t("history.serviceLabel")} className="grid h-[52px] grid-cols-3 gap-1 rounded-full bg-iz-head-card p-1">
      {SERVICES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={service === s}
          onClick={() => setParam("service", s === "all" ? null : s)}
          className={cn("min-w-0 truncate rounded-full px-1 text-[14px]", service === s ? "bg-iz-green font-extrabold text-iz-on-green" : "font-semibold text-iz-head-soft")}
        >
          {t(SERVICE_KEY[s])}
        </button>
      ))}
    </div>
  );

  let body: ReactNode;
  if (list.state === "error" && list.orders.length === 0) body = <StateError onRetry={() => load(true)} />;
  else if (list.state === "loading" && list.orders.length === 0) body = <StateLoading rows={4} />;
  else if (list.orders.length === 0)
    body = filtered ? (
      <StateEmpty title={t("history.noResults")} description={t("history.noResultsDesc")} />
    ) : (
      <StateEmpty title={t("history.emptyTitle")} description={t("history.emptyDesc")} actionLabel={t("history.emptyAction")} onAction={() => navigate("/home")} />
    );
  else
    body = (
      <>
        {query && <SectionLabel>{t("history.results", { n: list.cursor != null ? `${list.orders.length}+` : list.orders.length })}</SectionLabel>}
        {groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-3" aria-label={g.label}>
            {!query && <SectionLabel as="h2">{g.label}</SectionLabel>}
            {g.orders.map((o) => (
              <OrderCard key={o.id} o={o} q={query} />
            ))}
          </section>
        ))}
        {list.state === "error" && <StateError onRetry={() => load(false)} />}
        {list.cursor != null && list.state !== "error" && (
          <TextButton tone="ink" loading={list.state === "loading"} onClick={() => load(false)}>
            {t("history.loadMore")}
          </TextButton>
        )}
      </>
    );

  return (
    <Screen
      header={
        <>
          <div className={cn(searching && "hidden")}>
            <HeaderBar title={t("drawer.tarix")} onBack={shell?.action} backLabel={shell?.leading === "menu" ? t("drawer.open") : undefined} />
          </div>
          {search}
        </>
      }
      top={!searching && serviceSwitch ? serviceSwitch : undefined}
      bodyClassName="gap-3 pt-6"
    >
      {statusOn && !searching && (
        <div role="radiogroup" aria-label={t("history.tabsLabel")} className="flex shrink-0 gap-2 overflow-x-auto no-scrollbar">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setParam("status", s === "all" ? null : s)}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-[13px]",
                status === s ? "bg-iz-selected font-bold text-iz-on-selected" : "border border-iz-chip-border font-semibold text-iz-ink"
              )}
            >
              {t(STATUS_KEY[s])}
            </button>
          ))}
        </div>
      )}
      {body}
    </Screen>
  );
}
