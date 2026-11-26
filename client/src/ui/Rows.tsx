import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import logoOnDark from "@/assets/v2/logo-on-dark.png";
import { IconTile } from "./Field";
import { Icon, type IconName } from "./Icon";

/**
 * Settings-style row (design v2): 68px, icon tile, 15px bold title, optional
 * value and chevron, divider under every row but the last (`last`).
 * Renders a <button> when `onClick` is set, otherwise a <div> (put a control
 * in `trailing`).
 */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  trailing,
  onClick,
  chevron = !!onClick,
  last,
  tone = "ink",
  tall,
}: {
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  last?: boolean;
  tone?: "ink" | "danger";
  /** 80px rows with a subtitle (Bildirishnomalar). */
  tall?: boolean;
}) {
  const body = (
    <>
      {icon && <IconTile icon={icon} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className={cn("truncate font-bold", subtitle ? "text-[15px] font-extrabold" : "text-[15px]", tone === "danger" ? "text-iz-danger" : "text-iz-ink")}>
          {title}
        </span>
        {subtitle && <span className="text-[13px] text-iz-muted">{subtitle}</span>}
      </span>
      {value != null && <span className="shrink-0 text-[14px] font-bold text-iz-muted">{value}</span>}
      {trailing}
      {chevron && <Icon name="chevronRight" size={18} className="shrink-0 text-iz-muted" />}
    </>
  );
  const cls = cn(
    "flex w-full shrink-0 items-center gap-3.5",
    tall || subtitle ? "min-h-20 py-3" : "min-h-[68px] py-3",
    !last && "border-b border-iz-border"
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "active:opacity-70")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** IZGO logo for the dark top ("IZ" and "O" white, "G" in the green pin). */
export function Logo({ width = 84, className }: { width?: number; className?: string }) {
  return <img src={logoOnDark} alt="IZGO" width={width} height={Math.round((width * 240) / 562)} className={cn("block", className)} />;
}

/** Initials in a green circle (profile, driver). */
export function Initials({ name, size = 56, className }: { name: string; size?: number; className?: string }) {
  const letters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-iz-green font-extrabold text-iz-on-green", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
    >
      {letters}
    </span>
  );
}

/** Status badge on light-green ("Faol", "Haydovchi topildi"). */
export function Badge({ children, tone = "green", className }: { children: ReactNode; tone?: "green" | "warn" | "danger" | "muted"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[12px] font-bold",
        tone === "green" && "bg-iz-green-soft text-iz-green-text",
        tone === "warn" && "bg-iz-warn-soft text-iz-warn",
        tone === "danger" && "bg-iz-danger-soft text-iz-danger",
        tone === "muted" && "bg-iz-field text-iz-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
