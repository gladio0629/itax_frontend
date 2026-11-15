import { WifiOff } from "@/lib/icons";
import { useDemoStore } from "@/stores/demoStore";
import { useT } from "@/lib/i18n/provider";

export function LowConnectionBanner() {
  const { t } = useT();
  const slow = useDemoStore((s) => s.scenarios.slowInternet);
  if (!slow) return null;
  return (
    <div role="status" className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-xs font-normal text-warning shadow-softer animate-slide-up">
      <WifiOff className="h-4 w-4 shrink-0" />
      {t("banner.slowInternet")}
    </div>
  );
}
