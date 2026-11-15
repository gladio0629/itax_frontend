import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Icon tile (40px gray rounded square) + title + gray subtitle + trailing
 * value; hairline under the text column. 57px pitch (measured).
 */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  ariaLabel,
  className,
  last,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  /** No hairline under the last row. */
  last?: boolean;
}) {
  const body = (
    <>
      {icon && (
        <span className="flex h-[var(--size-tile)] w-[var(--size-tile)] shrink-0 items-center justify-center rounded-tile bg-fill text-ink/70" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={cn("flex min-h-[var(--size-row)] min-w-0 flex-1 items-center gap-3 py-2", !last && "border-b border-hairline")}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-ink">{title}</span>
          {subtitle && <span className="block truncate text-sub text-ink/60">{subtitle}</span>}
        </span>
        {trailing != null && <span className="shrink-0 text-sub text-ink/60 tabular">{trailing}</span>}
      </span>
    </>
  );
  const cls = cn("flex w-full items-center gap-3 text-left", className);
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(cls, "transition-colors hover:bg-ink/[0.03]")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
