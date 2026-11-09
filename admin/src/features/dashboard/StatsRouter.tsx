import { usePermissions } from "@/hooks/usePermissions";
import { DashboardScreen } from "./DashboardScreen";
import { MarketingStatsScreen } from "./MarketingStatsScreen";

/** The "stats" section renders a different screen for marketolog (whose
 * data, per getMarketingStats(), never carries a money field) than for
 * everyone else — a routing choice, not a permissions decision: that part
 * is already settled by Me.sections. */
export function StatsRouter() {
  const { me } = usePermissions();
  if (!me) return null;
  return me.role === "marketolog" ? <MarketingStatsScreen /> : <DashboardScreen />;
}
