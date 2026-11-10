import { useEffect, useRef, useState } from "react";
import { Armchair, Car as CarIcon, ChevronRight, Pencil, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address, Seat } from "@/api/types";
import type { OrderDraft } from "@/stores/orderStore";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { Switch } from "@/components/Switch";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { cn } from "@/lib/cn";
import { SeatMap, seatCountLabel } from "./SeatMap";
import { CargoPicker } from "./CargoPicker";
import { AddressPickerSheet } from "./AddressPickerSheet";
import { TimePickerSheet } from "./TimePickerSheet";
import { PassengerCountButtons } from "./PassengerCountButtons";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { timingSummary } from "./timingSummary";
import { RouteFields } from "./RouteFields";

const STEP_KEYS = ["order.step.route", "order.step.details", "order.step.summary"] as const;

function StepHeader({
  step,
  onClose,
}: {
  step: number;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="px-5 pb-1 pt-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5">
          {STEP_KEYS.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-brand-yellow" : "bg-border")}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70">
            <X className="h-4 w-4" />
          </span>
        </button>
      </div>
      <p className="mt-1 text-xs font-semibold text-ink/60">{t(STEP_KEYS[step])}</p>
    </div>
  );
}

export function OrderSheet({
  draft,
  setField,
  addresses,
  onAddressChange,
  onSubmit,
  submitting,
  submitError,
  onClose,
}: {
  draft: OrderDraft;
  setField: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
  addresses: { from: Address | null; to: Address | null };
  onAddressChange: (which: "from" | "to", addr: Address) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: boolean;
  onClose: () => void;
}) {
  const { t, intlTag } = useT();
  const [step, setStep] = useState(0);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsError, setSeatsError] = useState(false);
  const [seatsReload, setSeatsReload] = useState(0);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const autoOpenedPicker = useRef(false);

  // Spec: expanding into the route step without a "to" address yet should
  // jump straight into the search sheet, keyboard up.
  useEffect(() => {
    if (!autoOpenedPicker.current && !addresses.to) {
      autoOpenedPicker.current = true;
      setPicker("to");
    }
  }, [addresses.to]);

  const canQuote = !!draft.fromAddressId && !!draft.toAddressId && draft.fromAddressId !== addresses.to?.id;

  useEffect(() => {
    if (draft.serviceType === "passenger" && draft.fromAddressId && draft.toAddressId) {
      api
        .getSeatMap({ fromAddressId: draft.fromAddressId, toAddressId: draft.toAddressId })
        .then((s) => {
          setSeats(s);
          setSeatsError(false);
        })
        .catch(() => {
          setSeats([]);
          setSeatsError(true);
        });
    }
  }, [draft.serviceType, draft.fromAddressId, draft.toAddressId, seatsReload]);

  const quote = useQuery(
    () =>
      api.getQuote({
        serviceType: draft.serviceType,
        fromAddressId: draft.fromAddressId,
        toAddressId: draft.toAddressId,
        mode: draft.mode,
        seatIds: draft.seatIds,
        cargo: draft.serviceType === "delivery" ? draft.cargo : undefined,
      }),
    [step, draft.serviceType, draft.fromAddressId, draft.toAddressId, draft.mode, draft.seatIds, draft.cargo]
  );

  function toggleSeat(seatId: string) {
    const has = draft.seatIds.includes(seatId);
    setField("seatIds", has ? draft.seatIds.filter((s) => s !== seatId) : [...draft.seatIds, seatId]);
  }

  const canNext =
    step === 0
      ? canQuote
      : step === 1
      ? draft.serviceType === "delivery" || draft.mode === "car" || draft.seatIds.length > 0
      : true;

  return (
    <div className="flex h-full flex-col">
      <StepHeader step={step} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-3">
        {step === 0 && (
          <RouteFields
            from={addresses.from}
            to={addresses.to}
            onPick={setPicker}
            onSwap={() => {
              const f = draft.fromAddressId;
              setField("fromAddressId", draft.toAddressId);
              setField("toAddressId", f);
            }}
          />
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <SegmentButton
                selected={draft.serviceType === "passenger"}
                icon={Armchair}
                label={t("order.passenger")}
                onClick={() => setField("serviceType", "passenger")}
              />
              <SegmentButton
                selected={draft.serviceType === "delivery"}
                icon={CarIcon}
                label={t("order.delivery")}
                onClick={() => setField("serviceType", "delivery")}
              />
            </div>

            {draft.serviceType === "passenger" ? (
              <>
                <PassengerCountButtons
                  seats={seats}
                  mode={draft.mode}
                  seatIds={draft.seatIds}
                  onChange={(mode, seatIds) => {
                    setField("mode", mode);
                    setField("seatIds", seatIds);
                  }}
                />
                <SeatMap
                  seats={seats}
                  selected={draft.seatIds}
                  onToggle={toggleSeat}
                  wholeCar={draft.mode === "car"}
                  loadError={seatsError}
                  onRetry={() => setSeatsReload((n) => n + 1)}
                  onWholeCarChange={(whole) => {
                    setField("mode", whole ? "car" : "seat");
                    setField("seatIds", []);
                  }}
                />
              </>
            ) : (
              <CargoPicker value={draft.cargo} onChange={(v) => setField("cargo", v)} />
            )}

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-normal text-ink">{t("order.now")}</span>
                <Switch
                  checked={draft.timing.timeMode === "now"}
                  onChange={() =>
                    draft.timing.timeMode === "now" ? setTimePickerOpen(true) : setField("timing", { timeMode: "now" })
                  }
                  label={t("order.now")}
                />
              </div>
              {draft.timing.timeMode === "scheduled" && (
                <button
                  onClick={() => setTimePickerOpen(true)}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-accent-5 px-4 py-3 text-left text-sm font-semibold text-accent"
                >
                  <span className="tabular">{timingSummary(draft.timing, t)}</span>
                  <Pencil className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-accent-5 p-4">
              <p className="text-xs font-semibold text-ink/60">{t("order.route")}</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {addresses.from?.label} &rarr; {addresses.to?.label}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-ink/60">
                <span>
                  {draft.serviceType === "passenger"
                    ? draft.mode === "car"
                      ? t("order.wholeCar")
                      : seatCountLabel(t, draft.seatIds.length, intlTag)
                    : t("order.delivery")}
                </span>
                <span className="tabular">{timingSummary(draft.timing, t)}</span>
              </div>
            </div>

            {quote.status === "loading" && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            )}
            {quote.status === "error" && (
              <button onClick={quote.refetch} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
                {t("order.quoteError")}
              </button>
            )}
            {quote.status === "success" && (
              <div className="space-y-2">
                {quote.data.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-ink/60">{t(line.key as TranslationKey, line.params)}</span>
                    <span className="tabular font-normal text-ink">{formatSom(line.amount, intlTag)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span className="text-ink">{t("order.total")}</span>
                  <span className="tabular text-ink">{formatSom(quote.data.total, intlTag)}</span>
                </div>
              </div>
            )}

            <p className="pt-1 text-sm font-semibold text-ink">{t("order.step.payment")}</p>
            <PaymentMethodSection value={draft.paymentMethod} onChange={(m) => setField("paymentMethod", m)} />
          </div>
        )}
      </div>

      <div className="border-t border-border px-5 py-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
        {submitError && (
          <p role="alert" aria-live="polite" className="mb-2 text-xs font-normal text-danger">
            {t("order.submitError")}
          </p>
        )}
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </Button>
          )}
          {step < 2 ? (
            <Button fullWidth disabled={!canNext} onClick={() => setStep(step + 1)}>
              {t("order.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button fullWidth loading={submitting} disabled={quote.status !== "success"} onClick={onSubmit}>
              {t("order.submit")}
            </Button>
          )}
        </div>
      </div>

      {picker && (
        <AddressPickerSheet
          title={t(picker === "from" ? "order.from" : "order.to")}
          excludeCityId={picker === "from" ? addresses.to?.cityId : addresses.from?.cityId}
          onClose={() => setPicker(null)}
          onSelect={(addr) => {
            onAddressChange(picker, addr);
            setPicker(null);
          }}
        />
      )}

      {timePickerOpen && (
        <TimePickerSheet
          initial={draft.timing}
          onClose={() => setTimePickerOpen(false)}
          onApply={(timing) => {
            setField("timing", timing);
            setTimePickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SegmentButton({
  selected,
  icon: Icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: typeof CarIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-semibold transition-colors",
        selected ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
