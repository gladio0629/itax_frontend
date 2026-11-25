import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleHelp, FileText, Lock, Star, X } from "lucide-react";
import { api } from "@/api/client";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Card } from "@/components/Card";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatMonth, formatNumber, formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LedgerKindCell } from "@/features/wallet/ledgerLabels";
import { KvRows, Notice, OpStat, OrderLink, Section, StatRow, Timeline, signedNumber } from "./cardParts";
import { ORDER_STATUS, opPath, orderNo } from "./labels";
import { OpTable } from "./OpTable";
import { useOpData } from "./useOpData";
import type { OpCancelRow, OpCancelsPeriod, OpComplaintRow, OpDriverDoc, OpDriverTripsFilter, OpTopUp } from "@/api/opCards/types";

/** "noyabrda" from "2026-11". */
export const monthIn = (key: string) => `${formatMonth(key).split(" ")[0].toLowerCase()}da`;
const monthName = (key: string) => formatMonth(key).split(" ")[0];
const monthOptions = (months: string[]) => months.map((m) => ({ value: m, label: monthName(m) }));

function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-white p-5 shadow-card" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
const emptyRow = (text: string) => <p className="py-6 text-center text-13 font-semibold text-muted">{text}</p>;

// ------------------------------------------------------------ Hujjatlar

const DOC_STATUS: Record<OpDriverDoc["status"], { label: string; tone: BadgeTone }> = {
  verified: { label: "Tasdiqlangan", tone: "success" },
  checking: { label: "Tekshirilmoqda", tone: "info" },
  rejected: { label: "Rad etilgan", tone: "danger" },
};

/** Design OpDriverDocs: read-only; checks are automatic. */
export function DriverDocsTab({ driverId }: { driverId: string }) {
  const { data, error, loading, reload } = useOpData(() => api.getOpDriverDocs(driverId), driverId);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Section title="Hujjatlar" right={<Badge tone="info" dot={false}>Avtomatik tekshiruv</Badge>}>
        <ul className="-mt-1 flex flex-col">
          {data.docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-2.5 border-b border-line py-3 last:border-0">
              <div className="flex items-center gap-3.5">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-surface text-ink">
                  <FileText className="h-[18px] w-[18px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-15 font-extrabold text-ink">{d.title}</span>
                  <span className="truncate text-13 font-semibold text-muted">{d.detail}</span>
                </span>
                <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
              </div>
              {d.note && <Notice icon={<CircleHelp />}>{d.note}</Notice>}
              {d.rejectReason && (
                <Notice tone="danger" icon={<X />}>
                  Sabab: {d.rejectReason}
                </Notice>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Tekshiruv tarixi">
        <Timeline items={data.history} />
        <Notice icon={<Lock />}>Operator hujjatni o'zi tasdiqlay olmaydi: tekshiruv avtomatik. Haydovchiga nima qayta yuklashini tushuntiring.</Notice>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------ Hamyon

const TOPUP_PROVIDER: Record<OpTopUp["provider"], string> = { payme: "Payme", click: "Click", card: "Karta" };
const TOPUP_STATUS: Record<OpTopUp["status"], { label: string; tone: BadgeTone }> = {
  ok: { label: "O'tdi", tone: "success" },
  failed: { label: "Xato", tone: "danger" },
  pending: { label: "Kutilmoqda", tone: "warning" },
};

/** Design OpDriverWallet: the ledger (never edited) and top-ups, read-only. */
export function DriverWalletTab({ driverId }: { driverId: string }) {
  const navigate = useNavigate();
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useOpData(() => api.getOpDriverWallet(driverId, { month, page }), `${driverId}|${month}|${page}`);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  const l = data.ledger;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <Section
        title="Hamyon daftari"
        sub="Har yozuv safar yoki to'lovga bog'langan. Daftar o'zgarmaydi."
        right={
          <FilterSelect
            label="Davr"
            aria-label="Daftar davri"
            value={data.month}
            onChange={(m) => {
              setMonth(m);
              setPage(1);
            }}
            options={monthOptions(data.months)}
          />
        }
      >
        {error && <StaleNotice onRetry={reload} />}
        <OpTable
          columns={[
            { key: "at", header: "Vaqt", render: (e) => formatShortDateTime(e.at) },
            { key: "type", header: "Yozuv", render: (e) => <LedgerKindCell kind={e.type} /> },
            {
              key: "ref",
              header: "Bog'liq",
              render: (e) =>
                e.orderId ? <OrderLink to={opPath.order(e.orderId)}>{orderNo(e.orderId)}</OrderLink> : <span className="tabular font-medium text-muted">{e.txnId ?? "—"}</span>,
            },
            { key: "amount", header: "Summa", align: "right", render: (e) => signedNumber(e.amount) },
            { key: "bal", header: "Balans", align: "right", render: (e) => <span className={cn(e.balanceAfter < 0 && "text-error")}>{formatNumber(e.balanceAfter)}</span> },
          ]}
          rows={l.rows}
          rowKey={(e) => e.id}
          onRowClick={(e) => e.orderId && navigate(opPath.order(e.orderId))}
          pageInfo={{ page: l.page, pageSize: l.pageSize, total: l.total, rows: l.rows.length }}
          onPage={setPage}
          loading={loading}
          empty={emptyRow("Bu oyda yozuv yo'q.")}
        />
      </Section>
      <div className="flex min-w-0 flex-col gap-4">
        <Section title="Balans">
          <span className={cn("tabular text-[34px] font-extrabold leading-10", data.balance < 0 ? "text-error" : "text-ink")}>
            {formatNumber(data.balance)} <span className="text-base font-bold text-muted">so'm</span>
          </span>
          <span
            role="meter"
            aria-label="Qarz chegarasigacha"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={data.barPercent}
            className="block h-2 overflow-hidden rounded-full bg-surface"
          >
            <span
              className={cn("block h-full rounded-full transition-[width] duration-500", data.barPercent < 20 ? "bg-error" : data.barPercent < 50 ? "bg-warn" : "bg-green")}
              style={{ width: `${data.barPercent}%` }}
            />
          </span>
          <KvRows
            rows={[
              ["Qarz chegarasi", formatNumber(data.debtLimit)],
              ["Chegaragacha", formatNumber(data.untilLimit)],
              [`${monthName(data.month)} komissiyasi`, formatNumber(data.monthCommission)],
            ]}
          />
        </Section>
        <Section title="To'ldirishlar">
          <OpTable
            columns={[
              { key: "at", header: "Sana", render: (t) => formatShortDateTime(t.at) },
              {
                key: "p",
                header: "To'lov",
                render: (t) => (
                  <span className="flex flex-col">
                    {TOPUP_PROVIDER[t.provider]}
                    <span className="tabular text-xs font-medium text-muted">{t.txnId}</span>
                  </span>
                ),
              },
              { key: "amount", header: "Summa", align: "right", render: (t) => formatNumber(t.amount) },
              { key: "status", header: "Holat", render: (t) => <Badge tone={TOPUP_STATUS[t.status].tone}>{TOPUP_STATUS[t.status].label}</Badge> },
            ]}
            rows={data.topUps}
            rowKey={(t) => t.id}
            empty={emptyRow("To'ldirish yo'q.")}
          />
          <Notice icon={<Lock />}>Pul yechilgan, lekin balansga tushmagan bo'lsa: tranzaksiya ID ni olib, "Menejerga so'rov" → Daftar tuzatish.</Notice>
        </Section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Safarlar

const TRIP_CHIPS: { key: OpDriverTripsFilter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "passenger", label: "Yo'lovchi" },
  { key: "delivery", label: "Dostavka" },
  { key: "cancelled", label: "Bekor qilingan" },
];

/** Design OpDriverTrips: who, from where to where, price and commission. */
export function DriverTripsTab({ driverId }: { driverId: string }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OpDriverTripsFilter>("all");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useOpData(() => api.getOpDriverTrips(driverId, { filter, month, page }), `${driverId}|${filter}|${month}|${page}`);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  const s = data.summary;
  return (
    <>
      <StatRow>
        <OpStat label={monthIn(data.month)} value={formatNumber(s.trips)} sub="safar" />
        <OpStat label="Daromad" value={formatNumber(s.earned)} sub={`so'm, ${monthName(data.month).toLowerCase()}`} />
        <OpStat label="Komissiya" value={formatNumber(s.commission)} sub={`so'm, ${monthName(data.month).toLowerCase()}`} />
        <OpStat label="O'rtacha narx" value={formatNumber(s.avgPrice)} sub="so'm" />
      </StatRow>
      <Card className="flex flex-col gap-4 animate-fade-in">
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterChips
            label="Safar turi"
            items={TRIP_CHIPS.map((c) => ({ ...c, count: data.counts[c.key] ?? 0 }))}
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setPage(1);
            }}
          />
          <span className="flex-1" />
          <FilterSelect
            label="Oy"
            aria-label="Safarlar oyi"
            value={data.month}
            onChange={(m) => {
              setMonth(m);
              setPage(1);
            }}
            options={monthOptions(data.months)}
          />
        </div>
        {error && <StaleNotice onRetry={reload} />}
        <OpTable
          columns={[
            { key: "id", header: "ID", render: (t) => <OrderLink to={opPath.order(t.id)}>{orderNo(t.id)}</OrderLink> },
            {
              key: "route",
              header: "Yo'nalish",
              render: (t) => (
                <span className="inline-flex items-center gap-2.5 font-bold">
                  {t.from}
                  <ArrowRight className="h-3.5 w-3.5 text-muted" aria-label="dan" />
                  {t.to}
                </span>
              ),
            },
            { key: "at", header: "Sana", render: (t) => formatShortDateTime(t.at) },
            {
              key: "who",
              header: "Yo'lovchi",
              render: (t) =>
                t.passenger ? (
                  <span className="tabular">
                    {t.passenger.name} · {t.passenger.phone}
                    {t.bodySize && ` · Kuzov ${t.bodySize}`}
                  </span>
                ) : (
                  "—"
                ),
            },
            { key: "price", header: "Narx", align: "right", render: (t) => formatNumber(t.price) },
            { key: "com", header: "Komissiya", align: "right", render: (t) => (t.commission === null ? "—" : formatNumber(t.commission)) },
            { key: "status", header: "Holat", render: (t) => <Badge tone={ORDER_STATUS[t.status].tone}>{ORDER_STATUS[t.status].label}</Badge> },
          ]}
          rows={data.rows}
          rowKey={(t) => t.id}
          onRowClick={(t) => navigate(opPath.order(t.id))}
          pageInfo={{ page: data.page, pageSize: data.pageSize, total: data.total, rows: data.rows.length }}
          onPage={setPage}
          loading={loading}
          empty={emptyRow("Bu filtrda safar yo'q.")}
        />
      </Card>
    </>
  );
}

// ------------------------------------------------------------ Bekor qilishlar

const CANCEL_PERIODS: { value: OpCancelsPeriod; label: string }[] = [
  { value: "1m", label: "1 oy" },
  { value: "3m", label: "3 oy" },
  { value: "12m", label: "12 oy" },
];
const CANCEL_BY: Record<OpCancelRow["by"], string> = { driver: "Haydovchi", passenger: "Yo'lovchi", system: "Tizim" };
const PENALTY_STATUS: Record<OpCancelRow["penaltyStatus"], { label: string; tone: BadgeTone }> = {
  charged: { label: "Yechildi", tone: "neutral" },
  none: { label: "Jarimasiz", tone: "success" },
  waived: { label: "Bekor qilindi", tone: "info" },
};

/** Design OpDriverCancels: cancels and penalties, read-only. */
export function DriverCancelsTab({ driverId }: { driverId: string }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<OpCancelsPeriod>("3m");
  const { data, error, loading, reload } = useOpData(() => api.getOpDriverCancels(driverId, period), `${driverId}|${period}`);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  const s = data.summary;
  const label = CANCEL_PERIODS.find((p) => p.value === period)?.label ?? "";
  return (
    <>
      <StatRow cols={3}>
        <OpStat label="Haydovchi bekor qilgan" value={s.driverCancels} sub={`so'nggi ${label}`} tone={s.driverCancels > 0 ? "danger" : undefined} />
        <OpStat label="Jarimalar" value={formatNumber(s.penalties)} sub={`so'm, so'nggi ${label}`} />
        <OpStat
          label="Bekor qilish ulushi"
          value={`${s.sharePct.toString().replace(".", ",")}%`}
          sub={`o'rtacha ${s.avgSharePct.toString().replace(".", ",")}%`}
          tone={s.sharePct <= s.avgSharePct ? "success" : "danger"}
        />
      </StatRow>
      <Section
        title="Bekor qilishlar va jarimalar"
        right={<FilterSelect label="Davr" aria-label="Bekor qilishlar davri" value={period} onChange={setPeriod} options={CANCEL_PERIODS} />}
      >
        {error && <StaleNotice onRetry={reload} />}
        <OpTable
          columns={[
            { key: "at", header: "Sana", render: (c) => formatShortDateTime(c.at) },
            { key: "order", header: "Buyurtma", render: (c) => <OrderLink to={opPath.order(c.orderId)}>{orderNo(c.orderId)}</OrderLink> },
            { key: "by", header: "Kim bekor qildi", render: (c) => CANCEL_BY[c.by] },
            { key: "reason", header: "Sabab", render: (c) => <span className="whitespace-normal">{c.reason}</span> },
            { key: "pen", header: "Jarima", align: "right", render: (c) => (c.penalty ? formatNumber(c.penalty) : "—") },
            { key: "status", header: "Holat", render: (c) => <Badge tone={PENALTY_STATUS[c.penaltyStatus].tone}>{PENALTY_STATUS[c.penaltyStatus].label}</Badge> },
          ]}
          rows={data.rows}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(opPath.order(c.orderId))}
          loading={loading}
          empty={emptyRow("Bu davrda bekor qilish yo'q.")}
        />
        <Notice icon={<Lock />}>Jarimani bekor qilish yoki qaytarish faqat menejer orqali: "Menejerga so'rov" → Kompensatsiya.</Notice>
      </Section>
    </>
  );
}

// ------------------------------------------------------------ Shikoyat va baholar

const COMPLAINT_STATUS: Record<OpComplaintRow["status"], { label: string; tone: BadgeTone }> = {
  open: { label: "Ochiq", tone: "danger" },
  reviewing: { label: "Ko'rib chiqilmoqda", tone: "warning" },
  resolved: { label: "Hal qilindi", tone: "success" },
  dismissed: { label: "Rad etildi", tone: "neutral" },
  blocked: { label: "Bloklandi", tone: "neutral" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${n} yulduz`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("h-3.5 w-3.5", i <= n ? "fill-[#F5A700] text-[#F5A700]" : "fill-line text-line")} />
      ))}
    </span>
  );
}

/** Design OpDriverReviews: rating split, complaints and recent reviews. */
export function DriverReviewsTab({ driverId }: { driverId: string }) {
  const { data, error, loading, reload } = useOpData(() => api.getOpDriverReviews(driverId), driverId);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.05fr)]">
      <Section title="Reyting">
        <span className="tabular text-[40px] font-extrabold leading-[44px] text-ink">
          {data.rating ? data.rating.toFixed(2) : "—"}
          <span className="ml-2 text-sm font-bold text-muted">/ 5, so'nggi {data.ratingBasis} safar</span>
        </span>
        <ul className="flex flex-col gap-2.5">
          {data.distribution.map((d) => (
            <li key={d.stars} className="flex items-center gap-3 text-xs font-bold">
              <span className="w-3 text-ink">{d.stars}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                <span className="block h-full rounded-full bg-[#F5A700]" style={{ width: `${d.percent}%` }} />
              </span>
              <span className="tabular w-9 text-right text-muted">{d.percent}%</span>
            </li>
          ))}
        </ul>
      </Section>
      <div className="flex min-w-0 flex-col gap-4">
        <Section
          title="Shikoyatlar"
          right={data.openComplaints > 0 ? <Badge tone="danger" dot={false}>{data.openComplaints} ochiq</Badge> : undefined}
        >
          <OpTable
            columns={[
              { key: "at", header: "Sana", render: (c) => formatShortDateTime(c.at) },
              {
                key: "from",
                header: "Kimdan",
                render: (c) => (
                  <span className="tabular">
                    {c.fromName}
                    {c.fromPhone && ` · ${c.fromPhone}`}
                  </span>
                ),
              },
              {
                key: "topic",
                header: "Mavzu",
                render: (c) => (
                  <span>
                    {c.topic}
                    {c.orderId && (
                      <>
                        {" · "}
                        <OrderLink to={opPath.order(c.orderId)}>{orderNo(c.orderId)}</OrderLink>
                      </>
                    )}
                  </span>
                ),
              },
              { key: "status", header: "Holat", render: (c) => <Badge tone={COMPLAINT_STATUS[c.status].tone}>{COMPLAINT_STATUS[c.status].label}</Badge> },
            ]}
            rows={data.complaints}
            rowKey={(c) => c.id}
            empty={emptyRow("Shikoyat yo'q.")}
          />
        </Section>
        <Section title="Oxirgi baholar">
          {data.reviews.length === 0 ? (
            emptyRow("Hali baho yo'q.")
          ) : (
            <ul className="-mt-1 flex flex-col">
              {data.reviews.map((r) => (
                <li key={r.id} className="flex flex-col gap-1.5 border-b border-line py-3 last:border-0">
                  <span className="flex items-center gap-3">
                    <Stars n={r.stars} />
                    <span className="text-13 font-extrabold text-ink">{r.author}</span>
                    <span className="tabular ml-auto text-xs font-semibold text-muted">{formatShortDateTime(r.at)}</span>
                  </span>
                  {r.text && <span className="text-sm font-medium text-ink">{r.text}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
