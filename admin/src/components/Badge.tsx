import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "warning" | "danger" | "info";

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

const tones: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink/80",
  accent: "bg-accent-10 text-accent",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-ink/5 text-ink/60",
};

export function Badge({ tone = "neutral", className, ...rest }: Props) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...rest}
    />
  );
}
