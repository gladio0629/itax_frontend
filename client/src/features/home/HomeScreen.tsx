import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Clock3, LocateFixed, MapPin } from "lucide-react";
import { api } from "@/api/client";
import type { Address } from "@/api/types";
import { addressById } from "@/clientData/addresses";
import { FakeMap } from "@/components/FakeMap";
import { DragSheet, type SnapPoint } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { LowConnectionBanner } from "@/components/LowConnectionBanner";
import { useOrderStore } from "@/stores/orderStore";
import { useT } from "@/lib/i18n/provider";
import { OrderSheet } from "@/features/order/OrderSheet";

export function HomeScreen() {
  const navigate = useNavigate();
  const { t } = useT();
  const { draft, setField, reset } = useOrderStore();
  const [profileName, setProfileName] = useState("");
  const [eta, setEta] = useState<number | null>(null);
  const [recent, setRecent] = useState<Address[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [snap, setSnap] = useState<SnapPoint>("collapsed");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    api.getProfile().then((p) => setProfileName(p.name.split(" ")[0])).catch(() => {});
    api.getPickupEta().then((r) => setEta(r.minutes)).catch(() => {});
    api
      .getRecentAddresses()
      .then(setRecent)
      .catch(() => setRecent([]))
      .finally(() => setRecentLoading(false));
  }, []);

  const fromAddress = addressById(draft.fromAddressId) ?? null;
  const toAddress = addressById(draft.toAddressId) ?? null;

  function openFlow(presetTo?: Address) {
    if (presetTo) setField("toAddressId", presetTo.id);
    setExpanded(true);
    setSnap("full");
  }

  function collapseFlow() {
    setExpanded(false);
    setSnap("collapsed");
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const order = await api.createOrder({
        serviceType: draft.serviceType,
        fromAddressId: draft.fromAddressId,
        toAddressId: draft.toAddressId,
        mode: draft.mode,
        seatIds: draft.seatIds,
        cargo: draft.serviceType === "delivery" ? draft.cargo : undefined,
        paymentMethod: draft.paymentMethod,
        timing: draft.timing,
        promoCode: draft.promoCode || undefined,
      });
      navigate(`/order/track/${order.id}`);
      reset();
      collapseFlow();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-full bg-bg">
      <FakeMap pickupLabel={fromAddress ? `${t("order.pickupCaption")}: ${fromAddress.label}` : undefined} etaMinutes={eta ?? undefined} className="absolute inset-0" />

      <div className="relative flex items-center justify-between pl-16 pr-5" style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}>
        <div className="rounded-2xl bg-card/90 px-3 py-2 shadow-softer backdrop-blur-sm">
          <p className="text-[11px] text-ink/60">{t("home.greeting")}{profileName ? "," : ""}</p>
          <p className="text-sm font-semibold text-ink">{profileName || t("home.guest")} 👋</p>
        </div>
        <button
          onClick={() => navigate("/notifications")}
          aria-label={t("home.notifications")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card/90 shadow-softer backdrop-blur-sm"
        >
          <Bell className="h-5 w-5 text-ink/80" />
        </button>
      </div>

      <button
        aria-label={t("home.locateMe")}
        className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
        style={{ top: "calc(var(--safe-top) + 72px)" }}
      >
        <LocateFixed className="h-5 w-5 text-accent" />
      </button>

      <div className="absolute inset-x-0 top-0" style={{ paddingTop: "calc(var(--safe-top) + 64px)" }}>
        <LowConnectionBanner />
      </div>

      <DragSheet
        snap={expanded ? "full" : snap}
        onSnapChange={(s) => {
          setSnap(s);
          if (s !== "full") setExpanded(false);
        }}
        heightsVh={{ collapsed: 30, half: 58, full: 92 }}
        ariaLabel={t("home.orderSheet")}
      >
        {expanded ? (
          <OrderSheet
            draft={draft}
            setField={setField}
            addresses={{ from: fromAddress, to: toAddress }}
            onAddressChange={(which, addr) => setField(which === "from" ? "fromAddressId" : "toAddressId", addr.id)}
            onSubmit={submit}
            submitting={submitting}
            submitError={submitError}
            onClose={collapseFlow}
          />
        ) : (
          <div className="px-5 pb-4">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-yellow text-on-yellow">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-semibold text-ink">IZGO Taksi</p>
            </div>

            <button
              onClick={() => openFlow()}
              className="flex w-full items-center justify-between rounded-2xl bg-ink/5 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium text-ink/60">{t("home.whereTo")}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-bg">
                <MapPin className="h-4 w-4" />
              </span>
            </button>

            <p className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Clock3 className="h-4 w-4 text-ink/60" /> {t("home.recentPlaces")}
            </p>
            {recentLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-xs text-ink/60">{t("home.noRecentPlaces")}</p>
            ) : (
              <div className="space-y-2">
                {recent.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => openFlow(addr)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left shadow-softer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <p className="truncate text-sm font-semibold text-ink">{addr.label}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DragSheet>
    </div>
  );
}
