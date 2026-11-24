import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/layouts/PageHeader";
import { OrdersScreen } from "@/features/orders/OrdersScreen";
import { OpHistoryTabs, useOrdersTotal, useTasksSummary } from "./OpHistoryTabs";
import { opPath } from "./paths";

/** Operator "Buyurtmalar" (design OperatorHistory, 2026-11-24): the orders
 * list without the old "Faqat ko'rish" banner; a row opens the operator
 * order page. Filters and counts are the shared orders list's (server). */
export function OpOrdersPage() {
  const navigate = useNavigate();
  const total = useOrdersTotal();
  const { summary } = useTasksSummary();
  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Buyurtmalar" />
      <OpHistoryTabs first="orders" ordersCount={total} tasksCount={summary?.total} />
      <OrdersScreen readOnly onOpen={(o) => navigate(opPath.order(o.id))} />
    </>
  );
}
