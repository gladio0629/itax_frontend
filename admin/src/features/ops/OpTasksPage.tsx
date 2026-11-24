import { PageHeader } from "@/layouts/PageHeader";
import { MyTasks } from "@/features/operators/OperatorHistory";
import { OpHistoryTabs } from "./OpHistoryTabs";

/** Operator "Tarix" → "Mening vazifalarim" (design OpMyTasks). */
export function OpTasksPage() {
  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Tarix" />
      <OpHistoryTabs first="tasks" />
      <MyTasks />
    </>
  );
}
