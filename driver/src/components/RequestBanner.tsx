import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { RequestAlert } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { formatAmount } from "@/lib/format";
import { notifyInBackground } from "@/lib/systemNotify";
import { useFeedSignal } from "@/stores/feedSignal";
import { useToast } from "@/lib/toast";
import { BellRing, X } from "@/lib/icons";

const POLL_MS = 3000;
const SHOW_MS = 7000;

/**
 * Consumes the adapter's new-request alerts (which also keeps the mock market
 * ticking on any screen): an in-app banner at the top, and a system
 * notification when the app is in the background. Content stays minimal —
 * route, seats, price; never names or phone numbers. Muted alerts never arrive.
 */
export function RequestBanner() {
  const { t } = useT();
  const navigate = useNavigate();
  const bump = useFeedSignal((s) => s.bump);
  const [alert, setAlert] = useState<RequestAlert | null>(null);
  // Toasts share the top slot: the banner sits below any that are showing.
  const toasts = useToast((s) => s.items.length);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const list = await api.takeRequestAlerts().catch(() => []);
      if (!alive) return;
      if (list.length) {
        const a = list[0];
        setAlert(a);
        bump();
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setAlert(null), SHOW_MS);
        notifyInBackground(t("banner.request.title"), lineFor(a), a.id, () => open(a));
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detailFor(a: RequestAlert) {
    const what = a.kind === "delivery" ? t("feed.kind.cargo") : a.wholeCar ? t("feed.wholeCar") : t("feed.seats", { n: a.seats });
    return `${what} · ${formatAmount(a.price)} ${t("common.som")}`;
  }
  const lineFor = (a: RequestAlert) => `${a.from} → ${a.to} · ${detailFor(a)}`;

  function open(a: RequestAlert) {
    setAlert(null);
    const date = a.dayOffset === 0 ? "today" : a.dayOffset === 1 ? "tomorrow" : a.date;
    const p = new URLSearchParams({ request: a.requestId });
    if (date !== "today") p.set("date", date);
    navigate(`/?${p.toString()}`);
  }

  return (
    <div className="pointer-events-none absolute inset-x-3 z-[55]" style={{ top: `calc(var(--safe-top) + ${8 + toasts * 68}px)`, transition: "top 200ms" }} role="status" aria-live="polite">
      {alert && (
        <div key={alert.id} className="pointer-events-auto flex animate-fade-up items-stretch overflow-hidden rounded-card bg-surface shadow-2 ring-1 ring-yellow/40">
          <button type="button" onClick={() => open(alert)} className="press focus-inset flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-yellow text-on-yellow">
              <BellRing className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{t("banner.request.title")}</span>
              <span className="block truncate text-sm font-medium text-ink">
                {alert.from} → {alert.to}
              </span>
              <span className="tabular block truncate text-sm text-muted">{detailFor(alert)}</span>
            </span>
          </button>
          <button type="button" onClick={() => setAlert(null)} aria-label={t("common.close")} className="press flex w-12 shrink-0 items-center justify-center text-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
