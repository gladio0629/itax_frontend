import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Calendar } from "@/components/Calendar";
import { WheelPicker } from "@/components/WheelPicker";
import { useT } from "@/lib/i18n/provider";
import type { OrderTiming } from "@/api/types";
import { cn } from "@/lib/cn";

function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}
const TIME_OPTIONS = timeOptions();

function nextRoundTime(): string {
  const now = new Date();
  const minutes = Math.ceil(now.getMinutes() / 5) * 5;
  const h = (now.getHours() + Math.floor(minutes / 60)) % 24;
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function TimePickerSheet({
  initial,
  onClose,
  onApply,
}: {
  initial: OrderTiming;
  onClose: () => void;
  onApply: (timing: OrderTiming) => void;
}) {
  const { t, intlTag } = useT();
  const [date, setDate] = useState(initial.timeMode === "scheduled" ? initial.date : "today");
  const [timeKind, setTimeKind] = useState<"exact" | "range">(
    initial.timeMode === "scheduled" ? initial.timeKind : "exact"
  );
  const [time, setTime] = useState(
    (initial.timeMode === "scheduled" && initial.time) || nextRoundTime()
  );
  const [rangeFrom, setRangeFrom] = useState(
    (initial.timeMode === "scheduled" && initial.timeRange?.from) || nextRoundTime()
  );
  const [rangeTo, setRangeTo] = useState(
    (initial.timeMode === "scheduled" && initial.timeRange?.to) || TIME_OPTIONS[TIME_OPTIONS.length - 1]
  );
  const [rangeField, setRangeField] = useState<"from" | "to">("from");
  const [calendarOpen, setCalendarOpen] = useState(false);

  function apply() {
    onApply({
      timeMode: "scheduled",
      date,
      timeKind,
      time: timeKind === "exact" ? time : undefined,
      timeRange: timeKind === "range" ? { from: rangeFrom, to: rangeTo } : undefined,
    });
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t("order.scheduled")}>
      <div className="px-5 pb-6 pt-3">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("order.scheduled")}</h2>

        <div className="mb-4 flex gap-2">
          {(["today", "tomorrow"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={cn(
                "flex-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors",
                date === d ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
              )}
            >
              {t(d === "today" ? "order.today" : "order.tomorrow")}
            </button>
          ))}
          <button
            onClick={() => setCalendarOpen((v) => !v)}
            className={cn(
              "flex-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors",
              date !== "today" && date !== "tomorrow"
                ? "border-accent bg-accent-5 text-accent"
                : "border-border text-ink/70"
            )}
          >
            {date !== "today" && date !== "tomorrow" ? date : t("order.otherDate")}
          </button>
        </div>

        {calendarOpen && (
          <div className="mb-4 rounded-xl border border-border p-3">
            <Calendar
              intlTag={intlTag}
              value={date !== "today" && date !== "tomorrow" ? date : undefined}
              onChange={(iso) => {
                setDate(iso);
                setCalendarOpen(false);
              }}
            />
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTimeKind("exact")}
            className={cn(
              "flex-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors",
              timeKind === "exact" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            {t("order.exactTime")}
          </button>
          <button
            onClick={() => setTimeKind("range")}
            className={cn(
              "flex-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors",
              timeKind === "range" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
            )}
          >
            {t("order.timeRange")}
          </button>
        </div>

        {timeKind === "exact" ? (
          <WheelPicker options={TIME_OPTIONS} value={time} onChange={setTime} ariaLabel={t("order.exactTime")} />
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => setRangeField("from")}
                className={cn(
                  "flex-1 rounded-xl border-2 py-2 text-xs font-semibold tabular transition-colors",
                  rangeField === "from" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                )}
              >
                {t("order.timeFrom")}: {rangeFrom}
              </button>
              <button
                onClick={() => setRangeField("to")}
                className={cn(
                  "flex-1 rounded-xl border-2 py-2 text-xs font-semibold tabular transition-colors",
                  rangeField === "to" ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                )}
              >
                {t("order.timeTo")}: {rangeTo}
              </button>
            </div>
            <WheelPicker
              options={TIME_OPTIONS}
              value={rangeField === "from" ? rangeFrom : rangeTo}
              onChange={rangeField === "from" ? setRangeFrom : setRangeTo}
              ariaLabel={rangeField === "from" ? t("order.timeFrom") : t("order.timeTo")}
            />
            {rangeFrom === rangeTo && (
              <p role="alert" aria-live="polite" className="mt-2 text-xs font-medium text-danger">
                {t("order.timing.invalidRange")}
              </p>
            )}
          </>
        )}

        <div className="mt-5">
          <Button fullWidth disabled={timeKind === "range" && rangeFrom === rangeTo} onClick={apply}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
