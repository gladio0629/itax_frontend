import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

/** KPI tile. A trailing " so'm" is split off and set smaller so long amounts stay on one line. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  /** Signature KPI: yellow top accent. */
  highlight?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-ink/5 text-ink/60",
    accent: "bg-accent-10 text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  };
  const m = value.match(/^(.*?)\s(so'm)$/);
  return (
    <Card className={cn("relative flex items-start justify-between gap-4 overflow-hidden", highlight && "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-brand-yellow")}>
      <div className="min-w-0">
        <p className="line-clamp-2 min-h-10 text-sm text-ink/60" title={label}>
          {label}
        </p>
        <p className="tabular mt-2 whitespace-nowrap text-xl font-semibold text-ink">
          {m ? m[1] : value}
          {m && <span className="ml-1 text-sm font-semibold text-ink/50">{m[2]}</span>}
        </p>
        {hint && <p className="tabular mt-1 text-xs text-ink/50">{hint}</p>}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-button", toneClasses[tone])}>{icon}</div>
    </Card>
  );
}
