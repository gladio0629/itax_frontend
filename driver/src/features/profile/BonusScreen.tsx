import { api } from "@/api/client";
import type { BonusLevel } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { useCountUp } from "@/lib/useCountUp";
import { Check, Trophy } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, SectionLabel } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Money } from "@/components/Money";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

const LEVEL_TONE: Record<BonusLevel["key"], string> = {
  bronze: "bg-[#94531F] text-white",
  silver: "bg-[#AEB7C8] text-[#0e1630]",
  gold: "bg-yellow text-on-yellow",
};

export default function BonusScreen() {
  const { t } = useT();
  const q = useQuery(() => api.getBonus(), []);
  const b = q.data;
  const pct = useCountUp(b?.commissionPct, 500);
  const top = b?.levels[b.levels.length - 1];

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("bonus.title")} back="/profile" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {q.error && !b ? (
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        ) : !b || !top ? (
          <div className="space-y-4" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-56 rounded-card" />
            <Skeleton className="h-40 rounded-card" />
          </div>
        ) : (
          <div className="animate-fade-up space-y-5">
            {/* Hero: always navy so yellow reads AA in both themes. */}
            <section className="rounded-card p-5 text-white shadow-2" style={{ background: "linear-gradient(140deg, #24448f 0%, #15275a 60%, #0d1a40 100%)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[#C3CCE4]">{t("bonus.commissionNow")}</p>
                  <p className="tabular text-4xl font-bold text-[#F6BF0E]">
                    {pct}%
                    {b.active && <s className="ml-2 text-lg font-medium text-[#C3CCE4]">{b.baseCommissionPct}%</s>}
                  </p>
                </div>
                <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-button px-3 text-sm font-bold", LEVEL_TONE[b.currentLevel.key])}>
                  <Trophy className="h-4 w-4" />
                  {t(`bonus.level.${b.currentLevel.key}`)}
                </span>
              </div>

              <p className="tabular mt-5 text-base font-bold">{t("bonus.weekTrips", { n: b.weekTrips })}</p>
              <ProgressBar
                className="mt-3 h-3 bg-white/15"
                value={b.progressRatio}
                milestones={b.levels.filter((l) => l.position > 0 && l.position < 1).map((l) => l.position)}
                label={t("bonus.progressLabel", { n: b.weekTrips, target: top.tripsRequired })}
              />
              {/* Milestone labels under the bar, positioned on the same scale. */}
              <div className="relative mt-2 h-10" aria-hidden="true">
                {b.levels.map((l) => {
                  const x = l.position * 100;
                  const reached = l.reached;
                  return (
                    <span
                      key={l.key}
                      className={cn("tabular absolute top-0 flex flex-col text-xs", x === 0 ? "items-start" : x === 100 ? "items-end" : "items-center", reached ? "text-white" : "text-[#C3CCE4]")}
                      style={{ left: `${x}%`, transform: x === 0 ? undefined : x === 100 ? "translateX(-100%)" : "translateX(-50%)" }}
                    >
                      <span className="font-bold">{l.commissionPct}%</span>
                      <span>{l.tripsRequired}</span>
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-[#F6BF0E]">
                {b.nextLevel ? t("bonus.toNext", { level: t(`bonus.level.${b.nextLevel.key}`), n: b.tripsToNext }) : t("bonus.topReached")}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-sm text-muted">{t("bonus.saved")}</p>
                <Money value={b.savedThisWeek} className="mt-1 block text-xl font-bold text-gold" />
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted">{t("bonus.currentLevel")}</p>
                <p className="mt-1 text-xl font-bold text-ink">{t(`bonus.level.${b.currentLevel.key}`)}</p>
              </Card>
            </div>
            <p className="tabular -mt-2 px-1 text-sm text-muted">{t("bonus.resets", { n: b.resetsInDays })}</p>

            <section aria-labelledby="lv">
              <SectionLabel id="lv">{t("bonus.levels")}</SectionLabel>
              <ol className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-1">
                {b.levels.map((l) => {
                  const current = l.key === b.currentLevel.key;
                  const reached = l.reached;
                  return (
                    <li key={l.key} aria-current={current ? "true" : undefined} className={cn("flex min-h-[64px] items-center gap-3 px-4 py-3", current && "bg-yellow/10")}>
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", LEVEL_TONE[l.key])}>
                        {reached ? <Check className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-ink">{t(`bonus.level.${l.key}`)}</p>
                        <p className="tabular text-sm text-muted">{t("bonus.levelRow", { n: l.tripsRequired })}</p>
                      </div>
                      <span className={cn("tabular text-xl font-bold", l.commissionPct === 0 ? "text-gold" : "text-ink")}>{l.commissionPct}%</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section aria-labelledby="how">
              <SectionLabel id="how">{t("bonus.howTo")}</SectionLabel>
              <ul className="space-y-3">
                {b.rules.map((r) => (
                  <li key={r.key}>
                    <Card className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base text-ink">{t(r.key as never, { n: r.target })}</p>
                        {r.done ? (
                          <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-button bg-success/15 px-2.5 text-sm font-medium text-success">
                            <Check className="h-4 w-4" />
                            {t("bonus.ruleDone")}
                          </span>
                        ) : (
                          <span className="tabular shrink-0 text-sm text-muted">{t("bonus.ruleProgress", { progress: r.progress, target: r.target })}</span>
                        )}
                      </div>
                      {r.key === "bonus.rule.trips" && <ProgressBar className="mt-3" value={r.ratio} label={t(r.key as never, { n: r.target })} />}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
