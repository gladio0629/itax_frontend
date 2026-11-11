import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { OrderTiming, SchedulingRules } from "@/api/types";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { WheelPicker } from "@/components/WheelPicker";
import { X } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { cn } from "@/lib/cn";
import {
  addDays,
  bookableDays,
  dayDiff,
  defaultScheduled,
  earliestToday,
  isoDay,
  latestFrom,
  normalizeTiming,
  resolveDay,
  timeSlots,
  toMinutes,
  toHHMM,
  type ScheduledTiming,
} from "./scheduling";
import { dayLabel, shortDate, weekdayShort } from "./timingSummary";

type Notice = { key: "jumped" | "gapFixed" | "rangeTooLong"; time?: string } | null;

/** Re-render once a minute so "past" rows grey out as the clock moves. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-[48px] rounded-xl border-2 px-2 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.98]",
              selected ? "border-brand-yellow bg-brand-yellow text-on-yellow shadow-softer" : "border-border bg-card text-ink/70 hover:border-ink/25 hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Smooth height expand (grid-rows 0fr → 1fr), 240ms. */
function Expand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-[240ms] ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      aria-hidden={!open || undefined}
      ref={(el) => {
        if (!el) return;
        if (open) el.removeAttribute("inert");
        else el.setAttribute("inert", "");
      }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * "Qachon?" — Haydovchi istagan (default, nothing more to fill in) or Siz
 * istagan: a date (or a date range of up to `maxRangeDays`) from the bookable
 * window, then either one time wheel (Ma'lum vaqt) or dan/gacha wheels
 * (Vaqt oralig'i). Every change goes through normalizeTiming with the
 * adapter's rules, so the value is always bookable: a past time today moves
 * to tomorrow, "gacha" is kept ≥ "dan" + minRangeMinutes.
 */
export function TimeSelector({ value, onChange }: { value: OrderTiming; onChange: (timing: OrderTiming) => void }) {
  const { t, intlTag } = useT();
  const rulesQuery = useQuery(() => api.getSchedulingRules(), []);
  useMinuteTick();
  const lastScheduled = useRef<ScheduledTiming | null>(value.timeMode === "scheduled" ? value : null);
  const [notice, setNotice] = useState<Notice>(null);
  // The date a second tap would close a range on. Null until the passenger
  // actively taps a date, so the default "today" never anchors a range.
  const [anchor, setAnchor] = useState<string | null>(null);
  const custom = value.timeMode === "scheduled";

  // Bring a stored timing (legacy "today", or one that has since gone stale)
  // back inside the rules once they arrive.
  useEffect(() => {
    if (rulesQuery.status !== "success" || value.timeMode !== "scheduled") return;
    const { timing } = normalizeTiming(value, rulesQuery.data, new Date());
    if (JSON.stringify(timing) !== JSON.stringify(value)) onChange(timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesQuery.status]);

  function commit(next: ScheduledTiming, rules: SchedulingRules, why?: Notice) {
    const { timing, jumpedToTomorrow } = normalizeTiming(next, rules, new Date());
    lastScheduled.current = timing;
    if (jumpedToTomorrow) {
      setNotice({ key: "jumped", time: timing.timeKind === "range" ? timing.timeRange!.from : timing.time });
      setAnchor(null);
    } else setNotice(why ?? null);
    onChange(timing);
  }

  function chooseMode(mode: "driver" | "custom") {
    setNotice(null);
    if (mode === "driver") {
      if (value.timeMode === "scheduled") lastScheduled.current = value;
      onChange({ timeMode: "now" });
      return;
    }
    if (rulesQuery.status !== "success") return;
    const rules = rulesQuery.data;
    commit(lastScheduled.current ?? defaultScheduled(rules, new Date()), rules);
  }

  return (
    <section aria-labelledby="when-title" className="space-y-3">
      <p id="when-title" className="text-sm font-semibold text-ink">
        {t("when.title")}
      </p>
      <Segmented
        label={t("when.title")}
        value={custom ? "custom" : "driver"}
        onChange={chooseMode}
        options={[
          { id: "driver", label: t("when.driver") },
          { id: "custom", label: t("when.custom") },
        ]}
      />
      {!custom && <p className="text-xs text-ink/60">{t("when.driverHint")}</p>}

      <Expand open={custom}>
        {rulesQuery.status === "error" ? (
          <div role="alert" className="mt-1 flex items-center gap-3 rounded-card border border-border p-4">
            <p className="min-w-0 flex-1 text-sm text-ink/70">{t("when.loadError")}</p>
            <Button variant="secondary" size="sm" onClick={() => rulesQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : rulesQuery.status === "loading" || value.timeMode !== "scheduled" ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : (
          <ScheduledFields
            timing={value}
            rules={rulesQuery.data}
            anchor={anchor}
            setAnchor={setAnchor}
            notice={notice}
            commit={(next, why) => commit(next, rulesQuery.data, why)}
            t={t}
            intlTag={intlTag}
          />
        )}
      </Expand>
    </section>
  );
}

function ScheduledFields({
  timing,
  rules,
  anchor,
  setAnchor,
  notice,
  commit,
  t,
  intlTag,
}: {
  timing: ScheduledTiming;
  rules: SchedulingRules;
  anchor: string | null;
  setAnchor: (d: string | null) => void;
  notice: Notice;
  commit: (next: ScheduledTiming, why?: Notice) => void;
  t: ReturnType<typeof useT>["t"];
  intlTag: string;
}) {
  const now = new Date();
  const today = isoDay(now);
  const days = bookableDays(rules, now);
  const slots = timeSlots(rules);
  const start = resolveDay(timing.date, now);
  const end = timing.dateEnd ? resolveDay(timing.dateEnd, now) : undefined;
  const earliest = earliestToday(rules, now);
  const onToday = start === today;
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Keep the start chip in view (e.g. after jumping to tomorrow).
  useEffect(() => {
    chipRefs.current[start]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [start]);

  function tapDay(d: string) {
    if (anchor && !end && d > anchor) {
      if (dayDiff(anchor, d) <= rules.maxRangeDays) {
        setAnchor(null);
        commit({ ...timing, date: anchor, dateEnd: d });
        return;
      }
      // Too far for a range: blocked — that tap starts a fresh single date.
      setAnchor(d);
      commit({ ...timing, date: d, dateEnd: undefined }, { key: "rangeTooLong" });
      return;
    }
    setAnchor(d);
    commit({ ...timing, date: d, dateEnd: undefined });
  }

  function setKind(kind: "exact" | "range") {
    if (kind === timing.timeKind) return;
    if (kind === "range") {
      const from = timing.time ?? toHHMM(earliest);
      commit({ ...timing, timeKind: "range", time: undefined, timeRange: { from, to: toHHMM(toMinutes(from) + 60) } });
    } else {
      commit({ ...timing, timeKind: "exact", time: timing.timeRange?.from, timeRange: undefined });
    }
  }

  const pastToday = (s: string) => onToday && toMinutes(s) < earliest;
  const maxFrom = latestFrom(rules);
  const from = timing.timeRange?.from ?? "00:00";

  function setFrom(s: string) {
    commit({ ...timing, timeRange: { from: s, to: timing.timeRange?.to ?? s } });
  }
  function setTo(s: string) {
    const fixed = toMinutes(s) - toMinutes(from) < rules.minRangeMinutes;
    const to = fixed ? toHHMM(toMinutes(from) + rules.minRangeMinutes) : s;
    commit({ ...timing, timeRange: { from, to: s } }, fixed ? { key: "gapFixed", time: to } : undefined);
  }

  const noticeText =
    notice?.key === "jumped"
      ? t("when.jumped", { time: notice.time ?? "" })
      : notice?.key === "gapFixed"
      ? t("when.gapFixed", { min: rules.minRangeMinutes, time: notice.time ?? "" })
      : notice?.key === "rangeTooLong"
      ? t("when.rangeTooLong", { max: rules.maxRangeDays })
      : "";

  return (
    <div className="space-y-4 pt-2">
      {/* Date first */}
      <div>
        <p id="when-date" className="mb-2 text-xs font-semibold text-ink/60">
          {t("when.date")}
        </p>
        <div
          role="group"
          aria-labelledby="when-date"
          className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto overscroll-x-contain px-5 py-1"
        >
          {days.map((d) => {
            const isEdge = d === start || d === end;
            const inRange = !!end && d > start && d < end;
            const named = d === today || d === addDays(today, 1);
            return (
              <button
                key={d}
                ref={(el) => (chipRefs.current[d] = el)}
                type="button"
                aria-pressed={isEdge || inRange}
                aria-label={named ? `${dayLabel(d, t, intlTag, now)}, ${shortDate(d, intlTag)}` : `${weekdayShort(d, intlTag)}, ${shortDate(d, intlTag)}`}
                onClick={() => tapDay(d)}
                className={cn(
                  "flex h-14 shrink-0 snap-start flex-col items-center justify-center rounded-xl border-2 px-3 transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.97]",
                  named ? "min-w-[76px]" : "min-w-[56px]",
                  isEdge
                    ? "border-brand-yellow bg-brand-yellow text-on-yellow shadow-softer"
                    : inRange
                    ? "border-brand-yellow/40 bg-brand-yellow/20 text-ink"
                    : "border-border bg-card text-ink/70 hover:border-ink/25 hover:text-ink"
                )}
              >
                <span className="text-xs leading-4">{named ? dayLabel(d, t, intlTag, now) : weekdayShort(d, intlTag)}</span>
                <span className="text-sm font-semibold leading-5 tabular">{shortDate(d, intlTag)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex min-h-[44px] items-center justify-between gap-3">
          {end ? (
            <>
              <p className="text-sm font-semibold text-ink tabular">
                {dayLabel(start, t, intlTag, now)} – {dayLabel(end, t, intlTag, now)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAnchor(start);
                  commit({ ...timing, dateEnd: undefined });
                }}
                className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-accent"
              >
                <X className="h-3.5 w-3.5" /> {t("when.clearRange")}
              </button>
            </>
          ) : (
            <p className="text-xs text-ink/60 text-pretty">{t("when.rangeHint", { max: rules.maxRangeDays })}</p>
          )}
        </div>
      </div>

      <Segmented
        label={t("when.time")}
        value={timing.timeKind}
        onChange={setKind}
        options={[
          { id: "exact", label: t("order.exactTime") },
          { id: "range", label: t("order.timeRange") },
        ]}
      />

      <div key={timing.timeKind} className="animate-fade-in">
        {timing.timeKind === "exact" ? (
          <div className="mx-auto max-w-[200px]">
            <WheelPicker
              options={slots}
              value={timing.time ?? slots[0]}
              onChange={(s) => commit({ ...timing, time: s })}
              ariaLabel={t("order.exactTime")}
              isDimmed={pastToday}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-center text-xs font-semibold text-ink/60">{t("order.timeFrom")}</p>
              <WheelPicker
                options={slots}
                value={from}
                onChange={setFrom}
                ariaLabel={t("order.timeFrom")}
                isDimmed={(s) => pastToday(s) || toMinutes(s) > maxFrom}
              />
            </div>
            <div>
              <p className="mb-1 text-center text-xs font-semibold text-ink/60">{t("order.timeTo")}</p>
              <WheelPicker
                options={slots}
                value={timing.timeRange?.to ?? slots[0]}
                onChange={setTo}
                ariaLabel={t("order.timeTo")}
                isDimmed={(s) => toMinutes(s) - toMinutes(from) < rules.minRangeMinutes}
              />
            </div>
          </div>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-xl px-3 text-xs font-semibold transition-[opacity,padding] duration-200",
          noticeText ? "bg-brand-yellow/20 py-2.5 text-ink opacity-100" : "py-0 opacity-0"
        )}
      >
        {noticeText}
      </p>
    </div>
  );
}
