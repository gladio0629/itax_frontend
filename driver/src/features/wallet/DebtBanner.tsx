import { AlertTriangle } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import type { DebtLevel } from "@/api/types";

/** Persistent debt warning. Level comes from the adapter. */
export function DebtBanner({ level, onTopup, className }: { level: DebtLevel; onTopup?: () => void; className?: string }) {
  const { t } = useT();
  if (level === "ok") return null;
  const blocked = level === "blocked";
  return (
    <div role="alert" className={cn("flex animate-fade-up items-center gap-3 rounded-field p-3 pl-4", blocked ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning", className)}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 text-13 font-bold">{blocked ? t("wallet.blockedBanner") : t("wallet.nearBanner")}</p>
      {onTopup && (
        <button type="button" onClick={onTopup} className="press h-11 shrink-0 rounded-full bg-surface px-4 text-13 font-extrabold text-ink">
          {t("wallet.topup")}
        </button>
      )}
    </div>
  );
}
