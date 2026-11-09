import { useEffect, useState } from "react";
import { Bell, Wallet, Tag, Info } from "lucide-react";
import { api } from "@/api/client";
import type { NotificationItem } from "@/api/types";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { formatRelativeDay } from "@/lib/format";

const KIND_ICON: Record<NotificationItem["kind"], typeof Bell> = {
  order: Bell,
  wallet: Wallet,
  promo: Tag,
  system: Info,
};

type LoadState = "loading" | "error" | "ready";

export function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

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
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await api.markNotificationRead(id);
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="px-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Bildirishnomalar</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {state === "loading" && <SkeletonList count={4} />}
        {state === "error" && <ErrorState onRetry={load} />}
        {state === "ready" && items.length === 0 && (
          <EmptyState
            icon={<Bell className="h-7 w-7" />}
            title="Bildirishnomalar yo'q"
            description="Buyurtmalaringiz va hamyoningiz bo'yicha yangiliklar shu yerda ko'rinadi."
          />
        )}
        {state === "ready" && items.length > 0 && (
          <div className="space-y-2">
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind];
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="flex w-full items-start gap-3 rounded-2xl bg-card p-4 text-left shadow-softer"
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
                    <Icon className="h-4 w-4" />
                    {!n.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 text-xs text-ink/60">{n.body}</p>
                    <p className="mt-1 text-[11px] text-ink/60">{formatRelativeDay(n.createdAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
