import { formatAmount } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/** Amount with a smaller currency suffix. Always tabular. */
export function Money({ value, signed, className, unitClassName }: { value: number; signed?: boolean; className?: string; unitClassName?: string }) {
  const { t } = useT();
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {formatAmount(value, { signed })}
      <span className={cn("ml-1 text-[0.5em] font-medium text-muted", unitClassName)}>{t("common.som")}</span>
    </span>
  );
}
