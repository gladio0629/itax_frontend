import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "@/api/client";
import type { OpTasksSummary } from "@/api/ops/types";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { opPath } from "./paths";

/** The two operator lists that share one tab bar in the design
 * (OperatorHistory ↔ OpMyTasks). They are separate routes, so the tabs are
 * links. Counts come from the server; a missing count shows nothing. */
export function OpHistoryTabs({ ordersCount, tasksCount, first }: { ordersCount?: number; tasksCount?: number; first: "orders" | "tasks" }) {
  const items = [
    { to: opPath.orders, label: "Buyurtmalar", count: ordersCount },
    { to: opPath.tasks, label: "Mening vazifalarim", count: tasksCount },
  ];
  if (first === "tasks") items.reverse();
  return (
    <nav aria-label="Buyurtmalar va vazifalar" className="no-scrollbar flex gap-7 overflow-x-auto border-b border-line">
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn(
              "relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-sm",
              isActive ? "font-extrabold text-ink shadow-[inset_0_-3px_0_var(--green)]" : "font-semibold text-muted hover:text-ink"
            )
          }
        >
          {({ isActive }) => (
            <>
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-extrabold",
                    isActive ? "bg-ink text-white" : "bg-surface text-muted"
                  )}
                >
                  {formatNumber(t.count)}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Orders tab counter: all orders the operator may see (server count). */
export function useOrdersTotal(): number | undefined {
  const [total, setTotal] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!api.capabilities.orderCounts) return;
    let live = true;
    api
      .getOrderCounts({})
      .then((c) => live && setTotal(c.all))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return total;
}

/** The operator's own requests and calls (tiles + tab counter). */
export function useTasksSummary(): { summary: OpTasksSummary | null; reload: () => void } {
  const [summary, setSummary] = useState<OpTasksSummary | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api
      .getMyTasksSummary()
      .then((s) => live && setSummary(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { summary, reload };
}
