import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderMode, OrderTiming, OrderWithDetails, PayMethod, SavedCard, SchedulingRules } from "@/api/types";
import { layoutFor, type SeatLayout } from "@/api/seatLayout";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/useQuery";
import { serverErrorKey } from "@/lib/apiError";
import { Icon, PrimaryButton, Screen, SectionLabel, Segmented, StateError, StateLoading, TextButton } from "@/ui";
import { AddressFlow } from "@/features/address/AddressFlow";
import { SeatPicker } from "@/features/trip/SeatPicker";
import { TimeScreen } from "@/features/trip/TimeScreen";
import { timingSummary } from "@/features/order/timingSummary";

export type EditSub = "from" | "to" | "time" | null;

function PointRow({ label, value, onClick, square, divider }: { label: string; value: string; onClick?: () => void; square?: boolean; divider?: boolean }) {
  const body = (
    <>
      <span aria-hidden className={cn("shrink-0", square ? "h-[13px] w-[13px] rounded-[4px] bg-iz-ink" : "h-3.5 w-3.5 rounded-full border-[3px] border-iz-ink bg-iz-green")} />
      <span className="flex min-w-0 flex-1 flex-col py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
        <span className="truncate text-[15px] font-bold text-iz-ink">{value}</span>
      </span>
      {onClick && <Icon name="chevronRight" size={18} className="shrink-0 text-iz-muted" />}
    </>
  );
  const cls = cn("flex min-h-[56px] w-full items-center gap-3.5 pr-2 text-left", divider && "border-b border-iz-divider-in-field");
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "active:opacity-70")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * "O'zgartirish" on a live order (the old Tafsilotlar, design v2): the
 * drop-off (the pickup only where the adapter can change it), seats or the
 * whole car, the time and the payment method. Only what changed is sent;
 * the server re-prices. Snapshotted once: the tracking poll must not wipe
 * what the passenger is editing.
 */
export function EditOrderScreen({
  order,
  sub,
  onSub,
  onClose,
  onSaved,
  onCancel,
}: {
  order: OrderWithDetails;
  sub: EditSub;
  onSub: (sub: EditSub) => void;
  onClose: () => void;
  onSaved: (order: OrderWithDetails) => void;
  onCancel?: () => void;
}) {
  const { t, intlTag } = useT();
  const [fromAddressId, setFromAddressId] = useState(order.extras?.fromAddressId ?? "");
  const [toAddressId, setToAddressId] = useState(order.extras?.toAddressId ?? "");
  const [mode, setMode] = useState<OrderMode>(order.mode);
  const [seatIds, setSeatIds] = useState<string[]>(order.seatIds);
  const firstPay: PayMethod = order.extras?.payMethod ?? order.paymentMethod;
  const [pay, setPay] = useState<PayMethod>(firstPay);
  const [timing, setTiming] = useState<OrderTiming>(order.extras?.timing ?? { timeMode: "now" });
  // A save that only changes, say, payment mustn't re-book the time.
  const [timingTouched, setTimingTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delivery = order.extras?.serviceType === "delivery";

  // The order's class decides the cabin (sedan or minivan).
  const seats = useQuery<SeatLayout[]>(
    () => (!delivery && fromAddressId && toAddressId ? api.getSeatLayouts({ fromAddressId, toAddressId }) : Promise.resolve([])),
    [delivery, fromAddressId, toAddressId]
  );
  const seatLayout = seats.status === "success" ? layoutFor(seats.data, order.extras?.carClass) : null;
  const scheduling = useQuery<SchedulingRules>(() => api.getSchedulingRules(), []);
  const navigate = useNavigate();
  const cards = useQuery<SavedCard[]>(() => (api.capabilities.savedCards ? api.getSavedCards() : Promise.resolve([])), []);

  const fromAddress = api.addressById(fromAddressId) ?? null;
  const toAddress = api.addressById(toAddressId) ?? null;

  // Only what really changed is sent (the same time picked again is no change).
  const sameSeats = [...seatIds].sort().join() === [...order.seatIds].sort().join();
  const timingChanged = timingTouched && JSON.stringify(timing) !== JSON.stringify(order.extras?.timing ?? { timeMode: "now" });
  const patch = {
    ...(fromAddressId !== (order.extras?.fromAddressId ?? "") ? { fromAddressId } : {}),
    ...(toAddressId !== (order.extras?.toAddressId ?? "") ? { toAddressId } : {}),
    ...(!delivery && (mode !== order.mode || !sameSeats) ? { mode, seatIds } : {}),
    ...(pay !== firstPay ? { paymentMethod: pay } : {}),
    ...(timingChanged ? { timing } : {}),
  };
  const changed = Object.keys(patch).length > 0;

  async function save() {
    if (!changed) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateOrder(order.id, patch);
      onSaved(updated);
    } catch (e) {
      const key = serverErrorKey(e);
      setError(t((key ?? "order.submitError") as TranslationKey));
    } finally {
      setSaving(false);
    }
  }

  // ── Sub-screens over the form (in the URL, so back closes only them) ──
  if (sub === "from" || sub === "to") {
    return (
      <AddressFlow
        target={sub}
        title={t(sub === "from" ? "order.from" : "order.to")}
        fromLabel={fromAddress?.label}
        toLabel={toAddress?.label}
        fromAddressId={sub === "from" ? undefined : fromAddressId}
        excludeCityId={sub === "from" ? toAddress?.cityId : fromAddress?.cityId}
        onClose={() => onSub(null)}
        onDone={(addr) => {
          if (sub === "from") setFromAddressId(addr.id);
          else setToAddressId(addr.id);
          setError(null);
          onSub(null);
        }}
      />
    );
  }
  if (sub === "time") {
    if (scheduling.status !== "success") {
      return (
        <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("time.title")}>
          <Screen title={t("time.title")} onBack={() => onSub(null)}>
            {scheduling.status === "error" ? <StateError onRetry={scheduling.refetch} /> : <StateLoading rows={2} />}
          </Screen>
        </div>
      );
    }
    return (
      <TimeScreen
        value={timing}
        rules={scheduling.data}
        onBack={() => onSub(null)}
        // A scheduled order can go back to "Hozir" only where the server can clear its time.
        allowNow={api.capabilities.clearTime || (order.extras?.timing ?? { timeMode: "now" }).timeMode === "now"}
        onDone={(next) => {
          setTiming(next);
          setTimingTouched(true);
          setError(null);
          onSub(null);
        }}
      />
    );
  }

  const payOptions: PayMethod[] = firstPay === "payme" || firstPay === "click" ? ["cash", "card", firstPay] : ["cash", "card"];
  const payName: Record<PayMethod, TranslationKey> = { cash: "order.cash", card: "order.card", payme: "pay.payme", click: "pay.click" };

  return (
    <div className="absolute inset-0 z-[60] animate-fade-in" role="dialog" aria-modal="true" aria-label={t("live.editTitle")}>
      <Screen
        title={t("live.editTitle")}
        onBack={onClose}
        bodyClassName="gap-3 pt-5"
        footer={
          order.editable ? (
            <>
              {error && (
                <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
                  {error}
                </p>
              )}
              <PrimaryButton loading={saving} disabled={!changed || (!delivery && mode === "seat" && seatIds.length === 0)} onClick={save}>
                {t("common.save")}
              </PrimaryButton>
              {onCancel && (
                <TextButton tone="danger" onClick={onCancel}>
                  {t("cancel.title")}
                </TextButton>
              )}
            </>
          ) : onCancel ? (
            <TextButton tone="danger" onClick={onCancel}>
              {t("cancel.title")}
            </TextButton>
          ) : undefined
        }
      >
        {!order.editable ? (
          <p className="rounded-iz-field bg-iz-field px-4 py-3.5 text-[14px] font-semibold text-iz-ink">{t("order.locked.notEditable")}</p>
        ) : (
          <>
            <div className="flex flex-col rounded-iz-card bg-iz-field py-1 pl-4 pr-2">
              <PointRow
                label={t("order.from")}
                value={fromAddress?.label ?? order.fromCity.name}
                onClick={api.capabilities.editPickup ? () => onSub("from") : undefined}
                divider
              />
              <PointRow label={t("order.to")} value={toAddress?.label ?? order.toCity.name} onClick={() => onSub("to")} square />
            </div>
            {api.capabilities.editPickup && fromAddressId && toAddressId && (
              <TextButton
                tone="ink"
                className="-mt-1 self-start"
                onClick={() => {
                  setFromAddressId(toAddressId);
                  setToAddressId(fromAddressId);
                }}
              >
                <Icon name="swap" size={16} /> {t("home.swap")}
              </TextButton>
            )}

            {!delivery && (
              <section className="flex flex-col gap-2" aria-label={t("seats.title")}>
                {seats.status === "loading" ? (
                  <StateLoading rows={2} />
                ) : !seatLayout ? (
                  <StateError onRetry={seats.refetch} />
                ) : (
                  <SeatPicker
                    layout={seatLayout}
                    classLabel={t(`class.${seatLayout.carClass}` as TranslationKey)}
                    mode={mode}
                    seatIds={seatIds}
                    onChange={(m, ids) => {
                      setMode(m);
                      setSeatIds(ids);
                      setError(null);
                    }}
                  />
                )}
              </section>
            )}

            <button type="button" onClick={() => onSub("time")} className="flex h-[68px] shrink-0 items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 text-left active:opacity-80">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink">
                <Icon name="calendar" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("pay.pickupTime")}</span>
                <span className="truncate text-[16px] font-extrabold text-iz-ink">{timing.timeMode === "now" ? t("time.now") : timingSummary(timing, t, intlTag)}</span>
              </span>
              <span className="text-[13px] font-extrabold text-iz-green-text">{t("pay.change")}</span>
            </button>

            <section className="flex flex-col gap-2" aria-label={t("pay.method")}>
              <SectionLabel as="h2">{t("pay.method")}</SectionLabel>
              <Segmented
                label={t("pay.method")}
                value={pay}
                onChange={(v) => {
                  setPay(v);
                  setError(null);
                }}
                className="h-[52px]"
                options={payOptions.map((m) => ({ value: m, label: t(payName[m]) }))}
              />
              {/* Karta: the linked cards and "Karta ulash" (current app). */}
              {pay === "card" && api.capabilities.savedCards && (
                <div className="flex flex-col gap-2">
                  {cards.status === "error" && (
                    <button type="button" onClick={cards.refetch} className="flex h-11 items-center gap-2 self-start text-[13px] font-bold text-iz-danger">
                      <Icon name="refresh" size={16} />
                      {t("common.loadFailedRetry")}
                    </button>
                  )}
                  {cards.status === "success" &&
                    cards.data.map((c) => (
                      <div key={c.id} className="flex h-14 items-center gap-3 rounded-iz-field bg-iz-field px-3.5">
                        <Icon name="card" size={18} className="shrink-0 text-iz-ink" />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-iz-ink">{c.label}</span>
                        <span className="text-[14px] font-bold tabular-nums text-iz-muted">{t("pay.cardSaved", { last4: c.last4 })}</span>
                      </div>
                    ))}
                  <button
                    type="button"
                    onClick={() => navigate("/cards/link")}
                    className="flex h-11 items-center gap-2 self-start rounded-full bg-iz-field px-4 text-[13px] font-extrabold text-iz-green-text active:opacity-80"
                  >
                    <Icon name="plus" size={16} />
                    {t("pay.cardHint")}
                  </button>
                </div>
              )}
            </section>
            <p className="px-1 text-[12px] text-iz-muted">{t("live.editNote")}</p>
          </>
        )}
      </Screen>
    </div>
  );
}
