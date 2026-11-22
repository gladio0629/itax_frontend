import { Badge } from "@/components/Badge";
import { RouteText } from "@/components/Cells";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CANCELLED_BY_LABEL, ORDER_STATUS, PAYMENT_LABEL, orderNo } from "@/features/orders/labels";
import type { DriverTripRow } from "@/api/types";

/** Trips table shared by the profile (3 rows) and the history tab. */
export function TripsTable({ rows, compact, onOpen }: { rows: DriverTripRow[]; compact?: boolean; onOpen: (orderId: string) => void }) {
  const head = compact
    ? ["ID", "Sana", "Yo'nalish", "Narx", "Komissiya", "Holat"]
    : ["ID", "Sana", "Yo'nalish", "Yo'lovchi / yuk", "Narx", "Komissiya", "Haydovchiga", "Holat"];
  const right = new Set(["Narx", "Komissiya", "Haydovchiga"]);
  return (
    <div className="min-w-0 overflow-x-auto rounded-box shadow-hairline">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-surface">
            {head.map((h) => (
              <th key={h} scope="col" className={cn("h-11 whitespace-nowrap px-3 text-2xs font-bold uppercase tracking-[0.6px] text-muted", right.has(h) && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = r.status === "cancelled" && r.cancelledBy ? CANCELLED_BY_LABEL[r.cancelledBy] : ORDER_STATUS[r.status];
            return (
              <tr
                key={r.orderId}
                tabIndex={0}
                onClick={() => onOpen(r.orderId)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(r.orderId)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-row-hover focus-visible:outline-offset-[-2px]"
              >
                <td className="h-[60px] whitespace-nowrap px-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-extrabold">{orderNo(r.orderId)}</span>
                    {!compact && <span className="text-xs font-semibold text-muted">{r.kind === "delivery" ? "Dostavka" : "Yo'lovchi"}</span>}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 font-semibold">{formatShortDateTime(r.at)}</td>
                <td className="whitespace-nowrap px-3">
                  <RouteText from={r.fromName} to={r.toName} />
                </td>
                {!compact && <td className="whitespace-nowrap px-3 font-semibold">{r.subject}</td>}
                <td className="tabular whitespace-nowrap px-3 text-right">
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="font-semibold">{formatNumber(r.price)}</span>
                    {!compact && <span className="text-xs font-semibold text-muted">{PAYMENT_LABEL[r.paymentMethod].toLowerCase()}</span>}
                  </span>
                </td>
                <td className="tabular whitespace-nowrap px-3 text-right font-semibold">{r.commission !== null ? formatNumber(r.commission) : "—"}</td>
                {!compact && <td className="tabular whitespace-nowrap px-3 text-right font-bold">{r.payout !== null ? formatNumber(r.payout) : "—"}</td>}
                <td className="px-3">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
