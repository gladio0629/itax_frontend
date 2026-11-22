import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { PrimaryButton, TextButton } from "./Button";
import { Icon } from "./Icon";

/** Route-dots illustration of the empty state (design: StateEmpty). */
function EmptyArt() {
  return (
    <svg aria-hidden width="220" height="120" viewBox="0 0 220 120" className="block">
      <path d="M24 96 C 70 20, 150 20, 196 70" fill="none" stroke="var(--iz-chip-border)" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 12" />
      <circle cx="24" cy="96" r="12" fill="var(--iz-green-soft)" />
      <circle cx="24" cy="96" r="6" fill="var(--iz-green)" />
      <circle cx="196" cy="70" r="12" fill="var(--iz-field)" />
      <rect x="190" y="64" width="12" height="12" rx="3" fill="var(--iz-ink)" />
      <rect x="92" y="28" width="36" height="20" rx="8" fill="var(--iz-ink)" />
      <rect x="99" y="32" width="12" height="10" rx="3" fill="var(--iz-green)" />
    </svg>
  );
}

function StateBody({ art, title, description, children, role }: { art: ReactNode; title: string; description?: string; children?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role} className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-6 text-center">
      {art}
      <div className="flex flex-col gap-1.5">
        <span className="text-[22px] font-extrabold leading-[30px] text-iz-ink">{title}</span>
        {description && <span className="text-[14px] leading-[21px] text-iz-muted">{description}</span>}
      </div>
      {children && <div className="mt-2 flex w-full flex-col items-center gap-1">{children}</div>}
    </div>
  );
}

/** Nothing to show yet ("Hali safar yo'q"); fills a Sheet body. */
export function StateEmpty({
  title,
  description,
  actionLabel,
  onAction,
  art,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  art?: ReactNode;
}) {
  return (
    <StateBody art={art ?? <EmptyArt />} title={title} description={description}>
      {actionLabel && onAction && <PrimaryButton onClick={onAction}>{actionLabel}</PrimaryButton>}
    </StateBody>
  );
}

/** Loading failed: retry, and optionally write to support. */
export function StateError({
  title,
  description,
  onRetry,
  onHelp,
  retrying,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  onHelp?: () => void;
  retrying?: boolean;
}) {
  const { t } = useT();
  return (
    <StateBody
      role="alert"
      art={
        <span className="flex h-[88px] w-[88px] items-center justify-center rounded-[30px] bg-iz-warn-soft text-iz-warn">
          <Icon name="alert" size={40} />
        </span>
      }
      title={title ?? t("state.error.title")}
      description={description ?? t("state.error.desc")}
    >
      {onRetry && (
        <PrimaryButton icon="refresh" loading={retrying} onClick={onRetry}>
          {t("common.retry")}
        </PrimaryButton>
      )}
      {onHelp && <TextButton onClick={onHelp}>{t("state.error.help")}</TextButton>}
    </StateBody>
  );
}

function SkeletonCard({ faded, w1, w2 }: { faded?: boolean; w1: string; w2: string }) {
  return (
    <div className={cn("flex flex-col gap-3.5 rounded-iz-card border border-iz-skeleton p-3.5", faded && "opacity-60")}>
      <div className="flex items-center gap-3.5">
        <span className="h-[62px] w-[54px] shrink-0 rounded-2xl bg-iz-skeleton" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="h-3 rounded-md bg-iz-skeleton" style={{ width: w1 }} />
          <span className="h-4 rounded-lg bg-iz-skeleton-strong" style={{ width: w2 }} />
        </span>
        <span className="h-4 w-16 rounded-lg bg-iz-skeleton-strong" />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-full bg-iz-skeleton" />
        <span className="h-3 w-[90px] rounded-md bg-iz-skeleton" />
      </div>
    </div>
  );
}

/** Skeleton list (design: StateLoading). Announced once as "loading". */
export function StateLoading({ rows = 3 }: { rows?: number }) {
  const { t } = useT();
  const widths: [string, string][] = [
    ["60%", "40%"],
    ["55%", "45%"],
    ["50%", "35%"],
  ];
  return (
    <div aria-busy="true" aria-label={t("state.loading")} role="status" className="flex animate-pulse flex-col gap-3">
      <span className="h-3 w-24 rounded-md bg-iz-skeleton" />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonCard key={i} faded={i === rows - 1 && rows > 1} w1={widths[i % 3][0]} w2={widths[i % 3][1]} />
      ))}
    </div>
  );
}

/** Dark "Internet yo'q" banner floating at the top of the screen. */
export function OfflineBanner({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3.5 rounded-iz-card bg-[#0b1524] py-3.5 pl-4 pr-3.5 shadow-[0_10px_30px_var(--iz-shadow-strong)]",
        className
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-warn-tile text-iz-warn-strong">
        <Icon name="wifiOff" size={22} strokeWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-extrabold text-white">{t("state.offline.banner")}</span>
        <span className="text-[13px] text-[#9fb0c3]">{t("state.offline.bannerDesc")}</span>
      </span>
    </div>
  );
}

/**
 * No connection (design: StateOffline): banner on top, sheet at the bottom
 * with "Qayta urinish". Covers its positioned parent.
 */
export function StateOffline({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  const { t } = useT();
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-between overflow-hidden bg-iz-map">
      <svg aria-hidden viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-50">
        <g stroke="var(--iz-map-road)" strokeLinecap="round" fill="none">
          <path d="M-20 140 L410 96" strokeWidth="18" />
          <path d="M-20 300 L410 280" strokeWidth="22" />
          <path d="M96 -20 L122 864" strokeWidth="18" />
          <path d="M246 -20 L222 864" strokeWidth="22" />
        </g>
      </svg>
      <OfflineBanner className="relative mx-5 mt-[calc(var(--safe-top)+12px)]" />
      <div className="relative flex flex-col items-center gap-4 rounded-t-iz-sheet bg-iz-sheet px-7 pb-[max(var(--safe-bottom),24px)] pt-7 text-center shadow-[0_-10px_40px_var(--iz-shadow)]">
        <span className="flex h-[88px] w-[88px] items-center justify-center rounded-[30px] bg-iz-field text-iz-ink">
          <Icon name="wifiOff" size={40} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="text-[22px] font-extrabold leading-[30px] text-iz-ink">{t("state.offline.title")}</span>
          <span className="text-[14px] leading-[21px] text-iz-muted">{t("state.offline.desc")}</span>
        </div>
        <PrimaryButton className="mt-2" icon="refresh" loading={retrying} onClick={onRetry}>
          {t("common.retry")}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** navigator.onLine, live. */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
