import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/api/client";

export type ReviewStatusValue = "pending" | "approved" | "rejected";

type Props = {
  reviewId: string;
  title?: string;
  description?: string;
  onApproved?: () => void;
  onRejected?: () => void;
};

const STEPS = [
  { key: "submitted", label: "Yuborildi", icon: Send },
  { key: "reviewing", label: "Tekshirilmoqda", icon: Clock3 },
  { key: "done", label: "Yakunlandi", icon: Check },
] as const;

/**
 * Shared "submitted for review" state used everywhere a demo action needs
 * verification (OTP, card linking, wallet top-up, driver documents, admin
 * 2FA, two-person approval, support tickets). Polls api.getReviewStatus()
 * until the mock server auto-resolves it (2-4s), then shows a short
 * celebratory confirmation before calling back.
 */
export function ReviewStatus({ reviewId, title, description, onApproved, onRejected }: Props) {
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
    // that parent re-renders with a new inline callback don't cancel this
    // timer before it fires.
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
                ? "bg-accent text-white animate-check-pop"
                : "bg-danger text-white animate-check-pop"
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

      <div className="space-y-2">
        <p className="text-lg font-semibold text-ink">
          {settled ? (status === "approved" ? "Tasdiqlandi!" : "Rad etildi") : title ?? "Tekshiruvga yuborildi"}
        </p>
        <p className="text-sm text-ink/60 max-w-[320px]">
          {settled
            ? status === "approved"
              ? "Hammasi tayyor, davom etishingiz mumkin."
              : "Ma'lumotlarni qayta tekshirib, qaytadan yuboring."
            : description ?? "Bir necha soniyada natija chiqadi. Kuting, iltimos."}
        </p>
      </div>

      <div className="flex w-full max-w-[320px] items-center justify-between">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < activeIndex || (i === activeIndex && settled);
          const isActive = i === activeIndex && !settled;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <span className={cn("h-0.5 flex-1", isDone || isActive ? "bg-accent" : "bg-border")} />
                )}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    isDone ? "bg-accent text-white" : isActive ? "bg-accent-10 text-accent" : "bg-ink/5 text-ink/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {i === 0 && <span className="h-0.5 flex-1" />}
              </div>
              <span className="text-xs text-ink/60">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
