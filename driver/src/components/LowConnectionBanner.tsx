import { WifiOff } from "lucide-react";
import { useDemoStore } from "@/stores/demoStore";

export function LowConnectionBanner() {
  const slow = useDemoStore((s) => s.scenarios.slowInternet);
  if (!slow) return null;
  return (
    <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-xs font-semibold text-warning animate-slide-up">
      <WifiOff className="h-4 w-4 shrink-0" />
      Internet aloqasi sekin. Ma'lumotlar yuklanishi biroz vaqt olishi mumkin.
    </div>
  );
}
