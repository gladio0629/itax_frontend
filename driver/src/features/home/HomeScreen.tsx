import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Offer } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { Bell, Power } from "@/lib/icons";
import { DebtBanner } from "@/features/wallet/DebtBanner";
import { Avatar } from "@/components/Avatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Skeleton } from "@/components/Skeleton";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { DriverMap } from "./DriverMap";
import { OfferCard } from "./OfferCard";
import { ActiveTripCard } from "./ActiveTripCard";
import { TripSummaryCard } from "./TripSummaryCard";
import { CancelSheet } from "./CancelSheet";
import { NotificationsSheet } from "./NotificationsSheet";
import { useTripController } from "./useTripController";

export default function HomeScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const profile = useQuery(() => api.getProfile(), []);
  const summary = useQuery(() => api.getHomeSummary(), [], { pollMs: 10000 });
  const tc = useTripController({ onFinished: () => summary.reload(true) });
  const [offer, setOffer] = useState<Offer | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const seenOffer = useRef<string | null>(null);

  const s = summary.data;
  const online = !!s?.online;
  const blocked = s ? !s.canAcceptOrders : false;
  const busyWithTrip = !!tc.trip || !!tc.summary;

  // Poll for an incoming order only while online and free.
  const pollOffers = online && !busyWithTrip && !offer && !blocked;
  useEffect(() => {
    if (!pollOffers) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const o = await api.getCurrentOffer().catch(() => null);
      if (!alive) return;
      if (o) setOffer(o);
      else timer = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pollOffers]);

  // Haptic nudge when a new order lands (if the device supports it).
  useEffect(() => {
    if (offer && seenOffer.current !== offer.id) {
      seenOffer.current = offer.id;
      navigator.vibrate?.([60, 40, 60]);
    }
  }, [offer]);

  const toggleOnline = useCallback(async () => {
    if (!s) return;
    setToggling(true);
    try {
      const next = await api.setOnline(!s.online);
      summary.setData(next);
      if (!next.online) setOffer(null);
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setToggling(false);
    }
  }, [s, summary, t]);

  async function accept() {
    if (!offer) return;
    setAccepting(true);
    try {
      const trip = await api.acceptOffer(offer.id);
      setOffer(null);
      tc.setTrip(trip);
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      setOffer(null);
    } finally {
      setAccepting(false);
    }
  }

  function skip() {
    if (!offer) return;
    const id = offer.id;
    setOffer(null);
    api.declineOffer(id).catch(() => {});
  }

  function expire() {
    setOffer(null);
    toast(t("offer.expired"));
  }

  return (
    <div className="relative h-full overflow-hidden">
      <h1 className="sr-only">{t("home.title")}</h1>
      <DriverMap online={online} label={t("home.mapLabel")} />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          aria-label={t("home.openProfile")}
          className="press relative flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-2"
        >
          {profile.data ? <Avatar seed={profile.data.avatarSeed} name={profile.data.name} size={44} /> : <Skeleton className="h-11 w-11 rounded-full" />}
          <span
            aria-hidden="true"
            className={cn("absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-surface", online ? "bg-yellow" : "bg-ink/40")}
          />
        </button>
        <DemoBadge />
        <button
          type="button"
          onClick={() => setNotifOpen(true)}
          aria-label={s?.unreadNotifications ? t("home.notificationsUnread", { n: s.unreadNotifications }) : t("home.notifications")}
          className="press relative flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink shadow-2"
        >
          <Bell className="h-6 w-6" />
          {!!s?.unreadNotifications && (
            <span className="tabular absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-fill px-1 text-xs font-bold text-white ring-2 ring-surface">
              {s.unreadNotifications}
            </span>
          )}
        </button>
      </div>

      {/* Bottom zone (thumb reach). The inner mt-auto pins short content to the
          bottom while a tall card still scrolls from its top (justify-end
          would clip it). Top padding keeps the card clear of the top bar. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex max-h-full flex-col overflow-y-auto overscroll-contain p-4 no-scrollbar"
        style={{ paddingTop: "calc(var(--safe-top) + 68px)" }}
      >
        <div className="pointer-events-auto mt-auto flex flex-col gap-3">
        {tc.summary ? (
          <TripSummaryCard summary={tc.summary} onDismiss={tc.dismissSummary} />
        ) : tc.trip ? (
          <ActiveTripCard trip={tc.trip} confirming={tc.confirming} onAction={tc.advance} onCancel={() => setCancelOpen(true)} />
        ) : offer ? (
          <OfferCard key={offer.id} offer={offer} accepting={accepting} blocked={blocked} onAccept={accept} onSkip={skip} onExpire={expire} />
        ) : (
          <>
            {s && <DebtBanner level={s.debt.level} onTopup={() => navigate("/wallet/topup")} className="shadow-2" />}
            {summary.error && !s ? (
              <div role="alert" className="flex items-center gap-3 rounded-card bg-surface p-3 pl-4 shadow-2">
                <p className="min-w-0 flex-1 text-sm text-ink">{t("error.loadTitle")}</p>
                <Button variant="secondary" onClick={() => summary.reload()}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : (
            <OnlineToggle online={online} loading={toggling || !s} onToggle={toggleOnline} hint={!s ? "" : !online ? t("home.offlineHint") : blocked ? t("home.blockedHint") : t("home.waiting")} />
            )}
          </>
        )}
        </div>
      </div>

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} onRead={() => summary.reload(true)} />
      <CancelSheet
        open={cancelOpen}
        busy={tc.cancelBusy}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          if (await tc.cancel(reason)) setCancelOpen(false);
        }}
      />
    </div>
  );
}

/** The signature control: grey pill offline, pulsing yellow pill online. */
function OnlineToggle({ online, loading, onToggle, hint }: { online: boolean; loading: boolean; onToggle: () => void; hint: string }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center gap-3">
      {hint && (
        <p key={hint} className="animate-fade-in rounded-button bg-surface/90 px-4 py-2 text-sm text-ink shadow-1 backdrop-blur" role="status">
          {hint}
        </p>
      )}
      <div className="relative w-full">
      {online && <span className="absolute inset-0 animate-halo rounded-full bg-yellow" aria-hidden="true" />}
      <button
        type="button"
        role="switch"
        aria-checked={online}
        aria-label={online ? t("home.goOffline") : t("home.goOnline")}
        onClick={onToggle}
        disabled={loading}
        className="press relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-full shadow-2 disabled:cursor-wait"
      >
        {/* Two colour layers cross-fade so the morph is opacity-only. */}
        <span className={cn("absolute inset-0 bg-surface ring-1 ring-inset ring-line transition-opacity duration-[280ms]", online ? "opacity-0" : "opacity-100")} />
        <span className={cn("absolute inset-0 bg-yellow transition-opacity duration-[280ms]", online ? "opacity-100" : "opacity-0")} />
        <span className={cn("relative flex h-10 w-10 items-center justify-center rounded-full", online ? "bg-on-yellow text-yellow" : "bg-ink/10 text-ink")}>
          {loading ? <Spinner className="h-5 w-5" /> : <Power className="h-5 w-5" />}
        </span>
        <span className={cn("relative text-xl font-bold", online ? "text-on-yellow" : "text-ink")}>{online ? t("home.online") : t("home.offline")}</span>
      </button>
      </div>
    </div>
  );
}
