import { WifiOff } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { useOnline } from "@/lib/useOnline";

/** Floating Ink card at the top while the device is offline (every build). */
export function OfflineBanner() {
  const { t } = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="absolute inset-x-5 z-[60] flex animate-fade-up items-center gap-3.5 rounded-card bg-night py-3.5 pl-4 pr-3.5 shadow-float"
      style={{ top: "calc(var(--safe-top) + 12px)" }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile bg-[#3A2410] text-warning-icon" aria-hidden="true">
        <WifiOff className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-15 font-extrabold text-white">{t("state.offlineBanner")}</span>
        <span className="text-13 text-night-muted">{t("state.offlineBannerDesc")}</span>
      </span>
    </div>
  );
}
