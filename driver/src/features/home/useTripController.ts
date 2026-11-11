import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { TripSummary } from "@/api/types";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n/provider";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Owns the active-trip loop for any screen that shows it: polling, the step
 * button (advanceTrip → submitForReview → wait for approval), cancel, and the
 * post-trip summary. Every transition is decided by the adapter.
 */
export function useTripController(opts?: { onFinished?: () => void }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const trip = useQuery(() => api.getActiveTrip(), [], { pollMs: confirming ? null : 3000 });
  const onFinished = useRef(opts?.onFinished);
  onFinished.current = opts?.onFinished;
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const advance = useCallback(async () => {
    const current = trip.data;
    if (!current || confirming) return;
    const finishing = current.nextAction === "finish";
    setConfirming(true);
    try {
      const review = await api.advanceTrip(current.id);
      // Wait for the adapter to approve the step (applies it exactly once).
      for (let i = 0; i < 40; i++) {
        const r = await api.getReviewStatus(review.id).catch(() => null);
        if (r && r.status !== "pending") break;
        await sleep(300);
      }
      if (!alive.current) return;
      if (finishing) {
        const s = await api.getTripSummary(current.id).catch(() => null);
        trip.setData(null);
        if (s) setSummary(s);
        onFinished.current?.();
      } else {
        const next = await api.getActiveTrip();
        trip.setData(next);
      }
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      trip.reload(true);
    } finally {
      if (alive.current) setConfirming(false);
    }
  }, [trip, confirming, t]);

  const cancel = useCallback(
    async (reasonKey: string) => {
      const current = trip.data;
      if (!current) return false;
      setCancelBusy(true);
      try {
        await api.cancelTrip(current.id, reasonKey);
        toast(t("trip.cancelled"));
        trip.setData(null);
        onFinished.current?.();
        return true;
      } catch (e) {
        toast(errorMessage(e, t), "danger");
        return false;
      } finally {
        setCancelBusy(false);
      }
    },
    [trip, t]
  );

  return {
    trip: trip.data,
    loading: trip.loading && trip.data === undefined,
    error: trip.error,
    reload: trip.reload,
    setTrip: trip.setData,
    confirming,
    advance,
    cancel,
    cancelBusy,
    summary,
    dismissSummary: () => setSummary(null),
  };
}
