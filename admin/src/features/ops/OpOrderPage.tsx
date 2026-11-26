import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { overlayFromList } from "@/hooks/useCloseOverlay";
import { Ban, CreditCard, MapPin, MessageSquareText, Phone, RotateCcw, Send, Wallet, Banknote } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle } from "@/components/Card";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { cn } from "@/lib/cn";
import { formatAgo, formatDateTime, formatNumber, formatTime } from "@/lib/format";
import { ORDER_STATUS, orderNo } from "@/features/orders/labels";
import { OpCancelModal } from "./OpCancelModal";
import { requestParam } from "./requestParam";
import { opPath } from "./paths";
import type { OpOrderAction, OpOrderDetail, OpOrderStep, OpOrderStop, OpPaymentStatus } from "@/api/ops/types";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const PAYMENT_STATUS: Record<OpPaymentStatus, { label: string; tone: BadgeTone }> = {
  held: { label: "Ushlab turilgan", tone: "info" },
  pending: { label: "Kutilmoqda", tone: "neutral" },
  paid: { label: "To'langan", tone: "success" },
  refunded: { label: "Qaytarilgan", tone: "warning" },
  failed: { label: "Xato", tone: "danger" },
};

const pill = "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[18px] text-sm font-extrabold transition-colors";

/** `/operators/orders/:id` (design OpOrder, OpOrderCargo). One page for both
 * kinds: blocks the server leaves empty are not shown. Every action button
 * appears only when `allowedActions` lists it. */
export function OpOrderPage() {
  const { orderId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [order, setOrder] = useState<OpOrderDetail | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(false);
    api
      .getOpOrder(orderId)
      .then((o) => live && setOrder(o))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [orderId]);
  useEffect(() => load(), [load]);

  const can = (a: OpOrderAction) => !!order?.allowedActions.includes(a);

  async function restart() {
    if (!order || restarting) return;
    setRestarting(true);
    setActionError(null);
    try {
      setOrder(await api.restartOrderSearch(order.id));
      setToast("Qidiruv qayta boshlandi");
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setRestarting(false);
    }
  }

  function openRequest() {
    if (!order) return;
    const next = new URLSearchParams(params);
    next.set("request", requestParam("order", order.id));
    setParams(next, { state: overlayFromList(params) });
  }

  const no = orderNo(orderId);
  const crumb = (
    <>
      <Link to={opPath.orders} className="hover:text-ink hover:underline">
        Buyurtmalar
      </Link>{" "}
      / {no}
      {order?.kind === "delivery" ? " · dostavka" : ""}
    </>
  );

  if (error && !order) {
    return (
      <>
        <PageHeader back={opPath.orders} subtitle={crumb} title={`Buyurtma ${no}`} />
        <ErrorState onRetry={load} retrying={loading} />
      </>
    );
  }
  if (!order) {
    return (
      <>
        <PageHeader back={opPath.orders} subtitle={crumb} title={`Buyurtma ${no}`} />
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-[132px] rounded-card" />
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <Skeleton className="h-[420px] rounded-card" />
            <Skeleton className="h-[420px] rounded-card" />
          </div>
        </div>
      </>
    );
  }

  const status = ORDER_STATUS[order.status];
  const cargo = order.kind === "delivery";
  const summary = [
    cargo ? "Dostavka" : "Yo'lovchi",
    !cargo && order.seats ? `${order.seats} o'rin` : null,
    order.carClassLabel,
    cargo && order.cargo ? `Kuzov ${order.cargo.bodySize}` : null,
    order.paymentLabel,
    `yaratildi ${formatDateTime(order.createdAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader back={opPath.orders} subtitle={crumb} title={`Buyurtma ${no}`} />

      <Card className="flex flex-col gap-4 px-[22px]">
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="text-[24px] font-extrabold leading-8">Buyurtma {no}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
          <span className="text-sm font-semibold text-muted">{summary}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("call_passenger") && order.customer.phone && (
            <a href={tel(order.customer.phone)} className={cn(pill, "bg-green text-ink hover:bg-green-hover")}>
              <Phone className="h-4 w-4" aria-hidden /> {cargo ? "Jo'natuvchiga qo'ng'iroq" : "Yo'lovchiga qo'ng'iroq"}
            </a>
          )}
          {can("call_driver") && order.driver && (
            <a href={tel(order.driver.phone)} className={cn(pill, "bg-surface text-ink hover:bg-line")}>
              <Phone className="h-4 w-4" aria-hidden /> Haydovchiga qo'ng'iroq
            </a>
          )}
          {can("restart_search") && (
            <button type="button" onClick={restart} disabled={restarting} aria-busy={restarting} className={cn(pill, "bg-surface text-ink hover:bg-line disabled:opacity-60")}>
              <RotateCcw className={cn("h-4 w-4", restarting && "animate-spin")} aria-hidden /> Qidiruvni qayta boshlash
            </button>
          )}
          <span className="flex-1" />
          {can("cancel") && (
            <button type="button" onClick={() => setCancelOpen(true)} className={cn(pill, "bg-error-soft text-error hover:bg-[#FBD9D5]")}>
              <Ban className="h-4 w-4" aria-hidden /> Bekor qilish
            </button>
          )}
          {can("manager_request") && (
            <button type="button" onClick={openRequest} className={cn(pill, "bg-ink text-white hover:bg-ink-2")}>
              <Send className="h-4 w-4" aria-hidden /> Menejerga so'rov
            </button>
          )}
        </div>
        {actionError && (
          <p role="alert" className="text-13 font-semibold text-error">
            {actionError}
          </p>
        )}
      </Card>

      <div className={cn("grid gap-3", cargo && order.recipients.length ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <PersonCard label={cargo ? "Jo'natuvchi" : "Yo'lovchi"} name={order.customer.name} sub={order.customer.phone} to={order.customer.id ? opPath.passenger(order.customer.id) : undefined} />
        {order.driver ? (
          <PersonCard
            label="Haydovchi"
            name={order.driver.name}
            sub={[order.driver.phone, order.driver.plate].filter(Boolean).join(" · ")}
            to={order.driver.id ? opPath.driver(order.driver.id) : undefined}
            green
          />
        ) : (
          <div className="flex flex-col gap-2.5 rounded-2xl p-3.5 shadow-hairline">
            <span className="label-caps text-muted">Haydovchi</span>
            <span className="text-sm font-semibold text-muted">Hali tayinlanmagan</span>
          </div>
        )}
        {cargo && order.recipients.length > 0 && (
          <div className="flex flex-col gap-2.5 rounded-2xl p-3.5 shadow-hairline">
            <span className="label-caps text-muted">Qabul qiluvchi ({order.recipients.length})</span>
            {order.recipients.map((r, i) => (
              <Person key={i} name={r.name} sub={r.phone} />
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.15fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <CardTitle>Holatlar tarixi</CardTitle>
            <Timeline steps={order.timeline} />
          </Card>
          <Card className="flex flex-col gap-1">
            <CardTitle className="pb-2">{cargo ? "Tushirish nuqtalari" : "Yo'nalish va to'xtashlar"}</CardTitle>
            <ul className="flex flex-col">
              {order.stops.map((s, i) => (
                <StopRow key={i} stop={s} label={stopLabel(s, order.stops, cargo)} last={i === order.stops.length - 1} />
              ))}
            </ul>
            {order.lastLocation && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="label-caps text-muted">Haydovchining oxirgi joylashuvi</span>
                <div className="flex items-center gap-3 rounded-box bg-surface px-4 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green text-ink">
                    <MapPin className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-bold">{order.lastLocation.text}</span>
                    <span className="text-xs font-semibold text-muted">
                      {formatAgo(order.lastLocation.at)}
                      {order.lastLocation.speedKmh !== null ? ` · ${order.lastLocation.speedKmh} km/s` : ""}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {order.cargo && (
            <Card className="flex flex-col gap-1">
              <CardTitle className="pb-1">Yuk</CardTitle>
              <InfoRow label="Kuzov" value={[order.cargo.bodySize, order.cargo.bodyDims, order.cargo.maxKg ? `${formatNumber(order.cargo.maxKg)} kg gacha` : null].filter(Boolean).join(" · ")} />
              {order.cargo.items && <InfoRow label="Yuk" value={order.cargo.items} />}
              <InfoRow label="Yukchi" value={order.cargo.loaders ? `${order.cargo.loaders} kishi` : "Yo'q"} />
              <InfoRow label="Narx usuli" value={order.cargo.pricing === "hourly" ? "Soatbay" : "Marshrut bo'yicha"} />
              <InfoRow label="Hamroh" value={order.cargo.companion ? "Bor" : "Yo'q"} />
              <InfoRow
                label="Sug'urta"
                value={order.cargo.insurance ? <Badge tone="success">Bor · {order.cargo.insurance}</Badge> : "Yo'q"}
                last={!order.cargo.note}
              />
              {order.cargo.note && (
                <div className="mt-2 flex gap-2.5 rounded-box bg-surface px-3.5 py-3">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="text-sm font-semibold leading-5">"{order.cargo.note}"</span>
                </div>
              )}
            </Card>
          )}

          <Card className="flex flex-col gap-1">
            <CardTitle className="pb-1">Narx va to'lov</CardTitle>
            <InfoRow label="Oldindan aytilgan" value={`${formatNumber(order.price.quoted)} so'm`} />
            {order.price.lines.map((l, i) => (
              <InfoRow
                key={i}
                label={l.label}
                value={l.kind === "base" ? formatNumber(l.amount) : l.kind === "discount" ? `−${formatNumber(l.amount)}` : l.amount ? `+${formatNumber(l.amount)}` : "0"}
              />
            ))}
            {order.price.final !== null && (
              <div className="flex min-h-[42px] items-center justify-between gap-3">
                <span className="text-sm font-bold">Yakuniy narx</span>
                <span className="tabular text-15 font-extrabold">{formatNumber(order.price.final)} so'm</span>
              </div>
            )}
            {order.payments.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="label-caps text-muted">To'lov</span>
                <div className="overflow-x-auto rounded-box shadow-hairline">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-surface">
                        <th scope="col" className="label-caps h-11 whitespace-nowrap px-3 text-muted">Usul</th>
                        <th scope="col" className="label-caps h-11 whitespace-nowrap px-3 text-muted">ID</th>
                        <th scope="col" className="label-caps h-11 whitespace-nowrap px-3 text-right text-muted">Summa</th>
                        <th scope="col" className="label-caps h-11 whitespace-nowrap px-3 text-muted">Holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.payments.map((p, i) => {
                        const Icon = p.methodKind === "cash" ? Banknote : p.methodKind === "card" ? CreditCard : Wallet;
                        return (
                          <tr key={i} className="border-t border-line">
                            <td className="h-12 whitespace-nowrap px-3">
                              <span className="inline-flex items-center gap-2 font-bold">
                                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#E0F6F7] text-[#0E7C86]">
                                  <Icon className="h-3.5 w-3.5" aria-hidden />
                                </span>
                                {p.method}
                              </span>
                            </td>
                            <td className="tabular h-12 whitespace-nowrap px-3 font-semibold tracking-[0.3px] text-muted">{p.ref ?? "—"}</td>
                            <td className="tabular h-12 whitespace-nowrap px-3 text-right font-semibold">{formatNumber(p.amount)}</td>
                            <td className="h-12 whitespace-nowrap px-3">
                              <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {order.dispatch && (
            <Card className="flex flex-col gap-1">
              <CardTitle className="pb-1">Haydovchilarga ko'rsatilishi</CardTitle>
              <InfoRow label="Ko'rsatildi" value={`${formatNumber(order.dispatch.shown)} haydovchiga`} />
              <InfoRow label="Rad etdi" value={formatNumber(order.dispatch.declined)} />
              <InfoRow label="Javob bermadi" value={formatNumber(order.dispatch.noAnswer)} last={!order.dispatch.acceptedBy} />
              {order.dispatch.acceptedBy && (
                <InfoRow
                  label="Qabul qildi"
                  value={`${order.dispatch.acceptedBy}${order.dispatch.acceptedInSec !== null ? `, ${order.dispatch.acceptedInSec} s` : ""}`}
                  last
                />
              )}
            </Card>
          )}
        </div>
      </div>

      <OpCancelModal
        order={cancelOpen ? order : null}
        onClose={() => setCancelOpen(false)}
        onCancelled={(o) => {
          setCancelOpen(false);
          setOrder(o);
          setToast("Buyurtma bekor qilindi");
        }}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function Person({ name, sub, green }: { name: string; sub?: string; green?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={36} tone={green ? "green" : "light"} />
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-sm font-bold text-ink">{name}</span>
        {sub && <span className="tabular truncate text-xs font-semibold text-muted">{sub}</span>}
      </span>
    </span>
  );
}

function PersonCard({ label, name, sub, to, green }: { label: string; name: string; sub?: string; to?: string; green?: boolean }) {
  const body = (
    <>
      <span className="label-caps text-muted">{label}</span>
      <Person name={name} sub={sub} green={green} />
    </>
  );
  const box = "flex min-w-0 flex-col gap-2.5 rounded-2xl p-3.5 text-ink shadow-hairline";
  return to ? (
    <Link to={to} className={cn(box, "transition-colors hover:bg-white focus-visible:outline-green")} aria-label={`${label}: ${name}, kartani ochish`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex min-h-[42px] items-center justify-between gap-3", !last && "border-b border-line")}>
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="tabular text-right text-sm font-extrabold text-ink">{value}</span>
    </div>
  );
}

function stepTime(s: OpOrderStep): string {
  if (s.at === null) return s.state === "current" ? "hozir" : "";
  const t = formatTime(s.at);
  if (s.until) return `${t}–${formatTime(s.until)}`;
  return s.estimated ? `~${t}` : t;
}

function Timeline({ steps }: { steps: OpOrderStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className={cn("flex gap-3", !last && "pb-3")} aria-current={s.state === "current" ? "step" : undefined}>
            <span className="flex w-3.5 flex-col items-center pt-0.5" aria-hidden>
              <span
                className={cn(
                  "h-3.5 w-3.5 shrink-0 rounded-full",
                  s.state === "done" && "border-[3px] border-ink bg-green",
                  s.state === "current" && "border-4 border-green bg-white shadow-[0_0_0_4px_var(--green-soft)]",
                  s.state === "pending" && "border-2 border-[#D4DBE4] bg-white"
                )}
              />
              {!last && <span className={cn("mt-1 w-0.5 flex-1", s.state === "done" ? "bg-green" : "bg-line")} />}
            </span>
            <span className="flex min-w-0 flex-1 justify-between gap-2.5">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-sm", s.state === "current" ? "font-extrabold" : "font-bold", s.state === "pending" ? "text-muted" : "text-ink")}>{s.title}</span>
                {s.detail && <span className="text-xs font-semibold text-muted">{s.detail}</span>}
              </span>
              <span className="tabular whitespace-nowrap text-xs font-bold text-muted">{stepTime(s)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function stopLabel(s: OpOrderStop, all: OpOrderStop[], cargo: boolean): string {
  if (s.kind === "pickup") return cargo ? "Yuk olish" : s.promisedAt ? `Olish · ${formatTime(s.promisedAt)} ga va'da qilingan` : "Olish";
  if (s.kind === "stop") return "To'xtash";
  if (!cargo) return "Borish";
  const n = all.filter((x) => x.kind === "dropoff").indexOf(s) + 1;
  return `${n}-tushirish`;
}

function StopRow({ stop, label, last }: { stop: OpOrderStop; label: string; last: boolean }) {
  const tone: BadgeTone = stop.state === "done" ? "success" : stop.state === "active" ? "info" : "neutral";
  return (
    <li className={cn("flex min-h-12 items-center gap-3 py-2", !last && "border-b border-line")}>
      <span
        aria-hidden
        className={cn(
          "shrink-0",
          stop.kind === "pickup" && "h-3.5 w-3.5 rounded-full border-[3px] border-ink bg-green",
          stop.kind === "stop" && "h-3 w-3 rounded-full border-[3px] border-[#8A96A6] bg-white",
          stop.kind === "dropoff" && "h-3 w-3 rounded-[3px] bg-ink"
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="label-caps text-muted">{label}</span>
        <span className="text-sm font-bold">{stop.address}</span>
        {stop.contact && (
          <span className="tabular text-xs font-semibold text-muted">
            {stop.contact.role === "sender" ? "Jo'natuvchi" : "Qabul qiluvchi"}: {stop.contact.name} · {stop.contact.phone}
          </span>
        )}
      </span>
      <Badge tone={tone}>{stop.stateText}</Badge>
    </li>
  );
}

