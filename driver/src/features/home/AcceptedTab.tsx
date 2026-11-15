import { useState } from "react";
import { api } from "@/api/client";
import type { AcceptedPage, Booking, TripSummary } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { waitReview } from "@/lib/waitReview";
import { formatDate } from "@/lib/format";
import { ArrowRight, Armchair, ListChecks } from "@/lib/icons";
import { PullList } from "@/components/PullList";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { BookingCard } from "./BookingCard";
import { CancelSheet } from "./CancelSheet";
import { dayText } from "./whenText";

type Q = { data: AcceptedPage | undefined; error: unknown; loading: boolean; reload: (silent?: boolean) => Promise<void> | void };

/** Qabul qilinganlar: grouped by trip day, then direction (one car trip), each passenger with their own steps. */
export function AcceptedTab({ accepted, onChanged, onSummary, onShowNew }: { accepted: Q; onChanged: () => void; onSummary: (s: TripSummary) => void; onShowNew: () => void }) {
  const { t } = useT();
  const page = accepted.data;
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  async function advance(b: Booking) {
    setConfirming(b.id);
    try {
      const finishing = b.nextAction === "finish";
      const done = await waitReview(await api.advanceBooking(b.id));
      if (finishing && done.status === "approved") {
        const s = await api.getTripSummary(b.id).catch(() => null);
        if (s) onSummary(s);
      }
      await accepted.reload(true);
      onChanged();
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      accepted.reload(true);
    } finally {
      setConfirming(null);
    }
  }

  async function cancel(reasonKey: string) {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      await api.cancelBooking(cancelling.id, reasonKey);
      setCancelling(null);
      toast(t("trip.cancelled"));
      await accepted.reload(true);
      onChanged();
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <>
      <PullList onRefresh={() => accepted.reload(true)} pullLabel={t("feed.pull")} releaseLabel={t("feed.release")}>
        <div className="px-4 pb-6 pt-3">
          {accepted.error && !page ? (
            <ErrorState error={accepted.error} onRetry={() => accepted.reload()} />
          ) : !page ? (
            <div role="status" aria-label={t("common.loading")} className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-80 rounded-card" />
            </div>
          ) : page.days.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={t("accepted.empty")}
              description={t("accepted.emptyDesc")}
              action={
                <Button fullWidth onClick={onShowNew}>
                  {t("feed.tabNew")}
                </Button>
              }
            />
          ) : (
            page.days.map((day) => (
              <section key={day.date} aria-labelledby={day.undated ? undefined : `day-${day.date}`} aria-label={day.undated ? t("feed.tabAccepted") : undefined} className="mb-6">
                {!day.undated && (
                  <h2 id={`day-${day.date}`} className="mb-2 px-1 text-lg font-bold text-ink">
                    {day.dayOffset <= 1 ? `${dayText(day, t)}, ${formatDate(day.dayStart, t)}` : formatDate(day.dayStart, t)}
                  </h2>
                )}
                {day.trips.map((trip) => (
                  <div key={trip.direction.id} className="mb-4">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <h3 className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-ink">
                        {trip.direction.from.name}
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                        <span className="sr-only">–</span>
                        {trip.direction.to.name}
                      </h3>
                      {trip.seats.total > 0 && (
                        <span className="tabular flex shrink-0 items-center gap-1.5 text-sm text-muted">
                          <Armchair className="h-4 w-4" />
                          {t("accepted.seatsUsed", { used: trip.seats.used, total: trip.seats.total })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {trip.bookings.map((b) => (
                        <BookingCard key={b.id} booking={b} confirming={confirming === b.id} onAction={() => advance(b)} onCancel={() => setCancelling(b)} />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
      </PullList>
      <CancelSheet open={!!cancelling} busy={cancelBusy} onClose={() => setCancelling(null)} onConfirm={cancel} />
    </>
  );
}
