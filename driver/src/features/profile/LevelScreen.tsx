import { api } from "@/api/client";
import type { BonusRule } from "@/api/types";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { Check, Clock, Gift, Trophy } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

const MEDAL = { bronze: "bg-medal-bronze", silver: "bg-medal-silver", gold: "bg-medal-gold" } as const;
const RULE_LABEL: Record<string, TranslationKey> = {
  "bonus.rule.trips": "level.rule.trips",
  "bonus.rule.rating": "level.rule.rating",
  "bonus.rule.cancels": "level.rule.cancels",
};

/**
 * Darajalar (design v2): Bronza / Kumush / Oltin with their commission, the
 * driver's level marked "Siz", then the road to the next level with the
 * server's rules and progress.
 */
export default function LevelScreen() {
  const { t } = useT();
  const q = useQuery(() => api.getBonus(), []);
  const b = q.data;
  const target = b?.nextLevel ?? null;

  return (
    <Screen
      back="/profile"
      title={t("level.title")}
      top={
        b ? (
          <div className="grid grid-cols-3 gap-2">
            {b.levels.map((l) => {
              const current = l.key === b.currentLevel.key;
              const passed = l.reached && !current;
              const next = b.nextLevel?.key === l.key;
              return (
                <div key={l.key} className={cn("flex flex-col items-center gap-1.5 rounded-card bg-night-2 px-2 py-4 text-center", current && "ring-2 ring-night-muted")}>
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-full text-night", MEDAL[l.key])} aria-hidden="true">
                    <Trophy className="h-5 w-5" />
                  </span>
                  <span className="text-15 font-extrabold text-white">{t(`bonus.level.${l.key}`)}</span>
                  <span className="tabular text-2xl font-extrabold text-white">{l.commissionPct}%</span>
                  <span className="text-xs font-semibold text-night-muted">{t("level.commission")}</span>
                  <span className="h-6">
                    {current ? (
                      <span className="inline-flex h-6 items-center rounded-full bg-night-muted px-2.5 text-xs font-extrabold uppercase text-night">{t("level.you")}</span>
                    ) : passed ? (
                      <span className="text-xs font-bold text-brand">{t("level.passed")}</span>
                    ) : next ? (
                      <span className="text-xs font-bold text-night-muted">{t("level.next")}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        ) : !q.error ? (
          <Skeleton className="h-44 w-full rounded-card bg-night-2" />
        ) : undefined
      }
    >
      {q.error && !b ? (
        <ErrorState error={q.error} onRetry={() => q.reload()} />
      ) : !b ? (
        <SkeletonList rows={2} label={t("common.loading")} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold text-ink">{target ? t("level.road", { level: t(`bonus.level.${target.key}`) }) : t("level.topTitle")}</h2>
            <p className="text-13 font-semibold text-muted">{t("bonus.resets", { n: b.resetsInDays })}</p>
          </div>
          <ul className="flex flex-col">
            {b.rules.map((r) => (
              <RuleRow key={r.key} rule={r} />
            ))}
          </ul>
          {target && (
            <div className="flex items-center gap-3.5 rounded-field bg-star-soft p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile bg-medal-gold text-night" aria-hidden="true">
                <Gift className="h-5 w-5" />
              </span>
              <p className="text-sm leading-[20px] text-ink">
                {t(target.commissionPct === 0 ? "level.noteZero" : "level.note", { level: t(`bonus.level.${target.key}`), pct: target.commissionPct })}
              </p>
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}

function RuleRow({ rule: r }: { rule: BonusRule }) {
  const { t } = useT();
  const label = RULE_LABEL[r.key] ? t(RULE_LABEL[r.key]) : "";
  const cancels = r.key === "bonus.rule.cancels";
  return (
    <li className="flex flex-col gap-2.5 border-b border-line py-3.5 last:border-b-0">
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-15 font-bold text-ink">
          {r.done ? <Check className="h-4 w-4 text-brand-ink" /> : <Clock className="h-4 w-4 text-warning" />}
          {label}
        </span>
        <span className="tabular text-sm text-muted">
          <b className="font-extrabold text-ink">{r.progress}</b> / {cancels ? t("level.atMost", { n: r.target }) : r.target}
        </span>
      </span>
      <span className="relative block h-2 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", r.done ? "bg-brand" : "bg-warning-icon")} style={{ width: `${Math.round(r.ratio * 100)}%` }} />
      </span>
    </li>
  );
}
