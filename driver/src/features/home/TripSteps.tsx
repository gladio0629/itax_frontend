import type { TripStep } from "@/api/types";
import { Check } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/** Yo'lda → Kutmoqda → Safarni boshladim → Yetib keldim. Active = yellow, done = checked. */
export function TripSteps({ steps }: { steps: TripStep[] }) {
  const { t } = useT();
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={t("trip.progressLabel")}>
      {steps.map((s, i) => (
        <li key={s.stage} className="flex flex-col items-center gap-1.5 text-center" aria-current={s.state === "active" ? "step" : undefined}>
          <div className="flex w-full items-center">
            <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : s.state === "upcoming" ? "bg-ink/10" : "bg-yellow")} />
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                s.state === "done" && "bg-yellow text-on-yellow",
                s.state === "active" && "bg-yellow text-on-yellow ring-4 ring-yellow/25",
                s.state === "upcoming" && "bg-raised text-muted"
              )}
            >
              {s.state === "done" ? <Check className="h-4 w-4" /> : <span className="tabular">{i + 1}</span>}
            </span>
            <span className={cn("h-0.5 flex-1", i === steps.length - 1 ? "opacity-0" : steps[i + 1]?.state === "upcoming" ? "bg-ink/10" : "bg-yellow")} />
          </div>
          <span className={cn("text-xs leading-tight", s.state === "active" ? "font-bold text-ink" : "text-muted")}>
            {t(`trip.stage.${s.stage}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
