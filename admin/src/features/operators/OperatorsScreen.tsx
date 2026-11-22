import { Navigate, Route, Routes } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { DriversScreen } from "@/features/drivers/DriversScreen";
import { OperatorsBoard } from "./OperatorsBoard";
import { OperatorQueueView } from "./OperatorQueueView";
import { OperatorHistory } from "./OperatorHistory";

/** `/operators/*`. Which window opens is decided by Me (actions and
 * sections), never by a role name: "operatorWork" gets the operator's own
 * Navbat + Tarix, "operatorSupervise" gets the three-column board. */
export function OperatorsScreen() {
  const { me } = usePermissions();
  if (!me) return null;
  const canWork = me.actions.includes("operatorWork");
  const canSupervise = me.actions.includes("operatorSupervise");
  const canDrivers = me.sections.includes("drivers_view");

  return (
    <Routes>
      <Route index element={canWork ? <OperatorQueueView /> : canSupervise ? <OperatorsBoard /> : <Navigate to="/" replace />} />
      <Route path="history" element={canWork ? <OperatorHistory /> : <Navigate to="/operators" replace />} />
      <Route path="drivers" element={canDrivers ? <DriversScreen readOnly /> : <Navigate to="/operators" replace />} />
      <Route path="*" element={<Navigate to="/operators" replace />} />
    </Routes>
  );
}
