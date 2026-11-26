import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { NotificationItem } from "@/api/types";
import { formatRelativeDay } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { uz, type TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, Screen, StateEmpty, StateError, StateLoading, type IconName } from "@/ui";

const KIND_ICON: Record<NotificationItem["kind"], IconName> = {
  order: "car",
  wallet: "card",
  promo: "tag",
  system: "info",
};

type LoadState = "loading" | "error" | "ready";

/** The notifications inbox (current app, design v2 style); a tap marks one read. */
export function NotificationsScreen() {
  const { t, intlTag } = useT();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  // Server notifications arrive as translation keys + params. A key this
  // app doesn't know yet shows a generic title for its kind (never the raw key).
  const known = (key: string | undefined): key is TranslationKey => !!key && key in uz;
  const titleOf = (n: NotificationItem) =>
    n.titleKey === undefined ? n.title : known(n.titleKey) ? t(n.titleKey, n.params) : t(`notifications.generic.${n.kind}`);
  const bodyOf = (n: NotificationItem) =>
    n.titleKey === undefined ? n.body : known(n.bodyKey) ? t(n.bodyKey, n.params) : "";

  function load() {
    setState("loading");
    api
      .getNotifications()
      .then((res) => {
        setItems(res);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  async function markRead(id: string) {
    const was = items.find((n) => n.id === id)?.read ?? true;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    // Not saved: it shows as unread again (it is, on the server).
    await api.markNotificationRead(id).catch(() => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: was } : n))));
  }

  return (
    <Screen title={t("home.notifications")} bodyClassName="gap-0 pt-4">
      {state === "loading" && <StateLoading rows={4} />}
      {state === "error" && <StateError onRetry={load} />}
      {state === "ready" && items.length === 0 && <StateEmpty title={t("inbox.emptyTitle")} description={t("inbox.emptyDesc")} />}
      {state === "ready" &&
        items.map((n, i) => (
          <button
            key={n.id}
            type="button"
            onClick={() => markRead(n.id)}
            className={cn("flex w-full shrink-0 items-start gap-3.5 py-3.5 text-left active:opacity-70", i < items.length - 1 && "border-b border-iz-border")}
          >
            <span aria-hidden className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-field text-iz-ink">
              <Icon name={KIND_ICON[n.kind]} />
              {!n.read && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-iz-sheet bg-iz-danger" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn("text-[15px] text-iz-ink", n.read ? "font-bold" : "font-extrabold")}>
                {titleOf(n)}
                {!n.read && <span className="sr-only"> · {t("inbox.unread")}</span>}
              </span>
              {bodyOf(n) && <span className="text-[13px] leading-[19px] text-iz-muted">{bodyOf(n)}</span>}
              <span className="text-[12px] text-iz-muted">{formatRelativeDay(n.createdAt, intlTag)}</span>
            </span>
          </button>
        ))}
    </Screen>
  );
}
