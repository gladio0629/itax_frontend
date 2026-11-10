import { useState } from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { monthNames, weekdayNames } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Month-grid calendar, Monday-first, for picking "boshqa sana" — replaces
 * the native `<input type=date>` (unreliable to open/verify in a headless
 * sandbox, and didn't match the sheet's visual language). */
export function Calendar({
  value,
  onChange,
  intlTag,
}: {
  value?: string;
  onChange: (iso: string) => void;
  intlTag: string;
}) {
  const { t } = useT();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initial = value ? new Date(`${value}T00:00:00`) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label={t("calendar.prevMonth")}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink/70 hover:bg-ink/5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize text-ink">
          {monthNames(intlTag)[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label={t("calendar.nextMonth")}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink/70 hover:bg-ink/5"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-normal text-ink/60">
        {weekdayNames(intlTag).map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad${i}`} />;
          const cellDate = new Date(viewYear, viewMonth, day);
          const iso = toISODate(cellDate);
          const isPast = cellDate < today;
          const isSelected = value === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onChange(iso)}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm tabular transition-colors",
                isSelected
                  ? "bg-brand-yellow text-on-yellow font-semibold"
                  : isPast
                  ? "text-ink/30"
                  : "text-ink hover:bg-ink/5"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
