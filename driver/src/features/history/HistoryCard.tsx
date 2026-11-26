import { Link } from "react-router-dom";
import type { HistoryItem } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { ArrowRight } from "@/lib/icons";
import { formatAmount, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/** One trip in Tarix: route, time · payment (or delivery), status tag, what the driver kept. */
export function HistoryCard({ item }: { item: HistoryItem }) {
  const { t } = useT();
  const cancelled = item.status === "cancelled";
  const how = item.kind === "delivery" ? t("history.kindDelivery") : item.payment ? (item.payment === "cash" ? t("pay.cash") : t("pay.card")).toLowerCase() : null;
  return (
    <Link
      to={`/history/${item.id}`}
      aria-label={t("orders.openDetail", { from: item.from.name, to: item.to.name, amount: `${formatAmount(item.earnings)} ${t("common.som")}` })}
      className="press focus-inset flex min-h-[76px] items-center gap-3 py-3"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-15 font-extrabold text-ink">
          <span className="truncate">{item.from.name}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate">{item.to.name}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular text-xs font-semibold text-muted">
            {formatTime(item.createdAt)}
            {how && ` · ${how}`}
          </span>
          <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-xs font-bold", cancelled ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-ink")}>
            {cancelled ? t("history.cancelled") : t("history.done")}
          </span>
        </span>
      </span>
      <span className={cn("tabular shrink-0 text-17 font-extrabold", cancelled ? "text-muted" : "text-ink")}>{cancelled ? formatAmount(item.earnings) : `+${formatAmount(item.earnings)}`}</span>
    </Link>
  );
}
