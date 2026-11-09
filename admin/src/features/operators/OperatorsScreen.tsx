import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/cn";
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
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.key ? "bg-ink text-bg" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
            )}
          >
            {t.label}
            {!!t.count && (
              <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold", tab === t.key ? "bg-bg/20 text-bg" : "bg-ink/10 text-ink/70")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "queue" && <QueueTab canWork={canWork} onChanged={loadCounts} />}
      {tab === "inProgress" && canSupervise && <InProgressTab />}
      {tab === "history" && <HistoryTab canSupervise={canSupervise} onChanged={loadCounts} />}
    </div>
  );
}
