import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Heart, LocateFixed, MapPin } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address, SavedAddressInfo } from "@/api/types";
import { addressById } from "@/clientData/addresses";
import { FakeMap } from "@/components/FakeMap";
import { DragSheet, type SnapPoint } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { LowConnectionBanner } from "@/components/LowConnectionBanner";
import { useOrderStore } from "@/stores/orderStore";
import { useDemoStore } from "@/stores/demoStore";
import { useT } from "@/lib/i18n/provider";
import { formatKm } from "@/lib/format";
import { OrderSheet } from "@/features/order/OrderSheet";

export function HomeScreen() {
  const navigate = useNavigate();
  const { t, intlTag } = useT();
  const { draft, setField, reset } = useOrderStore();
  const [profileName, setProfileName] = useState("");
  const [eta, setEta] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedAddressInfo[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(false);
  const [savedReload, setSavedReload] = useState(0);
  const [snap, setSnap] = useState<SnapPoint>("collapsed");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const setFabPlacement = useDemoStore((s) => s.setFabPlacement);

  // The floating demo control would sit on the order flow; step it aside.
  useEffect(() => {
    setFabPlacement({ hidden: expanded });
  }, [expanded, setFabPlacement]);
  useEffect(() => () => setFabPlacement({ hidden: false, bottomPx: null }), [setFabPlacement]);

  useEffect(() => {
    api.getProfile().then((p) => setProfileName(p.name.split(" ")[0])).catch(() => {});
    api.getPickupEta().then((r) => setEta(r.minutes)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!draft.fromAddressId) return;
    setSavedLoading(true);
    setSavedError(false);
    api
      .getSavedAddresses(draft.fromAddressId)
      .then(setSaved)
      .catch(() => {
        setSaved([]);
        setSavedError(true);
      })
      .finally(() => setSavedLoading(false));
  }, [draft.fromAddressId, savedReload]);

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
        <Link
          to="/notifications"
          aria-label={t("home.notifications")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card/90 shadow-softer backdrop-blur-sm"
        >
          <Bell className="h-5 w-5 text-ink/80" />
        </Link>
      </div>

      <button
        aria-label={t("home.locateMe")}
        className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
        style={{ top: "calc(var(--safe-top) + 76px)" }}
      >
        <LocateFixed className="h-5 w-5 text-accent" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 top-0 [&>*]:pointer-events-auto" style={{ paddingTop: "calc(var(--safe-top) + 128px)" }}>
        <LowConnectionBanner />
      </div>

      <DragSheet
        snap={expanded ? "full" : snap}
        onSnapChange={(s) => {
          setSnap(s);
          if (s !== "full") setExpanded(false);
        }}
        ariaLabel={t("home.orderSheet")}
        handleLabel={t("sheet.handle")}
        onVisibleHeightChange={(px) => setFabPlacement({ bottomPx: px })}
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
              <p className="text-sm font-semibold text-ink" translate="no">IZGO Taksi</p>
            </div>

            <button
              onClick={() => openFlow()}
              className="flex w-full items-center justify-between rounded-2xl bg-ink/5 px-5 py-4 text-left"
            >
              <span className="text-sm font-normal text-ink/60">{t("home.whereTo")}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-bg">
                <MapPin className="h-4 w-4" />
              </span>
            </button>

            <p className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Heart className="h-4 w-4 text-ink/60" /> {t("order.savedAddresses")}
            </p>
            {savedLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : savedError ? (
              <button
                onClick={() => setSavedReload((n) => n + 1)}
                className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline"
              >
                {t("common.errorMessage")} — {t("common.retry")}
              </button>
            ) : saved.length === 0 ? (
              <p className="text-xs text-ink/60">{t("home.noSavedAddresses")}</p>
            ) : (
              <div className="space-y-2">
                {saved.map(({ address, distanceKm, etaMinutes }) => (
                  <button
                    key={address.id}
                    onClick={() => openFlow(address)}
                    className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3.5 text-left shadow-softer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{address.label}</p>
                      <p className="text-xs text-ink/60 tabular">
                        {formatKm(distanceKm, intlTag)} &middot; ~{etaMinutes} {t("order.minutesShort")}
                      </p>
                    </div>
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
