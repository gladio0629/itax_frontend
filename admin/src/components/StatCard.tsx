import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "accent" | "warning" | "danger";
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-ink/5 text-ink/70",
    accent: "bg-accent-10 text-accent",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  };
  return (
    <Card className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-ink/50">{label}</p>
        <p className="mt-2 text-xl font-semibold text-ink tabular">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", toneClasses[tone])}>{icon}</div>
    </Card>
  );
}
