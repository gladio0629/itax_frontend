import { WifiOff } from "@/lib/icons";
import { useDemoStore } from "@/stores/demoStore";
import { useT } from "@/lib/i18n/provider";

export function SlowBanner() {
  const slow = useDemoStore((s) => s.network.slowInternet);
  const { t } = useT();
  if (!slow) return null;
  return (
    <div
      role="status"
      className="relative z-[55] flex shrink-0 items-center justify-center gap-2 bg-warning px-4 pb-1.5 text-xs font-medium text-[#1a1203]"
      style={{ paddingTop: "calc(var(--safe-top) + 6px)" }}
    >
      <WifiOff className="h-4 w-4" />
      {t("banner.slow")}
    </div>
  );
}
