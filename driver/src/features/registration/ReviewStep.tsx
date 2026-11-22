// RegReview: the automatic check, per section when the server reports it.
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { RegistrationReview, RegistrationSectionStatus } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { Check, Clock, HelpCircle, Loader2, Shield, ShieldCheck, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";

const STATUS_STYLE: Record<RegistrationSectionStatus, { tile: string; text: string; icon: typeof Check }> = {
  approved: { tile: "bg-brand-soft text-brand-ink", text: "font-extrabold text-brand-ink", icon: Check },
  checking: { tile: "bg-raised text-ink", text: "font-bold text-ink", icon: Loader2 },
  queued: { tile: "bg-raised text-muted", text: "font-bold text-muted", icon: Clock },
  rejected: { tile: "bg-danger-soft text-danger", text: "font-extrabold text-danger", icon: X },
};

/** Progress ring around the shield: the share of approved sections, or a spinning arc when unknown. */
function Ring({ ratio, done }: { ratio: number | null; done: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-[120px] w-[120px] items-center justify-center" aria-hidden="true">
      <svg width="120" height="120" viewBox="0 0 120 120" className={cn("absolute inset-0 -rotate-90", ratio === null && !done && "animate-spin [animation-duration:1.6s]")}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-night-line)" strokeWidth="6" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="rgb(var(--color-brand-rgb))"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (done ? 1 : ratio ?? 0.3))}
          style={{ transition: "stroke-dashoffset 600ms var(--ease)" }}
        />
      </svg>
      <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-night-2 text-brand">
        {done ? <ShieldCheck className="h-8 w-8" /> : <Shield className="h-8 w-8" />}
      </span>
    </span>
  );
}

/**
 * Polls the review (sample data: a timed review; real backend: the driver's
 * status) and, when the server reports it, each section's progress. "Bosh
 * sahifaga" stays inactive until the server approves.
 */
export function ReviewStep({ reviewId, onApproved, onRejected, onContinue }: { reviewId?: string; onApproved: () => void; onRejected: () => void; onContinue: () => void }) {
  const { t } = useT();
  const [state, setState] = useState<"pending" | "approved" | "rejected">("pending");
  const cb = useRef({ onApproved, onRejected });
  cb.current = { onApproved, onRejected };
  const review = useQuery<RegistrationReview | null>(() => api.getRegistrationReview(), []);
  // Poll while pending; stop for good once the server says it has no per-section report (null).
  const reload = review.reload;
  const noReport = review.data === null;
  useEffect(() => {
    if (state !== "pending" || noReport) return;
    const id = setInterval(() => reload(true), 2000);
    return () => clearInterval(id);
  }, [state, noReport, reload]);

  useEffect(() => {
    if (!reviewId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await api.getReviewStatus(reviewId!);
        if (cancelled) return;
        if (r.status === "pending") timer = setTimeout(poll, 1500);
        else {
          setState(r.status);
          if (r.status === "approved") cb.current.onApproved();
          else cb.current.onRejected();
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reviewId]);

  const done = state === "approved";
  const sections = review.data?.sections ?? null;
  const ratio = sections && sections.length ? sections.filter((s) => s.status === "approved").length / sections.length : null;
  const eta = review.data?.etaMinutes;
  const keys = ["personal", "license", "car", "selfie"] as const;

  return (
    <Screen
      header={
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <Ring ratio={ratio} done={done} />
          <span className="flex h-7 items-center gap-2 rounded-full bg-night-2 px-3 text-xs font-extrabold uppercase tracking-[0.8px] text-brand">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            {t("reg.autoCheck")}
          </span>
          <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
            <h1 className="text-[28px] font-extrabold leading-[34px]">{done ? t("reg.reviewApproved") : t("reg.reviewChecking")}</h1>
            <p className="text-sm text-night-muted">{done ? t("reg.reviewApprovedDesc") : eta ? t("reg.reviewEta", { n: eta }) : t("reg.reviewNoEta")}</p>
          </div>
        </div>
      }
      footer={
        <Button size="lg" fullWidth disabled={!done} onClick={onContinue}>
          {t("reg.toHome")}
        </Button>
      }
    >
      <ul className="flex flex-col">
        {keys.map((key) => {
          const status: RegistrationSectionStatus | undefined = done ? "approved" : sections?.find((s) => s.key === key)?.status;
          const st = status ? STATUS_STYLE[status] : null;
          const Icon = st?.icon;
          return (
            <li key={key} className="flex min-h-[60px] items-center gap-3.5 border-b border-line last:border-b-0">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-tile", st?.tile ?? "bg-raised text-muted")} aria-hidden="true">
                {Icon ? <Icon className={cn("h-5 w-5", status === "checking" && "animate-spin")} /> : <Clock className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1 text-15 font-bold text-ink">{t(`reg.section.${key}`)}</span>
              {status && <span className={cn("shrink-0 text-13", st?.text)}>{t(`reg.status.${status}`)}</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex items-start gap-2.5 rounded-[18px] bg-raised p-4 text-13 leading-[19px] text-muted">
        <HelpCircle className="mt-px h-4 w-4 shrink-0" />
        {t("reg.reviewNote")}
      </p>
    </Screen>
  );
}
