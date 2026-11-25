import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Banknote, CreditCard, Gift, Lock, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/api/client";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Notice, OpStat, OrderLink, Section, StatRow, opDate, signedNumber, useOpenRequest } from "./cardParts";
import { CANCELLED_BY_LABEL, OP_PAYMENT_STATUS, OP_PAYMENT_TYPE, ORDER_STATUS, PAYMENT_LABEL, opPath, orderNo, requestParam } from "./labels";
import { OpTable } from "./OpTable";
import { useOpData } from "./useOpData";
import type { ListPeriod } from "@/api/types";
import type { OpCardAction, OpPassengerOrderRow, OpPassengerOrdersFilter, OpPaymentRow, OpPaymentType, OpPaymentsFilter, OpPromoCode } from "@/api/opCards/types";

const PERIODS: { value: ListPeriod; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "90d", label: "90 kun" },
];

function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-white p-5 shadow-card" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

function RouteCell({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-bold">
      {from}
      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-label="dan" />
      {to}
    </span>
  );
}

function orderBadge(o: { status: OpPassengerOrderRow["status"]; cancelledBy: OpPassengerOrderRow["cancelledBy"] }) {
  const b = o.status === "cancelled" && o.cancelledBy ? CANCELLED_BY_LABEL[o.cancelledBy] : ORDER_STATUS[o.status];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

// ------------------------------------------------------------ Buyurtmalar

const ORDER_CHIPS: { key: OpPassengerOrdersFilter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "active", label: "Faol" },
  { key: "completed", label: "Tugagan" },
  { key: "cancelled", label: "Bekor qilingan" },
];

/** Design OpPassengerOrders. A row opens the operator order page. */
export function PassengerOrdersTab({ passengerId }: { passengerId: string }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OpPassengerOrdersFilter>("all");
  const [period, setPeriod] = useState<ListPeriod>("all");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useOpData(
    () => api.getOpPassengerOrders(passengerId, { status, period, page }),
    `${passengerId}|${status}|${period}|${page}`
  );
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  return (
    <Card className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterChips
          label="Buyurtma holati"
          items={ORDER_CHIPS.map((c) => ({ ...c, count: data.counts[c.key] ?? 0 }))}
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPage(1);
          }}
        />
        <span className="flex-1" />
        <FilterSelect
          label="Sana"
          aria-label="Buyurtma sanasi"
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setPage(1);
          }}
          options={PERIODS}
        />
      </div>
      {error && <StaleNotice onRetry={reload} />}
      <OpTable
        columns={[
          { key: "id", header: "ID", render: (o) => <OrderLink to={opPath.order(o.id)}>{orderNo(o.id)}</OrderLink> },
          { key: "route", header: "Yo'nalish", render: (o) => <RouteCell from={o.from} to={o.to} /> },
          { key: "at", header: "Sana", render: (o) => formatShortDateTime(o.createdAt) },
          {
            key: "driver",
            header: "Haydovchi",
            render: (o) =>
              o.driver ? (
                <span className="tabular">
                  {o.driver.name} · {o.driver.phone}
                </span>
              ) : (
                <span className="text-muted">{o.status === "no_driver" ? "Topilmadi" : "—"}</span>
              ),
          },
          { key: "pay", header: "To'lov", render: (o) => PAYMENT_LABEL[o.payment] },
          { key: "price", header: "Narx", align: "right", render: (o) => formatNumber(o.price) },
          { key: "status", header: "Holat", render: orderBadge },
        ]}
        rows={data.rows}
        rowKey={(o) => o.id}
        onRowClick={(o) => navigate(opPath.order(o.id))}
        pageInfo={{ page: data.page, pageSize: data.pageSize, total: data.total, rows: data.rows.length }}
        onPage={setPage}
        loading={loading}
        empty={<p className="py-8 text-center text-13 font-semibold text-muted">Bu filtrda buyurtma yo'q.</p>}
      />
    </Card>
  );
}

// ------------------------------------------------------------ To'lovlar

const PAY_CHIPS: { key: OpPaymentsFilter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "card", label: "Karta" },
  { key: "payme", label: "Payme" },
  { key: "click", label: "Click" },
  { key: "refund", label: "Qaytarishlar" },
  { key: "tip", label: "Choy puli" },
];

const PAY_ICON: Record<OpPaymentType, { icon: ReactNode; className: string }> = {
  card: { icon: <CreditCard />, className: "bg-surface text-ink" },
  payme: { icon: <CreditCard />, className: "bg-[#E6F8F8] text-[#0E7C86]" },
  click: { icon: <CreditCard />, className: "bg-info-soft text-info" },
  cash: { icon: <Banknote />, className: "bg-surface text-ink" },
  refund: { icon: <RotateCw />, className: "bg-green-soft text-green-text" },
  tip: { icon: <Gift />, className: "bg-green-soft text-green-text" },
};

function PayType({ type }: { type: OpPaymentType }) {
  const p = PAY_ICON[type];
  return (
    <span className="inline-flex items-center gap-2.5 font-bold">
      <span aria-hidden className={cn("flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5", p.className)}>
        {p.icon}
      </span>
      {OP_PAYMENT_TYPE[type]}
    </span>
  );
}

/** Design OpPassengerPay: totals, the payment list with transaction IDs,
 * and "Qaytarish so'rash" (a manager request) when the server allows it. */
export function PassengerPayTab({ passengerId, actions }: { passengerId: string; actions: OpCardAction[] }) {
  const openRequest = useOpenRequest();
  const [type, setType] = useState<OpPaymentsFilter>("all");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useOpData(() => api.getOpPassengerPayments(passengerId, { type, page }), `${passengerId}|${type}|${page}`);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  const s = data.summary;
  const txn = (r: OpPaymentRow) =>
    !r.txnId ? "—" : r.cardLast4 ? `${r.txnId} · •••• ${r.cardLast4}` : r.txnId;
  return (
    <>
      <StatRow>
        <OpStat label="To'langan" value={formatNumber(s.paid)} sub="so'm, jami" />
        <OpStat label="Qaytarilgan" value={formatNumber(s.refunded)} sub={`${s.refundCount} ta qaytarish`} tone={s.refunded > 0 ? "info" : undefined} />
        <OpStat label="Choy puli" value={formatNumber(s.tips)} sub={`${s.tipCount} marta`} />
        <OpStat
          label="Xato to'lovlar"
          value={s.failedCount}
          sub={s.lastFailed ? `${OP_PAYMENT_TYPE[s.lastFailed.type]}, ${opDate(s.lastFailed.at).slice(0, 5)}` : "yo'q"}
          tone={s.failedCount > 0 ? "danger" : undefined}
        />
      </StatRow>
      <Card className="flex flex-col gap-4 animate-fade-in">
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterChips
            label="To'lov turi"
            items={PAY_CHIPS.map((c) => ({ ...c, count: data.counts[c.key] ?? 0 }))}
            value={type}
            onChange={(t) => {
              setType(t);
              setPage(1);
            }}
          />
          <span className="flex-1" />
          {actions.includes("refund_request") && (
            <button
              type="button"
              onClick={() => openRequest(requestParam("passenger", passengerId))}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-[18px] text-sm font-extrabold text-white hover:bg-ink/90"
            >
              <RotateCw className="h-[18px] w-[18px] text-green" aria-hidden /> Qaytarish so'rash
            </button>
          )}
        </div>
        {error && <StaleNotice onRetry={reload} />}
        <OpTable
          columns={[
            { key: "at", header: "Sana", render: (r) => formatShortDateTime(r.at) },
            { key: "type", header: "Turi", render: (r) => <PayType type={r.type} /> },
            { key: "order", header: "Buyurtma", render: (r) => (r.orderId ? <OrderLink to={opPath.order(r.orderId)}>{orderNo(r.orderId)}</OrderLink> : "—") },
            { key: "txn", header: "Tranzaksiya ID", render: (r) => <span className="tabular font-medium text-muted">{txn(r)}</span> },
            { key: "amount", header: "Summa", align: "right", render: (r) => (r.type === "refund" ? signedNumber(r.amount) : formatNumber(r.amount)) },
            { key: "status", header: "Holat", render: (r) => <Badge tone={OP_PAYMENT_STATUS[r.status].tone}>{OP_PAYMENT_STATUS[r.status].label}</Badge> },
          ]}
          rows={data.rows}
          rowKey={(r) => r.id}
          pageInfo={{ page: data.page, pageSize: data.pageSize, total: data.total, rows: data.rows.length }}
          onPage={setPage}
          loading={loading}
          empty={<p className="py-8 text-center text-13 font-semibold text-muted">Bu turda to'lov yo'q.</p>}
        />
        <Notice icon={<Lock />}>
          Operator pulni o'zi qaytara olmaydi. Qaytarish yoki kompensatsiya kerak bo'lsa, "Menejerga so'rov" yuboring: holatini Tarix → Mening vazifalarimda
          ko'rasiz.
        </Notice>
      </Card>
    </>
  );
}

// ------------------------------------------------------------ Bonus va promo

const discountText = (d: OpPromoCode["discount"]) =>
  "percent" in d ? `${d.percent}%${d.maxAmount ? `, ${formatNumber(d.maxAmount)} gacha` : ""}` : `${formatNumber(d.amount)} so'm`;
const PROMO_STATUS: Record<OpPromoCode["status"], { label: string; tone: "success" | "neutral" }> = {
  active: { label: "Faol", tone: "success" },
  used: { label: "Ishlatilgan", tone: "neutral" },
  expired: { label: "Muddati o'tgan", tone: "neutral" },
};

/** Design OpPassengerBonus: bonus ledger and promo codes (read-only). */
export function PassengerBonusTab({ passengerId }: { passengerId: string }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useOpData(() => api.getOpPassengerBonus(passengerId), passengerId);
  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data) return <Loading />;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Section
        title="Bonus"
        sub="Keshbek, sovg'alar va ishlatilganlari"
        right={<span className="tabular inline-flex h-7 items-center rounded-lg bg-green-soft px-2.5 text-xs font-extrabold text-green-text">{formatNumber(data.balance)} so'm</span>}
      >
        <OpTable
          columns={[
            { key: "at", header: "Sana", render: (e) => formatShortDateTime(e.at) },
            { key: "text", header: "Yozuv", render: (e) => e.text },
            { key: "order", header: "Buyurtma", render: (e) => (e.orderId ? <OrderLink to={opPath.order(e.orderId)}>{orderNo(e.orderId)}</OrderLink> : "—") },
            { key: "amount", header: "Summa", align: "right", render: (e) => signedNumber(e.amount) },
            { key: "bal", header: "Balans", align: "right", render: (e) => formatNumber(e.balanceAfter) },
          ]}
          rows={data.entries}
          rowKey={(e) => e.id}
          onRowClick={(e) => e.orderId && navigate(opPath.order(e.orderId))}
          empty={<p className="py-6 text-center text-13 font-semibold text-muted">Bonus yozuvlari yo'q.</p>}
        />
      </Section>
      <Section title="Promo kodlar" sub="Yo'lovchi kiritgan va unga berilgan kodlar">
        <OpTable
          columns={[
            { key: "code", header: "Kod", render: (p) => <span className="font-extrabold">{p.code}</span> },
            { key: "disc", header: "Chegirma", render: (p) => discountText(p.discount) },
            { key: "used", header: "Ishlatildi", render: (p) => (p.usedAt ? opDate(p.usedAt) : p.validUntil ? `${opDate(p.validUntil).slice(0, 5)} gacha` : "—") },
            { key: "status", header: "Holat", render: (p) => <Badge tone={PROMO_STATUS[p.status].tone}>{PROMO_STATUS[p.status].label}</Badge> },
          ]}
          rows={data.promos}
          rowKey={(p) => p.code}
          empty={<p className="py-6 text-center text-13 font-semibold text-muted">Promo kod yo'q.</p>}
        />
        <Notice icon={<Gift />}>Promo kod yoki bonus berish kerak bo'lsa, "Menejerga so'rov" → Kompensatsiya.</Notice>
      </Section>
    </div>
  );
}
