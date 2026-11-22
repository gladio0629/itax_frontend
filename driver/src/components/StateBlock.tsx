import type { ReactNode } from "react";
import type { LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";

/**
 * Shared layout of the empty / error / offline states: an 88px rounded icon
 * tile, a 22px title, a short description and up to two actions.
 */
export function StateBlock({
  icon: Icon,
  tone = "soft",
  title,
  description,
  action,
  secondary,
  role,
  className,
}: {
  icon: LucideIcon;
  tone?: "soft" | "warning" | "brand";
  title: string;
  description?: string;
  action?: ReactNode;
  secondary?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const tile = { soft: "bg-raised text-ink", warning: "bg-warning-soft text-warning", brand: "bg-brand-soft text-brand-ink" }[tone];
  return (
    <div role={role} className={cn("flex animate-fade-up flex-col items-center gap-4 px-2 py-10 text-center", className)}>
      <span className={cn("flex h-[88px] w-[88px] items-center justify-center rounded-[30px]", tile)} aria-hidden="true">
        <Icon className="h-9 w-9" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-[22px] font-extrabold leading-[30px] text-ink">{title}</p>
        {description && <p className="mx-auto max-w-[300px] text-sm leading-[21px] text-muted">{description}</p>}
      </div>
      {action && <div className="mt-2 w-full self-stretch">{action}</div>}
      {secondary}
    </div>
  );
}
