import { WifiOff } from "@/lib/icons";
import { useTestControls } from "@/stores/testControlsStore";
import { useT } from "@/lib/i18n/provider";

/** Shown while the test panel's "Sekin internet" switch is on (sample-data mode). */
export function SlowBanner() {
  const slow = useTestControls((s) => s.network.slowInternet);
  const { t } = useT();
  if (!slow) return null;
  return (
    <div
      role="status"
      className="relative z-[55] flex shrink-0 items-center justify-center gap-2 bg-warning-fill px-4 pb-1.5 text-xs font-medium text-on-warning"
      style={{ paddingTop: "calc(var(--safe-top) + 6px)" }}
    >
      <WifiOff className="h-4 w-4" />
      {t("banner.slow")}
    </div>
  );
}
