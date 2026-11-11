import { isDemo } from "@/api/client";
import { useT } from "@/lib/i18n/provider";

export function DemoBadge({ className = "" }: { className?: string }) {
  const { t } = useT();
  if (!isDemo) return null;
  return (
    <span className={`pointer-events-none rounded-button bg-raised px-2.5 py-1 text-xs font-medium text-muted shadow-1 ${className}`}>
      {t("common.demo")}
    </span>
  );
}
