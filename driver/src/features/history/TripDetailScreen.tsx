import { useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useT, isKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { formatAmount, formatDate, formatDuration, formatTime } from "@/lib/format";
import { Banknote, Check, CreditCard, Package, SearchX, Users, X } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, SectionLabel } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { Money } from "@/components/Money";
import { RouteLine } from "@/features/home/RouteLine";
import { MiniRouteMap } from "./MiniRouteMap";
import { cn } from "@/lib/cn";

export default function TripDetailScreen() {
  const { tripId = "" } = useParams();
  const { t } = useT();
  const q = useQuery(() => api.getTripDetail(tripId), [tripId]);
  const d = q.data;
  const notFound = (q.error as { code?: string } | null)?.code === "TRIP_NOT_FOUND";

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("detail.title")} back="/history" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {notFound ? (
          <EmptyState icon={SearchX} title={t("detail.notFound")} />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        ) : !d ? (
          <div className="space-y-3" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-36 rounded-card" />
            <Skeleton className="h-28 rounded-card" />
            <Skeleton className="h-40 rounded-card" />
          </div>
        ) : (
          <div className="animate-fade-up space-y-4">
            <MiniRouteMap pickup={d.pickup} dropoff={d.dropoff} label={`${t("detail.route")}: ${d.from.name} – ${d.to.name}`} />

            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between text-sm text-muted">
                <span className="tabular">
                  {formatDate(d.createdAt, t)}, {formatTime(d.createdAt)}
                </span>
                <span className="tabular">{t("detail.distance", { km: d.distanceKm, duration: formatDuration(d.durationMin, t) })}</span>
              </div>
              <RouteLine pickup={d.pickup} dropoff={d.dropoff} pickupLabel={t("offer.pickup")} dropoffLabel={t("offer.dropoff")} size="md" />
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-button bg-raised px-3 text-ink">
                  {d.payment === "cash" ? <Banknote className="h-4 w-4 text-muted" /> : <CreditCard className="h-4 w-4 text-muted" />}
                  {d.payment === "cash" ? t("pay.cash") : t("pay.card")}
                </span>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-button bg-raised px-3 text-ink">
                  {d.kind === "delivery" ? <Package className="h-4 w-4 text-muted" /> : <Users className="h-4 w-4 text-muted" />}
                  {d.kind === "delivery" && d.cargo && isKey(d.cargo.labelKey)
                    ? t("offer.cargo", { label: t(d.cargo.labelKey), kg: d.cargo.weightKg })
                    : t("offer.passengers", { n: d.passengers ?? 1 })}
                </span>
              </div>
            </Card>

            <section aria-labelledby="bd">
              <SectionLabel id="bd">{t("detail.breakdown")}</SectionLabel>
              <Card className="p-4">
                {d.status === "cancelled" ? (
                  <p className="text-base text-ink">
                    {t("detail.cancelReason")}: {d.cancelReasonKey && isKey(d.cancelReasonKey) ? t(d.cancelReasonKey) : "—"}
                  </p>
                ) : (
                  <dl className="space-y-3 text-base">
                    <Row label={t("detail.base")} value={formatAmount(d.breakdown.base)} />
                    <Row label={t("detail.commission", { pct: d.breakdown.commissionPct })} value={formatAmount(-d.breakdown.commission)} />
                    {d.breakdown.bonusDiscount > 0 && <Row label={t("detail.bonusDiscount")} value={formatAmount(d.breakdown.bonusDiscount, { signed: true })} tone="gold" />}
                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <dt className="font-bold text-ink">{t("detail.net")}</dt>
                      <dd>
                        <Money value={d.breakdown.net} className="text-2xl font-bold text-gold" />
                      </dd>
                    </div>
                  </dl>
                )}
              </Card>
            </section>

            <section aria-labelledby="tl">
              <SectionLabel id="tl">{t("detail.timeline")}</SectionLabel>
              <Card className="p-4">
                <ol className="space-y-4">
                  {d.timeline.map((e, i) => {
                    const cancelled = e.stage === "cancelled";
                    return (
                      <li key={i} className="relative flex items-center gap-3">
                        {i < d.timeline.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-7 h-4 w-0.5 bg-line" />}
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", cancelled ? "bg-danger/15 text-danger" : "bg-yellow text-on-yellow")}>
                          {cancelled ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        </span>
                        <span className="flex-1 text-base text-ink">{t(`detail.event.${e.stage}`)}</span>
                        <span className="tabular text-sm text-muted">{formatTime(e.at)}</span>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </section>

            <section aria-labelledby="ps">
              <SectionLabel id="ps">{t("detail.passenger")}</SectionLabel>
              <Card className="flex items-center gap-3 p-4">
                <Avatar seed={d.passenger.avatarSeed} name={d.passenger.name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-ink">{d.passenger.name}</p>
                  <p className="tabular text-sm text-muted">{d.passenger.phoneMasked}</p>
                </div>
              </Card>
              <Card className="mt-3 flex items-center justify-between p-4">
                <span className="text-base text-ink">{t("detail.ratingGiven")}</span>
                {d.ratingReceived != null ? <Stars value={d.ratingReceived} /> : <span className="text-sm text-muted">{t("detail.noRating")}</span>}
              </Card>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("tabular", tone === "gold" ? "text-gold" : "text-ink")}>{value}</dd>
    </div>
  );
}
