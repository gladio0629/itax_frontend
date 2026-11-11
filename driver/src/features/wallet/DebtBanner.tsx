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
    <div role="alert" className={cn("flex animate-fade-up items-center gap-3 rounded-card p-3 pl-4 shadow-1", blocked ? "bg-danger-fill text-white" : "bg-warning-fill text-on-warning", className)}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-medium">{blocked ? t("wallet.blockedBanner") : t("wallet.nearBanner")}</p>
      {onTopup && (
        <button type="button" onClick={onTopup} className="press h-12 shrink-0 rounded-button bg-black/20 px-4 text-sm font-bold">
          {t("wallet.topup")}
        </button>
      )}
    </div>
  );
}
