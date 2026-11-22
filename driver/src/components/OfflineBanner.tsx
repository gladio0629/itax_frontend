import { WifiOff } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { useOnline } from "@/lib/useOnline";

/**
 * Floating Ink card while the device is offline (every build). It sits just
 * under the header's 44px button row and lets taps through, so back /
 * notification buttons stay usable.
 */
export function OfflineBanner() {
  const { t } = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-5 z-[60] flex animate-fade-up items-center gap-3.5 rounded-card bg-night py-3.5 pl-4 pr-3.5 shadow-float"
      style={{ top: "calc(max(calc(var(--safe-top) + 12px), 56px) + 56px)" }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile bg-night-warning text-warning-icon" aria-hidden="true">
        <WifiOff className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-15 font-extrabold text-white">{t("state.offlineBanner")}</span>
        <span className="text-13 text-night-muted">{t("state.offlineBannerDesc")}</span>
      </span>
    </div>
  );
}
