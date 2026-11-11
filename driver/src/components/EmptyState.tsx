import type { ReactNode } from "react";
import type { LucideIcon } from "@/lib/icons";

/** Placeholder illustration: concentric navy rings with the icon in yellow. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-accent/[0.06]" />
        <span className="absolute inset-4 rounded-full bg-accent/[0.08]" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-raised text-gold shadow-1">
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <p className="text-lg font-bold text-ink">{title}</p>
      {description && <p className="mt-2 max-w-[280px] text-sm text-muted">{description}</p>}
      {action && <div className="mt-6 w-full max-w-[280px]">{action}</div>}
    </div>
  );
}
