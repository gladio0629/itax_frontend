import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { ActiveTrip, TripSummary } from "@/api/types";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n/provider";

/**
 * Owns the active-trip loop for any screen that shows it: polling, the step
 * button (submitForReview via advanceTrip), cancel, and the post-trip
 * summary. All state transitions are decided by the adapter.
 */
export function useTripController(opts?: { onFinished?: () => void }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const lastTrip = useRef<ActiveTrip | null>(null);
  const trip = useQuery(() => api.getActiveTrip(), [], { pollMs: confirming ? 400 : 3000 });
  const onFinished = useRef(opts?.onFinished);
  onFinished.current = opts?.onFinished;

  // Detect "the trip I was confirming has finished" → fetch its summary.
  useEffect(() => {
    const current = trip.data;
    const prev = lastTrip.current;
    if (current === undefined) return;
    if (prev && confirming) {
      if (current === null && prev.nextAction === "finish") {
        setConfirming(false);
        api
          .getTripSummary(prev.id)
          .then((s) => {
            setSummary(s);
            onFinished.current?.();
          })
          .catch(() => onFinished.current?.());
      } else if (current && (current.stage !== prev.stage || !current.pendingReviewId)) {
        setConfirming(false);
      }
    }
    if (!confirming || current) lastTrip.current = current;
  }, [trip.data, confirming]);

  const advance = useCallback(async () => {
    const current = trip.data;
    if (!current) return;
    lastTrip.current = current;
    setConfirming(true);
    try {
      await api.advanceTrip(current.id);
      trip.reload(true);
    } catch (e) {
      setConfirming(false);
      toast(errorMessage(e, t), "danger");
    }
  }, [trip, t]);

  const cancel = useCallback(
    async (reasonKey: string) => {
      const current = trip.data;
      if (!current) return false;
      setCancelBusy(true);
      try {
        await api.cancelTrip(current.id, reasonKey);
        toast(t("trip.cancelled"));
        lastTrip.current = null;
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
