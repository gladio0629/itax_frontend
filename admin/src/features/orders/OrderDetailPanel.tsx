import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Ban, ClipboardList, Headset, Pencil } from "lucide-react";
import { api } from "@/api/client";
import { Drawer } from "@/components/Drawer";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { SelectField, TextArea } from "@/components/Input";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import { usePermissions } from "@/hooks/usePermissions";
import { formatNumber, formatTime, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CANCEL_CODE_LABEL, CANCEL_REASON_LABEL, KIND_LABEL, ORDER_STATUS, PAYMENT_LABEL, orderNo } from "./labels";
import { OrderEditDrawer } from "./OrderForms";
import type { OrderCancelReasonCode, OrderDetail, OrderTimelineStep } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");

/** Order detail (design OrderDetail): a 560px panel over the orders list.
 * Opened by id, so a reload or a header-search link works. `?edit=1` /
 * `?cancel=1` (from the row menu) open those dialogs directly. */
export function OrderDetailPanel({ onChanged }: { onChanged: () => void }) {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { me } = usePermissions();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toOperator, setToOperator] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api
      .getOrder(orderId)
      .then((o) => live && setOrder(o))
      .catch((e) => live && setError(errorText(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [orderId]);
  useEffect(() => load(), [load]);

  // Row-menu shortcuts, once the order is loaded.
  useEffect(() => {
    if (!order) return;
    if (params.get("edit") === "1" && caps.orderEdit && order.canEdit) setEditing(true);
    if (params.get("cancel") === "1" && order.canCancel) setCancelling(true);
    if (params.has("edit") || params.has("cancel")) {
      const next = new URLSearchParams(params);
      next.delete("edit");
      next.delete("cancel");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const close = () => navigate({ pathname: "/orders", search: params.toString() });
  const changed = (msg: string) => {
    setToast(msg);
    load();
    onChanged();
  };

  const st = order ? ORDER_STATUS[order.status] : null;
  const subtitle = order
    ? [
        KIND_LABEL[order.kind],
        order.kind === "delivery"
          ? order.bodySize && `Kuzov ${order.bodySize}`
          : order.mode === "car"
            ? "butun mashina"
            : `${order.seatIds.length} o'rin`,
        order.carClassLabel,
        PAYMENT_LABEL[order.paymentMethod].toLowerCase(),
        `yaratildi ${formatTime(order.createdAt)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <>
      <Drawer
        open
        onClose={close}
        width={560}
        title={order ? `Buyurtma ${orderNo(order.id)}` : "Buyurtma"}
        titleAddon={st && <Badge tone={st.tone}>{st.label}</Badge>}
        subtitle={subtitle}
        footer={
          order && (
            <div className="flex flex-wrap items-center gap-2">
              {me?.sections.includes("audit") && (
                <Link
                  to={`/audit?q=${encodeURIComponent(order.id)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-surface px-[18px] text-sm font-extrabold text-ink hover:bg-line"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden /> Audit tarixi
                </Link>
              )}
              {caps.orderToOperator && (
                <Button variant="soft" onClick={() => setToOperator(true)}>
                  <Headset className="h-4 w-4" aria-hidden /> Operatorga yuborish
                </Button>
              )}
              <span className="flex-1" />
              {caps.orderEdit && order.canEdit && (
                <Button variant="soft" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Tahrirlash
                </Button>
              )}
              {order.canCancel && (
                <Button variant="danger" onClick={() => setCancelling(true)}>
                  <Ban className="h-4 w-4" aria-hidden /> Bekor qilish
                </Button>
              )}
            </div>
          )
        }
      >
        {error && !order ? (
          <ErrorState message={error} onRetry={load} retrying={loading} />
        ) : !order ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-36 rounded-field" />
            <Skeleton className="h-24 rounded-field" />
            <Skeleton className="h-48 rounded-field" />
          </div>
        ) : (
          <OrderBody order={order} />
        )}
      </Drawer>

      {order && caps.orderEdit && (
        <OrderEditDrawer
          order={order}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            changed("Saqlandi");
          }}
        />
      )}
      {order && (
        <CancelOrderDialog
          open={cancelling}
          orderId={order.id}
          onClose={() => setCancelling(false)}
          onDone={() => {
            setCancelling(false);
            changed("Buyurtma bekor qilindi");
          }}
        />
      )}
      {order && caps.orderToOperator && (
        <ToOperatorDialog
          open={toOperator}
          orderId={order.id}
          onClose={() => setToOperator(false)}
          onDone={() => {
            setToOperator(false);
            setToast("Operator navbatiga qo'shildi");
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function OrderBody({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const { me } = usePermissions();
  const chips = [
    order.distanceKm ? `${formatNumber(order.distanceKm)} km` : null,
    order.durationMin ? `~${Math.floor(order.durationMin / 60)} soat ${order.durationMin % 60} daq` : null,
    order.luggageCount ? `${order.luggageCount} ta bagaj` : null,
  ].filter(Boolean) as string[];
  const when = order.scheduledAt
    ? formatDateTime(order.scheduledAt)
    : order.scheduledRange
      ? `${formatDateTime(order.scheduledRange.from)} – ${formatTime(order.scheduledRange.to)}`
      : order.timeWindow
        ? `${order.timeWindow.from} – ${order.timeWindow.to}`
        : null;
  const canOpenDriver = !!order.driverId && !!me?.sections.includes("drivers");

  return (
    <div className="flex flex-col gap-5">
      {/* Route */}
      <div className="flex flex-col gap-3 rounded-field bg-surface p-4">
        <Stop kind="from" label="Olish" value={order.pickupAddress ?? order.fromCityName} />
        <span aria-hidden className="ml-1.5 h-2.5 w-0.5 bg-line-strong" />
        <Stop kind="to" label="Borish" value={order.dropoffAddress ?? order.toCityName} />
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.map((c) => (
              <span key={c} className="inline-flex h-[26px] items-center rounded-lg bg-white px-2.5 text-xs font-bold text-ink">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* People */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PersonCard
          label="Yo'lovchi"
          name={order.passengerName !== "—" ? order.passengerName : null}
          fallback={order.passengerId ? `ID ${order.passengerId.slice(0, 8)}` : "—"}
          sub={[order.passengerPhone, order.passengerRating?.toFixed(1)].filter(Boolean).join(" · ")}
        />
        <PersonCard
          label="Haydovchi"
          name={order.driverName}
          fallback="Hali biriktirilmagan"
          sub={[order.driverCar, order.driverRating?.toFixed(1)].filter(Boolean).join(" · ")}
          tone="green"
          onOpen={canOpenDriver ? () => navigate(`/drivers/${order.driverId}`) : undefined}
        />
      </div>

      {/* Extra details */}
      {(when || order.note || order.cancelReason) && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {when && <Detail label="Olish vaqti" value={when} />}
          {order.cancelReason && <Detail label="Bekor qilish sababi" value={CANCEL_CODE_LABEL[order.cancelReason] ?? order.cancelReason} />}
          {order.note && <Detail label="Izoh" value={order.note} wide />}
        </dl>
      )}

      {/* Timeline */}
      {order.steps && order.steps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="label-caps text-muted">Holatlar</h3>
          <ol className="flex flex-col">
            {order.steps.map((s, i) => (
              <TimelineRow key={i} step={s} last={i === order.steps!.length - 1} />
            ))}
          </ol>
        </section>
      )}

      {/* Price lines (server) */}
      <section className="flex flex-col">
        <h3 className="label-caps mb-1.5 text-muted">Narx</h3>
        {(order.priceLines ?? [{ label: "Narx", amount: order.price, kind: "line" as const }]).map((l, i, arr) => (
          <div key={i} className={cn("flex min-h-[42px] items-center justify-between gap-3", i < arr.length - 1 && "border-b border-line")}>
            <span className={cn("text-sm", l.kind === "payout" || l.kind === "total" ? "font-bold text-ink" : "font-semibold text-muted")}>{l.label}</span>
            <span className={cn("tabular text-right font-extrabold", l.kind === "payout" ? "text-15 text-green-text" : "text-sm text-ink")}>
              {formatNumber(l.amount)} so'm
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stop({ kind, label, value }: { kind: "from" | "to"; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      {kind === "from" ? (
        <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-ink bg-green" />
      ) : (
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] bg-ink" />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="label-caps text-muted">{label}</span>
        <span className="text-sm font-bold text-ink">{value}</span>
      </span>
    </div>
  );
}

function PersonCard({
  label,
  name,
  fallback,
  sub,
  tone,
  onOpen,
}: {
  label: string;
  name: string | null;
  fallback: string;
  sub?: string;
  tone?: "green";
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <span className="label-caps text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        {name && <Avatar name={name} size={36} tone={tone} />}
        <span className="flex min-w-0 flex-col gap-px">
          <span className={cn("truncate text-sm font-bold", name ? "text-ink" : "text-muted")}>{name ?? fallback}</span>
          {sub && <span className="tabular truncate text-xs font-semibold text-muted">{sub}</span>}
        </span>
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-2.5 rounded-field p-3.5 text-left shadow-hairline";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(cls, "hover:bg-row-hover")} aria-label={`${label}: ${name ?? fallback}, profilni ochish`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-field bg-surface px-4 py-3", wide && "sm:col-span-2")}>
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function TimelineRow({ step, last }: { step: OrderTimelineStep; last: boolean }) {
  const done = step.state === "done";
  const current = step.state === "current";
  return (
    <li className={cn("flex gap-3", !last && "pb-3.5")}>
      <span aria-hidden className="flex w-3.5 shrink-0 flex-col items-center pt-0.5">
        <span
          className={cn(
            "h-3.5 w-3.5 rounded-full",
            done && "border-[3px] border-ink bg-green",
            current && "border-4 border-green bg-white shadow-[0_0_0_4px_var(--green-soft)]",
            step.state === "pending" && "border-2 border-line-strong bg-white"
          )}
        />
        {!last && <span className={cn("mt-1 w-0.5 flex-1", done ? "bg-green" : "bg-line")} />}
      </span>
      <span className="flex flex-1 justify-between gap-2.5">
        <span className="flex flex-col gap-0.5">
          <span className={cn("text-sm", current ? "font-extrabold text-ink" : done ? "font-bold text-ink" : "font-bold text-muted")}>
            {step.title}
            <span className="sr-only">{current ? " (hozir)" : done ? " (bajarildi)" : " (kutilmoqda)"}</span>
          </span>
          {step.detail && <span className="text-xs font-semibold text-muted">{step.detail}</span>}
        </span>
        <span className="tabular shrink-0 text-xs font-bold text-muted">
          {current && step.at === null ? "hozir" : step.at ? `${step.estimated ? "~" : ""}${formatTime(step.at)}` : ""}
        </span>
      </span>
    </li>
  );
}

function CancelOrderDialog({ open, orderId, onClose, onDone }: { open: boolean; orderId: string; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState<OrderCancelReasonCode>("admin_decision");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setCode("admin_decision");
      setText("");
      setError(null);
    }
  }, [open]);
  const missing = !caps.orderCancelReasons && !text.trim();

  async function submit() {
    if (missing) return;
    setBusy(true);
    setError(null);
    try {
      if (caps.orderCancelReasons) await api.cancelOrder(orderId, code, text.trim() || undefined);
      else await api.cancelOrder(orderId, text.trim());
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      role="alertdialog"
      width={480}
      title="Buyurtmani bekor qilish"
      description="Bekor qilingan buyurtmani qaytarib bo'lmaydi. Harakat audit jurnaliga yoziladi."
      icon={<Ban className="h-6 w-6" aria-hidden />}
      iconTone="danger"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={busy}>
            Orqaga
          </Button>
          <Button variant="danger" loading={busy} disabled={missing} onClick={submit}>
            Bekor qilish
          </Button>
        </>
      }
    >
      {caps.orderCancelReasons && (
        <SelectField
          label="Sabab"
          value={code}
          onChange={(e) => setCode(e.target.value as OrderCancelReasonCode)}
          options={(Object.keys(CANCEL_REASON_LABEL) as OrderCancelReasonCode[]).map((c) => ({ value: c, label: CANCEL_REASON_LABEL[c] }))}
        />
      )}
      <TextArea
        label={caps.orderCancelReasons ? "Izoh (ixtiyoriy)" : "Sabab (majburiy)"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={caps.orderCancelReasons ? 500 : undefined}
        rows={2}
      />
      {error && (
        <p role="alert" className="text-13 font-semibold text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

function ToOperatorDialog({ open, orderId, onClose, onDone }: { open: boolean; orderId: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
    }
  }, [open]);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.sendOrderToOperator(orderId, note);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      width={480}
      title="Operatorga yuborish"
      description="Yo'lovchiga qo'ng'iroq qilish vazifasi operator navbatiga qo'shiladi."
      icon={<Headset className="h-6 w-6" aria-hidden />}
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button loading={busy} onClick={submit}>
            Yuborish
          </Button>
        </>
      }
    >
      <TextArea label="Operator uchun izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
      {error && (
        <p role="alert" className="text-13 font-semibold text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
