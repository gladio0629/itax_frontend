import { Navigate, Route, Routes } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { DriversScreen } from "@/features/drivers/DriversScreen";
import { OpOrdersPage } from "@/features/ops/OpOrdersPage";
import { OpOrderPage } from "@/features/ops/OpOrderPage";
import { OpTasksPage } from "@/features/ops/OpTasksPage";
import { opPath } from "@/features/ops/paths";
import { OperatorsBoard } from "./OperatorsBoard";
import { OperatorQueueView } from "./OperatorQueueView";

/** `/operators/*`. Which window opens is decided by Me (actions and
 * sections), never by a role name: "operatorWork" gets the operator's own
 * windows (route contract 2026-11-24: queue, orders, tasks, ...),
 * "operatorSupervise" gets the three-column board at the index. */
export function OperatorsScreen() {
  const { me } = usePermissions();
  if (!me) return null;
  const canWork = me.actions.includes("operatorWork");
  const canSupervise = me.actions.includes("operatorSupervise");
  const canDrivers = me.sections.includes("drivers_view");
  const work = (el: JSX.Element) => (canWork ? el : <Navigate to="/operators" replace />);

  return (
    <Routes>
      <Route index element={canWork ? <Navigate to={opPath.queue} replace /> : canSupervise ? <OperatorsBoard /> : <Navigate to="/" replace />} />
      <Route path="queue" element={work(<OperatorQueueView />)} />
      <Route path="orders" element={work(<OpOrdersPage />)} />
      <Route path="orders/:orderId" element={work(<OpOrderPage />)} />
      <Route path="tasks" element={work(<OpTasksPage />)} />
      {/* Old link of the operator's "Tarix". */}
      <Route path="history" element={<Navigate to={opPath.tasks} replace />} />
      <Route path="drivers" element={canDrivers ? <DriversScreen readOnly /> : <Navigate to="/operators" replace />} />
      <Route path="*" element={<Navigate to="/operators" replace />} />
    </Routes>
  );
}
