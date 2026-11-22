import { api } from "@/api/client";
import type { NotificationKind } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { relativeTime } from "@/lib/relative";
import { Bell, BellOff, Check, FileText, Megaphone, Trophy, Wallet } from "@/lib/icons";
import { Screen, HeaderButton } from "@/components/Screen";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

const ICON: Record<NotificationKind, { icon: typeof Bell; tile: string }> = {
  order: { icon: Bell, tile: "bg-brand-soft text-brand-ink" },
  bonus: { icon: Trophy, tile: "bg-star-soft text-ink" },
  wallet: { icon: Wallet, tile: "bg-raised text-ink" },
  docs: { icon: FileText, tile: "bg-raised text-ink" },
  news: { icon: Megaphone, tile: "bg-raised text-ink" },
};

// Server notifications may carry a title_key the app doesn't know yet: a generic title for the kind instead.
const GENERIC_TITLE = {
  order: "notif.generic.order",
  wallet: "notif.generic.wallet",
  docs: "notif.generic.docs",
  bonus: "notif.generic.bonus",
  news: "notif.generic.news",
} as const satisfies Record<NotificationKind, string>;

/** Bildirishnomalar (design v2): newest first, unread marked with a green dot; ✓ marks all read. */
export default function NotificationsScreen() {
  const { t } = useT();
  const list = useQuery(() => api.getNotifications(), []);
  const unread = list.data?.filter((n) => !n.read).length ?? 0;

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      list.reload(true);
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    }
  }

  return (
    <Screen
      back
      title={t("notif.title")}
      subtitle={unread > 0 ? t("notif.newCount", { n: unread }) : undefined}
      right={
        unread > 0 ? (
          <HeaderButton label={t("notif.markAll")} onClick={markAll}>
            <Check className="h-5 w-5 text-brand" />
          </HeaderButton>
        ) : undefined
      }
    >
      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={3} label={t("common.loading")} />
      ) : list.data.length === 0 ? (
        <EmptyState icon={BellOff} title={t("notif.empty")} />
      ) : (
        <ul className="flex flex-col">
          {list.data.map((n) => {
            const meta = ICON[n.kind];
            const Icon = meta.icon;
            return (
              <li key={n.id} className="flex gap-3.5 border-b border-line py-4 last:border-b-0">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-tile", meta.tile)} aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-15 font-extrabold text-ink">{isKey(n.titleKey) ? t(n.titleKey, n.params) : t(GENERIC_TITLE[n.kind])}</p>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand">
                        <span className="sr-only">{t("notif.unread")}</span>
                      </span>
                    )}
                  </div>
                  {isKey(n.bodyKey) && <p className="mt-0.5 text-sm leading-[20px] text-ink">{t(n.bodyKey, n.params)}</p>}
                  <p className="tabular mt-1 text-xs font-semibold text-muted">{relativeTime(n.createdAt, t)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
