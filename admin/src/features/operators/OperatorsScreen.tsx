import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs } from "@/components/Tabs";
import type { OperatorCounts } from "@/api/types";
import { QueueTab } from "./QueueTab";
import { InProgressTab } from "./InProgressTab";
import { HistoryTab } from "./HistoryTab";

type TabKey = "queue" | "inProgress" | "history";

/** One "operators" section, two different shapes: an operator gets Navbat
 * (with the buttons to work it) + Tarix; a supervisor (superadmin/owner/
 * menejer) gets a read-only Navbat + Jarayonda + Bugungi tasdiqlanganlar.
 * Which is which is decided entirely by Me.actions — never a role check. */
export function OperatorsScreen() {
  const { me } = usePermissions();
  const canWork = !!me?.actions.includes("operatorWork");
  const canSupervise = !!me?.actions.includes("operatorSupervise");
  const [tab, setTab] = useState<TabKey>("queue");
  const [counts, setCounts] = useState<OperatorCounts | null>(null);

  async function loadCounts() {
    try {
      setCounts(await api.getOperatorCounts());
    } catch {
      /* badges are best-effort */
    }
  }
  useEffect(() => {
    loadCounts();
  }, [tab]);

  if (!me) return null;

  const tabs: { key: TabKey; label: string; count?: number }[] = canSupervise
    ? [
        { key: "queue", label: "Navbat", count: counts?.queue },
        { key: "inProgress", label: "Jarayonda", count: counts?.inProgress },
        { key: "history", label: "Bugungi tasdiqlanganlar", count: counts?.approvedToday },
      ]
    : [
        { key: "queue", label: "Navbat", count: counts?.queue },
        { key: "history", label: "Tarix" },
      ];

  return (
    <div className="space-y-5">
      <Tabs label="Operator oynalari" items={tabs} value={tab} onChange={setTab} />

      {tab === "queue" && <QueueTab canWork={canWork} onChanged={loadCounts} />}
      {tab === "inProgress" && canSupervise && <InProgressTab />}
      {tab === "history" && <HistoryTab canSupervise={canSupervise} onChanged={loadCounts} />}
    </div>
  );
}
