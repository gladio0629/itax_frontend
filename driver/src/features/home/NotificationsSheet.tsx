import { Sheet } from "@/components/Sheet";
import { useT, isKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { api } from "@/api/client";
import { BellOff, FileText, Gift, Megaphone, Receipt, ListChecks } from "@/lib/icons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { TILE } from "@/components/SettingsRow";
import { relativeTime } from "@/lib/relative";
import type { NotificationKind } from "@/api/types";
import { cn } from "@/lib/cn";

const ICON: Record<NotificationKind, { icon: typeof Gift; tile: keyof typeof TILE }> = {
  order: { icon: ListChecks, tile: "blue" },
  wallet: { icon: Receipt, tile: "green" },
  docs: { icon: FileText, tile: "slate" },
  bonus: { icon: Gift, tile: "yellow" },
  news: { icon: Megaphone, tile: "purple" },
};

// Server notifications carry a title_key the app may not know yet: show a
// generic title for the kind instead of the raw key.
const GENERIC_TITLE = {
  order: "notif.generic.order",
  wallet: "notif.generic.wallet",
  docs: "notif.generic.docs",
  bonus: "notif.generic.bonus",
  news: "notif.generic.news",
} as const satisfies Record<NotificationKind, string>;

export function NotificationsSheet({ open, onClose, onRead }: { open: boolean; onClose: () => void; onRead: () => void }) {
  const { t } = useT();
  const list = useQuery(() => api.getNotifications(), [open]);
  const unread = list.data?.some((n) => !n.read);

  async function markAll() {
    await api.markAllNotificationsRead();
    list.reload(true);
    onRead();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("notif.title")}>
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={3} label={t("common.loading")} />
      ) : list.data.length === 0 ? (
        <EmptyState icon={BellOff} title={t("notif.empty")} />
      ) : (
        <>
          <ul className="space-y-2">
            {list.data.map((n) => {
              const meta = ICON[n.kind];
              const Icon = meta.icon;
              return (
                <li key={n.id} className={cn("flex gap-3 rounded-card p-3", n.read ? "bg-transparent" : "bg-raised")}>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-button", TILE[meta.tile])}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-bold text-ink">{isKey(n.titleKey) ? t(n.titleKey, n.params) : t(GENERIC_TITLE[n.kind])}</p>
                      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="•" />}
                    </div>
                    {isKey(n.bodyKey) && <p className="text-sm text-muted">{t(n.bodyKey, n.params)}</p>}
                    <p className="tabular mt-1 text-xs text-muted">{relativeTime(n.createdAt, t)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {unread && (
            <button type="button" onClick={markAll} className="press mt-3 flex h-12 w-full items-center justify-center rounded-button text-sm font-medium text-brand-ink">
              {t("notif.markAll")}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
