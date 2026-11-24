import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { OrdersScreen } from "@/features/orders/OrdersScreen";
import { OpHistoryTabs } from "./OpHistoryTabs";
import { opPath } from "./paths";

/** Operator "Buyurtmalar" (design OperatorHistory, 2026-11-24): the orders
 * list without the old "Faqat ko'rish" banner; a row opens the operator
 * order page. Filters and counts are the shared orders list's (server). */
export function OpOrdersPage() {
  const navigate = useNavigate();
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

  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Buyurtmalar" />
      <OpHistoryTabs first="orders" ordersCount={total} />
      <OrdersScreen readOnly onOpen={(o) => navigate(opPath.order(o.id))} />
    </>
  );
}
