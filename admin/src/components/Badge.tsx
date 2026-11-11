import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * success = Faol (green) · danger = Bloklangan (red) · neutral = Arxivlangan (gray)
 * pending = Kutilmoqda / in review (amber) · accent = informational navy · info = quiet label.
 */
export type BadgeTone = "neutral" | "accent" | "success" | "pending" | "warning" | "danger" | "info";

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; /** Status dot; on by default for status tones. Off for category labels. */ dot?: boolean };

const tones: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-ink/70",
  accent: "bg-accent-10 text-accent",
  success: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-ink/[0.06] text-ink/70",
};

const dots: Partial<Record<BadgeTone, string>> = {
  success: "bg-success",
  pending: "bg-warning",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Badge({ tone = "neutral", dot = true, className, children, ...rest }: Props) {
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold", tones[tone], className)}
      {...rest}
    >
      {dot && dots[tone] && <span aria-hidden className={cn("h-2 w-2 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
