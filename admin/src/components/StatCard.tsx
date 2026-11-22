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
    <Card className={cn("relative flex items-start justify-between gap-4 overflow-hidden", highlight && "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-green")}>
      <div className="min-w-0">
        <p className="label-caps line-clamp-2 min-h-7 text-muted" title={label}>
          {label}
        </p>
        <p className="tabular mt-2 whitespace-nowrap text-xl font-extrabold text-ink">
          {m ? m[1] : value}
          {m && <span className="ml-1 text-sm font-bold text-muted">{m[2]}</span>}
        </p>
        {hint && <p className="tabular mt-1 text-xs font-semibold text-muted">{hint}</p>}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-button", toneClasses[tone])}>{icon}</div>
    </Card>
  );
}
