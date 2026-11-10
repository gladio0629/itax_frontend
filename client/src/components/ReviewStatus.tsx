import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Send, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";

export type ReviewStatusValue = "pending" | "approved" | "rejected";

type Props = {
  reviewId: string;
  title?: string;
  description?: string;
  onApproved?: () => void;
  onRejected?: () => void;
};

const STEPS = [
  { key: "submitted", labelKey: "review.submitted", icon: Send },
  { key: "reviewing", labelKey: "review.reviewing", icon: Clock3 },
  { key: "done", labelKey: "review.done", icon: Check },
] as const;

/**
 * Shared "submitted for review" state used everywhere a demo action needs
 * verification (OTP, card linking, wallet top-up, driver documents, admin
 * 2FA, two-person approval, support tickets). Polls api.getReviewStatus()
 * until the mock server auto-resolves it (2-4s), then shows a short
 * celebratory confirmation before calling back.
 */
export function ReviewStatus({ reviewId, title, description, onApproved, onRejected }: Props) {
  const { t } = useT();
  const [status, setStatus] = useState<ReviewStatusValue>("pending");
  const [settled, setSettled] = useState(false);
  const calledBack = useRef(false);
  const onApprovedRef = useRef(onApproved);
  const onRejectedRef = useRef(onRejected);
  useEffect(() => {
    onApprovedRef.current = onApproved;
    onRejectedRef.current = onRejected;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.getReviewStatus(reviewId);
        if (cancelled) return;
        if (res.status === "pending") {
          timer = setTimeout(poll, 600);
        } else {
          setStatus(res.status);
          setSettled(true);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 800);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reviewId]);

  useEffect(() => {
    if (!settled || calledBack.current) return;
    calledBack.current = true;
    const t = setTimeout(() => {
      if (status === "approved") onApprovedRef.current?.();
      else onRejectedRef.current?.();
    }, 900);
    return () => clearTimeout(t);
    // onApproved/onRejected intentionally excluded: they're read via refs so
    // that parent re-renders (e.g. a ticking countdown) with a new inline
    // callback don't cancel this timer before it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, status]);

  const activeIndex = !settled ? 1 : 2;

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-10 text-center animate-fade-in">
      <div className="relative flex h-24 w-24 items-center justify-center">
        {!settled && (
          <>
            <span className="absolute inset-0 rounded-full bg-accent-10 animate-pulse-ring" />
            <span className="absolute inset-0 rounded-full bg-accent-10 animate-pulse-ring [animation-delay:0.6s]" />
          </>
        )}
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full",
            settled
              ? status === "approved"
                ? "bg-accent text-bg animate-check-pop"
                : "bg-danger text-bg animate-check-pop"
              : "bg-accent-10 text-accent"
          )}
        >
          {settled ? (
            status === "approved" ? <Check className="h-9 w-9" /> : <X className="h-9 w-9" />
          ) : (
            <Clock3 className="h-8 w-8 animate-pulse" />
          )}
        </div>
      </div>

      <div className="space-y-1.5" role="status" aria-live="polite">
        <p className="text-lg font-semibold text-ink">
          {settled
            ? status === "approved"
              ? t("review.approvedTitle")
              : t("review.rejectedTitle")
            : title ?? t("review.submittedTitle")}
        </p>
        <p className="text-sm text-ink/60 max-w-[280px]">
          {settled
            ? status === "approved"
              ? t("review.approvedDesc")
              : t("review.rejectedDesc")
            : description ?? t("review.submittedDesc")}
        </p>
      </div>

      <div className="flex w-full max-w-[280px] items-center justify-between">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < activeIndex || (i === activeIndex && settled);
          const isActive = i === activeIndex && !settled;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      isDone || isActive ? "bg-accent" : "bg-border"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    isDone ? "bg-accent text-bg" : isActive ? "bg-accent-10 text-accent" : "bg-ink/5 text-ink/60"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {i === 0 && <span className="h-0.5 flex-1" />}
              </div>
              <span className="text-xs text-ink/60">{t(step.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
