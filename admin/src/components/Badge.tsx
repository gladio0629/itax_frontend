import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * v2 status badge: 26px pill, coloured dot + label (design-v2/admin).
 * success = Faol, Tugadi, Yozildi, Tasdiqlangan, Hal qilindi
 * info    = Safarda, Jarayonda, Avtomatik tekshiruv (blue)
 * pending / warning = Yo'lda, Avtomatik tekshiruvda, Ogohlantirilgan, Javob yo'q (orange)
 * danger  = Bekor qilindi, Haydovchi yo'q, Qarz chegarasi (red)
 * neutral = Bloklangan, Qidirilmoqda, Arxivlangan (grey)
 * accent  = old name, rendered as info.
 * The tone is chosen from the status the server sends; the badge never
 * decides a status itself.
 */
export type BadgeTone = "neutral" | "accent" | "success" | "pending" | "warning" | "danger" | "info";

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Status dot; on by default. Off for category labels. */
  dot?: boolean;
};

const tones: Record<BadgeTone, { box: string; dot: string }> = {
  success: { box: "bg-green-soft text-green-text", dot: "bg-green-text" },
  info: { box: "bg-info-soft text-info", dot: "bg-info" },
  accent: { box: "bg-info-soft text-info", dot: "bg-info" },
  pending: { box: "bg-warn-soft text-warn", dot: "bg-warn" },
  warning: { box: "bg-warn-soft text-warn", dot: "bg-warn" },
  danger: { box: "bg-error-soft text-error", dot: "bg-error" },
  neutral: { box: "bg-surface text-muted", dot: "bg-muted" },
};

export function Badge({ tone = "neutral", dot = true, className, children, ...rest }: Props) {
  const t = tones[tone];
  return (
    <span
      className={cn("inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold", t.box, className)}
      {...rest}
    >
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}
