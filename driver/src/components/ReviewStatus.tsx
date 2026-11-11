import { useEffect, useRef, useState } from "react";
import { Check, Clock, Send, X } from "@/lib/icons";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

type Props = {
  reviewId: string;
  title?: string;
  description?: string;
  onApproved?: () => void;
  onRejected?: () => void;
  compact?: boolean;
};

const STEPS = [
  { key: "review.submitted", icon: Send },
  { key: "review.reviewing", icon: Clock },
  { key: "review.done", icon: Check },
] as const;

/**
 * Shared "sent for review" state. Polls api.getReviewStatus() until the
 * adapter resolves it, shows the outcome for ~900ms, then calls back once.
 */
export function ReviewStatus({ reviewId, title, description, onApproved, onRejected, compact }: Props) {
  const { t } = useT();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const cb = useRef({ onApproved, onRejected });
  cb.current = { onApproved, onRejected };
  const fired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await api.getReviewStatus(reviewId);
        if (cancelled) return;
        if (r.status === "pending") timer = setTimeout(poll, 500);
        else setStatus(r.status);
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
    if (status === "pending" || fired.current) return;
    fired.current = true;
    const timer = setTimeout(() => (status === "approved" ? cb.current.onApproved?.() : cb.current.onRejected?.()), 900);
    return () => clearTimeout(timer);
  }, [status]);

  const settled = status !== "pending";
  const active = settled ? 2 : 1;

  return (
    <div className={cn("flex animate-fade-up flex-col items-center text-center", compact ? "gap-5 py-6" : "gap-8 px-2 py-10")}>
      <div className="relative flex h-24 w-24 items-center justify-center">
        {!settled && (
          <>
            <span className="absolute inset-2 animate-pulse-ring rounded-full bg-yellow/25" />
            <span className="absolute inset-2 animate-pulse-ring rounded-full bg-yellow/25 [animation-delay:0.9s]" />
          </>
        )}
        <span
          className={cn(
            "relative flex h-20 w-20 items-center justify-center rounded-full",
            settled ? (status === "approved" ? "animate-check-pop bg-success text-bg" : "animate-check-pop bg-danger-fill text-white") : "bg-raised text-gold"
          )}
        >
          {settled ? status === "approved" ? <Check className="h-9 w-9" /> : <X className="h-9 w-9" /> : <Clock className="h-8 w-8" />}
        </span>
      </div>

      <div className="space-y-2" role="status" aria-live="polite">
        <p className="text-lg font-bold text-ink">
          {settled ? (status === "approved" ? t("review.approvedTitle") : t("review.rejectedTitle")) : title ?? t("review.submittedTitle")}
        </p>
        <p className="mx-auto max-w-[280px] text-sm text-muted">
          {settled ? (status === "approved" ? t("review.approvedDesc") : t("review.rejectedDesc")) : description ?? t("review.submittedDesc")}
        </p>
      </div>

      <ol className="flex w-full max-w-[300px] items-start" aria-label={t("review.reviewing")}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < active || (i === active && settled);
          const current = i === active && !settled;
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-2" aria-current={current ? "step" : undefined}>
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : done || current ? "bg-yellow" : "bg-ink/10")} />
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    done ? "bg-yellow text-on-yellow" : current ? "bg-raised text-gold ring-2 ring-yellow" : "bg-raised text-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "opacity-0" : i < active ? "bg-yellow" : "bg-ink/10")} />
              </div>
              <span className="text-xs text-muted">{t(s.key)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
