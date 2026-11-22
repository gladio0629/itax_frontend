import type { BadgeTone } from "@/components/Badge";
import { cn } from "@/lib/cn";
import type { HistoryResult, QueueReason } from "@/api/types";

/** Reason tags (design Operators): Shikoyat red, Kirish blue, Hujjat orange, Ma'lumot grey. */
export const REASON: Record<QueueReason, { label: string; tag: string }> = {
  complaint: { label: "Shikoyat", tag: "bg-error-soft text-error" },
  login_issue: { label: "Kirish", tag: "bg-info-soft text-info" },
  document_update: { label: "Hujjat", tag: "bg-warn-soft text-warn" },
  info_needed: { label: "Ma'lumot", tag: "bg-surface text-ink" },
  driver_application: { label: "Ariza", tag: "bg-surface text-ink" },
};
export const REASON_CHIPS: QueueReason[] = ["complaint", "login_issue", "document_update", "info_needed"];

export const RESULT: Record<HistoryResult, { label: string; tone: BadgeTone }> = {
  resolved: { label: "Hal qilindi", tone: "success" },
  no_answer: { label: "Javob bermadi", tone: "warning" },
  callback: { label: "Qayta qo'ng'iroq", tone: "info" },
  escalated: { label: "Menejerga yuborildi", tone: "info" },
  rejected: { label: "Rad etildi", tone: "danger" },
  // Real API: not resolved, detail in the comment.
  unresolved: { label: "Hal qilinmadi", tone: "neutral" },
};

export const SUBJECT_LABEL = { passenger: "Yo'lovchi", driver: "Haydovchi" } as const;

export function Tag({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-[26px] items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-bold", className)}>{children}</span>;
}

/** "14 daq" / "2 soat" since a moment (display of elapsed time only). */
export function since(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - ts) / 60_000));
  if (m < 60) return `${m} daq`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} soat` : `${Math.floor(h / 24)} kun`;
}
