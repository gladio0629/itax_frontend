import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

/**
 * iOS grouped inset list (Settings style). iOS mode only — the standard
 * design keeps each screen's own card markup.
 *
 * Section: 16px side inset, 10px radius, Footnote header/footer in secondary
 * label colour. Row: 44px min (single line) / 60px (with subtitle), 16px left
 * padding, separators inset to the text column, iOS chevron on the right,
 * background darkens on press.
 */
export function ListSection({
  header,
  footer,
  children,
  className,
  headerTone,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headerTone?: "danger";
}) {
  return (
    <section className={cn("mx-4 mb-[35px] last:mb-0", className)}>
      {header && (
        <h2
          className={cn(
            "ios-footnote px-4 pb-[7px] uppercase",
            headerTone === "danger" ? "text-danger" : "text-[color:var(--ios-label-secondary)]"
          )}
        >
          {header}
        </h2>
      )}
      <div className="overflow-hidden rounded-group bg-card ios-squircle">{children}</div>
      {footer && <p className="ios-footnote px-4 pt-[7px] text-[color:var(--ios-label-secondary)]">{footer}</p>}
    </section>
  );
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 text-[color:var(--ios-label-tertiary)]", className)}
    >
      <path d="M1.5 1.5 6.5 7l-5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 29×29 rounded-square glyph tile, as in iOS Settings. */
export function IconTile({ icon: Icon, tone = "accent" }: { icon: React.ComponentType<{ className?: string }>; tone?: "accent" | "danger" | "yellow" | "gray" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] ios-squircle",
        tone === "accent" && "bg-accent text-white",
        tone === "danger" && "bg-danger text-white",
        tone === "yellow" && "bg-brand-yellow text-on-yellow",
        tone === "gray" && "bg-[var(--ios-icon-gray)] text-white"
      )}
    >
      <Icon className="h-[17px] w-[17px]" />
    </span>
  );
}

type RowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Glyph tile (or any node, e.g. an avatar) before the text. */
  leading?: ReactNode;
  /** Secondary value on the right (e.g. the current language). */
  value?: ReactNode;
  /** Trailing control (switch, button). */
  accessory?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Show the disclosure chevron. Defaults to on for navigating rows. */
  chevron?: boolean;
  /** Checkmark on the right (selection lists). */
  checked?: boolean;
  destructive?: boolean;
  /** Centered single action (e.g. "Chiqish"). */
  centered?: boolean;
  /** Bold, accent-coloured action row (e.g. "Akkaunt qo'shish"). */
  action?: boolean;
  /** Left inset of this row's bottom separator, in px from the row's left edge. */
  separatorInset?: number;
  large?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function ListRow({
  title,
  subtitle,
  leading,
  value,
  accessory,
  to,
  onClick,
  chevron,
  checked,
  destructive,
  centered,
  action,
  separatorInset,
  large,
  ariaLabel,
  className,
}: RowProps) {
  const interactive = !!(to || onClick);
  const showChevron = chevron ?? (!!to && !destructive && !centered);
  // Separators start at the text column: 16px padding, or after the tile.
  const inset = separatorInset ?? (leading ? (large ? 92 : 60) : 16);

  const classes = cn(
    "relative flex w-full items-center gap-[15px] bg-card pl-4 pr-4 text-left",
    large ? "min-h-[76px] py-2.5" : subtitle ? "min-h-[60px] py-[9px]" : "min-h-[44px] py-[11px]",
    interactive && "transition-colors duration-100 active:bg-[var(--ios-row-pressed)]",
    // Hairline separator below every row but the last, inset like iOS.
    "ios-sep",
    centered && "justify-center",
    className
  );
  const sepStyle = { ["--sep-inset" as string]: `${inset}px` } as React.CSSProperties;

  const body = (
    <>
      {leading}
      <span className={cn("min-w-0", centered ? "text-center" : "flex-1")}>
        <span
          className={cn(
            "block",
            large ? "ios-title2 !font-normal" : "ios-body",
            destructive ? "text-danger" : action ? "text-accent" : "text-ink",
            (large || !subtitle) && "truncate"
          )}
        >
          {title}
        </span>
        {subtitle && <span className="ios-subheadline mt-px block text-[color:var(--ios-label-secondary)]">{subtitle}</span>}
      </span>
      {value != null && <span className="ios-body shrink-0 text-[color:var(--ios-label-secondary)]">{value}</span>}
      {accessory}
      {checked && (
        <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" className="shrink-0 text-accent">
          <path d="M1.5 7.5 6 12 14.5 1.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {showChevron && <Chevron />}
    </>
  );

  const style = { ...sepStyle };
  const withInset = "";

  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} className={cn(classes, withInset)} style={style}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(classes, withInset)} style={style}>
        {body}
      </button>
    );
  }
  return (
    <div className={cn(classes, withInset)} style={style}>
      {body}
    </div>
  );
}
