import { useMemo, useState } from "react";
import type { OrderTiming, SchedulingRules } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { monthNames } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, PrimaryButton, Screen, SectionLabel, Segmented, Switch } from "@/ui";
import { bookableDays, dayDiff, defaultScheduled, isoDay, normalizeTiming, resolveDay, toHHMM, toMinutes, type ScheduledTiming } from "@/features/order/scheduling";
import { dayLabel, weekdayShort } from "@/features/order/timingSummary";

type Mode = "now" | "exact" | "range";

/** "8", "800", "0800", "8:00", "08.00" → minutes, rounded to the step; null if not a time. */
function parseTime(raw: string, step: number): number | null {
  const s = raw.trim().replace(/[.\s]/g, ":");
  let h: number, m: number;
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  const digits = /^(\d{1,4})$/.exec(s);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (digits) {
    const d = digits[1];
    if (d.length <= 2) {
      h = Number(d);
      m = 0;
    } else {
      h = Number(d.slice(0, d.length - 2));
      m = Number(d.slice(-2));
    }
  } else return null;
  if (h > 23 || m > 59) return null;
  return Math.round((h * 60 + m) / step) * step;
}

function TimeBox({
  label,
  value,
  onChange,
  onCommit,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  invalid: boolean;
}) {
  return (
    <label
      className={cn(
        "flex h-[76px] min-w-0 flex-1 cursor-text flex-col justify-center gap-0.5 rounded-iz-field border-2 bg-iz-field px-4 focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]",
        invalid ? "border-iz-danger" : "border-transparent"
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={value}
        maxLength={5}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(/[^\d:.]/g, ""))}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="iz-input h-[30px] w-full min-w-0 border-0 bg-transparent p-0 text-[24px] font-extrabold tabular-nums text-iz-ink outline-none"
      />
    </label>
  );
}

/**
 * Pickup time (design: Time / KbTime): Hozir ("the driver's choice", sent as
 * timeMode "now"), Aniq vaqt or Oraliq, on one day or across several days
 * (owner, 2026-11-22). Every limit comes from the server's SchedulingRules
 * and the result goes through normalizeTiming; the server re-validates.
 */
export function TimeScreen({
  value,
  rules,
  onDone,
  onBack,
  allowNow = true,
}: {
  value: OrderTiming;
  rules: SchedulingRules;
  onDone: (timing: OrderTiming) => void;
  onBack: () => void;
  /** Offer "Hozir" (off when a live order's time can't be cleared). */
  allowNow?: boolean;
}) {
  const { t, intlTag } = useT();
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => bookableDays(rules, now), [rules, now]);
  const start: ScheduledTiming = value.timeMode === "scheduled" ? normalizeTiming(value, rules, now).timing : defaultScheduled(rules, now);

  const [mode, setMode] = useState<Mode>(value.timeMode === "now" ? "now" : value.timeKind === "range" ? "range" : "exact");
  const [date, setDate] = useState(resolveDay(start.date, now));
  const [dateEnd, setDateEnd] = useState<string | undefined>(start.dateEnd ? resolveDay(start.dateEnd, now) : undefined);
  const [multi, setMulti] = useState(!!start.dateEnd);
  const firstFrom = start.timeRange?.from ?? start.time ?? toHHMM(9 * 60);
  const [exact, setExact] = useState(start.time ?? firstFrom);
  const [from, setFrom] = useState(firstFrom);
  const [to, setTo] = useState(start.timeRange?.to ?? toHHMM(Math.min(toMinutes(firstFrom) + 4 * 60, 24 * 60 - rules.stepMinutes)));
  const [bad, setBad] = useState<"exact" | "from" | "to" | null>(null);
  /** Why the times were moved to fit the server's rules (shown once). */
  const [notice, setNotice] = useState<string | null>(null);

  const commit = (which: "exact" | "from" | "to") => {
    setNotice(null);
    const raw = which === "exact" ? exact : which === "from" ? from : to;
    const min = parseTime(raw, rules.stepMinutes);
    if (min == null) {
      setBad(which);
      return;
    }
    setBad(null);
    const v = toHHMM(Math.min(min, 24 * 60 - rules.stepMinutes));
    if (which === "exact") setExact(v);
    else if (which === "from") setFrom(v);
    else setTo(v);
  };

  function pickDay(d: string) {
    if (multi && d > date && dayDiff(date, d) <= rules.maxRangeDays) setDateEnd(d === dateEnd ? undefined : d);
    else {
      setDate(d);
      if (dateEnd && (dateEnd <= d || dayDiff(d, dateEnd) > rules.maxRangeDays)) setDateEnd(undefined);
    }
  }

  function save() {
    if (mode === "now") {
      onDone({ timeMode: "now" });
      return;
    }
    // Read the fields here too: a tap on Saqlash doesn't always blur the
    // input first (iOS), so the typed text may not be normalised yet.
    const parse = (raw: string) => {
      const m = parseTime(raw, rules.stepMinutes);
      return m == null ? null : toHHMM(Math.min(m, 24 * 60 - rules.stepMinutes));
    };
    const ex = parse(exact);
    const fr = parse(from);
    const tt = parse(to);
    if (mode === "exact" && !ex) return setBad("exact");
    if (mode === "range" && !fr) return setBad("from");
    if (mode === "range" && !tt) return setBad("to");
    setBad(null);
    const wanted: ScheduledTiming =
      mode === "exact"
        ? { timeMode: "scheduled", date, dateEnd: multi ? dateEnd : undefined, timeKind: "exact", time: ex! }
        : { timeMode: "scheduled", date, dateEnd: multi ? dateEnd : undefined, timeKind: "range", timeRange: { from: fr!, to: tt! } };
    const { timing, jumpedToTomorrow } = normalizeTiming(wanted, rules, now);
    const moved = JSON.stringify(timing) !== JSON.stringify(wanted);
    if (!moved) {
      onDone(timing);
      return;
    }
    // The rules moved something: show the result and why; the next Saqlash keeps it.
    setDate(resolveDay(timing.date, now));
    setDateEnd(timing.dateEnd);
    if (timing.time) setExact(timing.time);
    if (timing.timeRange) {
      setFrom(timing.timeRange.from);
      setTo(timing.timeRange.to);
    }
    const shown = timing.time ?? timing.timeRange?.from ?? "";
    setNotice(
      jumpedToTomorrow
        ? t("when.jumped", { time: shown })
        : wanted.dateEnd && timing.dateEnd !== wanted.dateEnd
        ? t("when.rangeTooLong", { max: rules.maxRangeDays + 1 })
        : t("when.gapFixed", { min: rules.minRangeMinutes, time: timing.timeRange?.to ?? shown })
    );
  }

  const startDay = new Date(`${date}T00:00:00`);
  const dayLine =
    mode === "now"
      ? t("time.nowHint")
      : `${dayLabel(date, t, intlTag, now)}${dateEnd && multi ? ` – ${dayLabel(dateEnd, t, intlTag, now)}` : ""}`;
  const big =
    mode === "now" ? (
      t("time.nowBig")
    ) : mode === "exact" ? (
      exact
    ) : (
      <>
        {from}
        <span className="text-iz-green">–</span>
        {to}
      </>
    );
  const month = `${monthNames(intlTag)[startDay.getMonth()]} ${startDay.getFullYear()}`;
  const fromMin = toMinutes(from);
  const toMin = toMinutes(to);
  const total = 24 * 60;

  return (
    <div className="absolute inset-0 z-50 animate-fade-in" role="dialog" aria-modal="true" aria-label={t("time.title")}>
      <Screen
        title={t("time.title")}
        onBack={onBack}
        topKeep={
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold text-iz-head-muted kb:hidden">{dayLine}</span>
            <span className="text-[38px] font-extrabold leading-[46px] tabular-nums text-iz-head-text kb:text-[24px] kb:leading-8" aria-live="polite">
              <span className="hidden kb:inline">{mode !== "now" && `${dayLabel(date, t, intlTag, now)}, `}</span>
              {big}
            </span>
          </div>
        }
        bodyClassName="gap-4"
        footer={
          <PrimaryButton onClick={save}>
            {t("common.save")}
          </PrimaryButton>
        }
      >
        <div className="kb:hidden">
          <Segmented
            label={t("time.mode")}
            value={mode}
            onChange={setMode}
            options={[
              ...(allowNow ? [{ value: "now" as const, label: t("time.now") }] : []),
              { value: "exact", label: t("time.exact") },
              { value: "range", label: t("time.range") },
            ]}
          />
        </div>

        {mode === "now" ? null : (
          <>
            <div className="flex flex-col gap-2.5">
              <SectionLabel className="kb:hidden">{t("time.days", { month })}</SectionLabel>
              <div role="group" aria-label={t("time.days", { month })} className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto scroll-px-5 px-5">
                {days.map((d) => {
                  const selected = d === date || (multi && d === dateEnd);
                  const inside = multi && dateEnd && d > date && d < dateEnd;
                  const isToday = d === isoDay(now);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickDay(d)}
                      className={cn(
                        "flex h-20 w-[62px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-iz-field kb:h-16",
                        selected ? "bg-iz-selected" : inside ? "bg-iz-green-soft" : "bg-iz-field"
                      )}
                    >
                      <span className={cn("text-[12px] font-bold", selected ? "text-iz-selected-accent" : "text-iz-muted")}>
                        {isToday ? t("order.today") : weekdayShort(d, intlTag)}
                      </span>
                      <span className={cn("text-[22px] font-extrabold kb:text-[20px]", selected ? "text-iz-on-selected" : "text-iz-ink")}>{new Date(`${d}T00:00:00`).getDate()}</span>
                    </button>
                  );
                })}
              </div>
              {rules.maxRangeDays > 0 && (
                <div className="flex items-center gap-3 kb:hidden">
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-bold text-iz-ink">{t("time.multiDay")}</span>
                    {multi && <span className="text-[12px] text-iz-muted">{t("time.multiDayHint", { max: rules.maxRangeDays + 1 })}</span>}
                  </span>
                  <Switch
                    checked={multi}
                    label={t("time.multiDay")}
                    onChange={(on) => {
                      setMulti(on);
                      if (!on) setDateEnd(undefined);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <SectionLabel className="kb:hidden">{mode === "exact" ? t("time.exactLabel") : t("time.window")}</SectionLabel>
              {mode === "exact" ? (
                <TimeBox label={t("time.exactLabel")} value={exact} onChange={setExact} onCommit={() => commit("exact")} invalid={bad === "exact"} />
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <TimeBox label={t("time.from")} value={from} onChange={setFrom} onCommit={() => commit("from")} invalid={bad === "from"} />
                    <Icon name="arrowRight" className="shrink-0 text-iz-muted" />
                    <TimeBox label={t("time.to")} value={to} onChange={setTo} onCommit={() => commit("to")} invalid={bad === "to"} />
                  </div>
                  <div aria-hidden className="flex flex-col gap-2 pt-1.5 kb:hidden">
                    <div className="relative h-5">
                      <div className="absolute inset-x-0 top-1.5 h-2 rounded bg-iz-border" />
                      <div
                        className="absolute top-1.5 h-2 rounded bg-iz-green"
                        style={{ left: `${(fromMin / total) * 100}%`, width: `${Math.max(0, ((toMin - fromMin) / total) * 100)}%` }}
                      />
                      {[fromMin, toMin].map((m, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-white bg-iz-map-pin shadow-[0_2px_6px_var(--iz-shadow-strong)]"
                          style={{ left: `${(m / total) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[11px] font-semibold tabular-nums text-iz-muted">
                      {["00", "06", "12", "18", "24"].map((h) => (
                        <span key={h}>{h}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {bad ? (
                <p role="alert" className="text-[13px] font-semibold text-iz-danger">
                  {t("time.badTime")}
                </p>
              ) : notice ? (
                <p role="status" className="text-[13px] font-semibold text-iz-warn">
                  {notice}
                </p>
              ) : (
                <p className="text-[13px] leading-5 text-iz-muted kb:hidden">{mode === "exact" ? t("time.exactHint") : t("time.rangeHint")}</p>
              )}
            </div>
          </>
        )}
      </Screen>
    </div>
  );
}
