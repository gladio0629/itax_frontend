import { Link } from "react-router-dom";
import type { HistoryItem } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Banknote, CreditCard, Package, Star } from "@/lib/icons";
import { formatAmount, formatTime } from "@/lib/format";
import { dayLabel } from "@/lib/relative";

export function HistoryCard({ item }: { item: HistoryItem }) {
  const { t } = useT();
  const PayIcon = item.payment === "cash" ? Banknote : CreditCard;
  const cancelled = item.status === "cancelled";
  return (
    <Link
      to={`/orders/${item.id}`}
      aria-label={t("orders.openDetail", { from: item.from.name, to: item.to.name, amount: `${formatAmount(item.earnings)} ${t("common.som")}` })}
      className="press block rounded-card bg-surface p-4 shadow-1"
    >
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <span className="tabular">
          {dayLabel(item.createdAt, t)}, {formatTime(item.createdAt)}
        </span>
        <span className="flex items-center gap-2">
          {item.kind === "delivery" && <Package className="h-4 w-4" aria-label={t("offer.delivery")} />}
          <PayIcon className="h-4 w-4" aria-label={item.payment === "cash" ? t("pay.cash") : t("pay.card")} />
        </span>
      </div>
      <p className="mt-2 truncate text-lg font-bold text-ink">
        {item.from.name} <span aria-hidden="true" className="text-muted">→</span>
        <span className="sr-only">–</span> {item.to.name}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
          <span className="truncate">{item.passengerName}</span>
          {item.ratingReceived != null && (
            <span className="tabular inline-flex shrink-0 items-center gap-1 text-ink">
              <Star className="h-4 w-4 fill-yellow text-yellow" />
              {item.ratingReceived.toFixed(1)}
            </span>
          )}
        </p>
        {cancelled ? (
          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-danger/15 px-2.5 text-xs font-medium text-danger">{t("orders.cancelledBadge")}</span>
        ) : (
          <p className="tabular shrink-0 text-xl font-bold text-gold">
            +{formatAmount(item.earnings)}
            <span className="ml-1 text-xs font-medium text-muted">{t("common.som")}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
