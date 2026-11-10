import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  Banknote,
  Car as CarIcon,
  CreditCard,
  Armchair,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { Address, PaymentMethod, SavedCard, Seat } from "@/api/types";
import type { OrderDraft } from "@/stores/orderStore";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { useQuery } from "@/lib/useQuery";
import { cn } from "@/lib/cn";
import { SeatMap } from "./SeatMap";
import { CargoPicker } from "./CargoPicker";
import { AddressPickerSheet } from "./AddressPickerSheet";

const STEP_KEYS = ["order.step.route", "order.step.type", "order.step.time", "order.step.payment", "order.step.summary"] as const;
const TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => `${String(6 + i).padStart(2, "0")}:00`);

function StepHeader({
  step,
  labelKeys,
  onClose,
}: {
  step: number;
  labelKeys: readonly string[];
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="px-5 pb-1 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5">
          {labelKeys.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-border")}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-ink/60">{t(labelKeys[step] as TranslationKey)}</p>
    </div>
  );
}

function OptionCard({
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
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [customDate, setCustomDate] = useState("");
  const [schedule, setSchedule] = useState({
    date: "today" as string,
    timeKind: "exact" as "exact" | "range",
    time: TIME_OPTIONS[2],
    timeRange: { from: TIME_OPTIONS[2], to: TIME_OPTIONS[6] },
  });

  function commitScheduled(patch: Partial<typeof schedule>) {
    const next = { ...schedule, ...patch };
    setSchedule(next);
    setField("timing", {
      timeMode: "scheduled",
      date: next.date,
      timeKind: next.timeKind,
      time: next.timeKind === "exact" ? next.time : undefined,
      timeRange: next.timeKind === "range" ? next.timeRange : undefined,
    });
  }

  const canQuote = !!draft.fromAddressId && !!draft.toAddressId && draft.fromAddressId !== addresses.to?.id;

  useEffect(() => {
    if (draft.serviceType === "passenger" && draft.mode === "seat" && draft.fromAddressId && draft.toAddressId) {
      api
        .getSeatMap({ fromAddressId: draft.fromAddressId, toAddressId: draft.toAddressId })
        .then(setSeats)
        .catch(() => setSeats([]));
    }
  }, [draft.serviceType, draft.mode, draft.fromAddressId, draft.toAddressId]);

  useEffect(() => {
    if (draft.paymentMethod === "card") api.getSavedCards().then(setCards).catch(() => {});
  }, [draft.paymentMethod]);

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
      <StepHeader step={step} labelKeys={STEP_KEYS} onClose={onClose} />

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3">
        {step === 0 && (
          <div className="space-y-1 rounded-2xl bg-accent-5 p-2">
            <button
              onClick={() => setPicker("from")}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-ink" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink/60">{t("order.from")}</p>
                <p className="truncate text-sm font-semibold text-ink">
                  {addresses.from?.label ?? t("order.choosePlace")}
                </p>
              </div>
            </button>
            <div className="relative">
              <div className="mx-3 h-px bg-border" />
              <button
                onClick={() => {
                  const f = draft.fromAddressId;
                  setField("fromAddressId", draft.toAddressId);
                  setField("toAddressId", f);
                }}
                aria-label={t("order.swap")}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-card text-accent shadow-softer"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setPicker("to")}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink/60">{t("order.to")}</p>
                <p className="truncate text-sm font-semibold text-ink">
                  {addresses.to?.label ?? t("order.choosePlace")}
                </p>
              </div>
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <OptionCard
                selected={draft.serviceType === "passenger"}
                icon={Armchair}
                label={t("order.passenger")}
                onClick={() => setField("serviceType", "passenger")}
              />
              <OptionCard
                selected={draft.serviceType === "delivery"}
                icon={CarIcon}
                label={t("order.delivery")}
                onClick={() => setField("serviceType", "delivery")}
              />
            </div>

            {draft.serviceType === "passenger" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <OptionCard
                    selected={draft.mode === "seat"}
                    icon={Armchair}
                    label={t("order.perSeat")}
                    onClick={() => setField("mode", "seat")}
                  />
                  <OptionCard
                    selected={draft.mode === "car"}
                    icon={CarIcon}
                    label={t("order.wholeCar")}
                    onClick={() => setField("mode", "car")}
                  />
                </div>
                {draft.mode === "seat" && <SeatMap seats={seats} selected={draft.seatIds} onToggle={toggleSeat} />}
              </>
            ) : (
              <CargoPicker value={draft.cargo} onChange={(v) => setField("cargo", v)} />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setField("timing", { timeMode: "now" })}
                className={cn(
                  "rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
                  draft.timing.timeMode === "now" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                )}
              >
                {t("order.now")}
              </button>
              <button
                onClick={() => commitScheduled({})}
                className={cn(
                  "rounded-xl border-2 py-3 text-sm font-semibold transition-colors",
                  draft.timing.timeMode === "scheduled" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                )}
              >
                {t("order.scheduled")}
              </button>
            </div>

            {draft.timing.timeMode === "scheduled" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["today", "tomorrow"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => commitScheduled({ date: d })}
                      className={cn(
                        "flex-1 rounded-full border-2 py-2 text-xs font-semibold transition-colors",
                        schedule.date === d ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                      )}
                    >
                      {t(d === "today" ? "order.today" : "order.tomorrow")}
                    </button>
                  ))}
                  <label
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-full border-2 py-2 text-xs font-semibold transition-colors",
                      !["today", "tomorrow"].includes(schedule.date)
                        ? "border-accent bg-accent-5 text-accent"
                        : "border-border text-ink/70"
                    )}
                  >
                    {t("order.otherDate")}
                    <input
                      type="date"
                      className="sr-only"
                      value={customDate}
                      onChange={(e) => {
                        setCustomDate(e.target.value);
                        commitScheduled({ date: e.target.value });
                      }}
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => commitScheduled({ timeKind: "exact" })}
                    className={cn(
                      "flex-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors",
                      schedule.timeKind === "exact" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                    )}
                  >
                    {t("order.exactTime")}
                  </button>
                  <button
                    onClick={() => commitScheduled({ timeKind: "range" })}
                    className={cn(
                      "flex-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors",
                      schedule.timeKind === "range" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                    )}
                  >
                    {t("order.timeRange")}
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {TIME_OPTIONS.map((time) => {
                    const active =
                      schedule.timeKind === "exact"
                        ? schedule.time === time
                        : schedule.timeRange.from === time || schedule.timeRange.to === time;
                    return (
                      <button
                        key={time}
                        onClick={() => {
                          if (schedule.timeKind === "exact") {
                            commitScheduled({ time });
                          } else {
                            const complete = schedule.timeRange.from !== schedule.timeRange.to;
                            commitScheduled({
                              timeRange: complete ? { from: time, to: time } : { from: schedule.timeRange.from, to: time },
                            });
                          }
                        }}
                        className={cn(
                          "shrink-0 rounded-full border-2 px-4 py-2 text-xs font-semibold tabular transition-colors",
                          active ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                        )}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <button
              onClick={() => setField("paymentMethod", "cash" as PaymentMethod)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors",
                draft.paymentMethod === "cash" ? "border-accent bg-accent-5" : "border-border"
              )}
            >
              <Banknote className="h-5 w-5 text-ink/70" />
              <span className="text-sm font-semibold text-ink">{t("order.cash")}</span>
            </button>

            <button
              onClick={() => setField("paymentMethod", "card" as PaymentMethod)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors",
                draft.paymentMethod === "card" ? "border-accent bg-accent-5" : "border-border"
              )}
            >
              <CreditCard className="h-5 w-5 text-ink/70" />
              <span className="text-sm font-semibold text-ink">{t("order.card")}</span>
            </button>

            {draft.paymentMethod === "card" && (
              <div className="ml-4 space-y-2">
                {cards.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5 shadow-softer">
                    <span className="text-xs font-medium text-ink/80">{`${c.label} •••• ${c.last4}`}</span>
                  </div>
                ))}
                <Link
                  to="/cards/link"
                  className="flex items-center gap-2 rounded-xl border border-dashed border-accent/40 px-3 py-2.5 text-xs font-semibold text-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("order.linkCard")}
                </Link>
              </div>
            )}

            <p className="pt-2 text-xs font-semibold text-ink/60">{t("order.paymentSystems")}</p>
            <div className="flex gap-2">
              {["Payme", "Click"].map((label) => (
                <div key={label} className="flex-1 rounded-xl border border-border px-4 py-3 text-center text-xs font-semibold text-ink/50">
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-accent-5 p-4">
              <p className="text-xs font-semibold text-ink/60">{t("order.route")}</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {addresses.from?.label} &rarr; {addresses.to?.label}
              </p>
            </div>

            {quote.status === "loading" && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            )}
            {quote.status === "error" && (
              <button onClick={quote.refetch} className="text-xs font-semibold text-danger underline">
                {t("order.quoteError")}
              </button>
            )}
            {quote.status === "success" && (
              <div className="space-y-2">
                {quote.data.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-ink/60">{t(line.key as TranslationKey, line.params)}</span>
                    <span className="tabular font-medium text-ink">{formatSom(line.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span className="text-ink">{t("order.total")}</span>
                  <span className="tabular text-ink">{formatSom(quote.data.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border px-5 py-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
        {submitError && <p className="mb-2 text-xs font-medium text-danger">{t("order.submitError")}</p>}
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </Button>
          )}
          {step < 4 ? (
            <Button fullWidth disabled={!canNext} onClick={() => setStep(step + 1)}>
              {t("order.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              fullWidth
              variant="brand"
              loading={submitting}
              disabled={quote.status !== "success"}
              onClick={onSubmit}
            >
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
    </div>
  );
}
