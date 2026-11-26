import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("h-5 w-5 animate-spin rounded-full border-[2.4px] border-current border-t-transparent", className)}
    />
  );
}

/**
 * Main action of a screen (design v2): 60px, green, label on the left and a
 * dark circle with an arrow on the right.
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, BaseProps & { icon?: IconName; trailing?: ReactNode }>(
  function PrimaryButton({ loading, disabled, children, className, icon = "arrowRight", trailing, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "flex h-[60px] w-full shrink-0 items-center justify-between gap-3 rounded-full bg-iz-green pl-6 pr-2 text-left text-[16px] font-extrabold text-iz-on-green",
          "transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
          className
        )}
        {...rest}
      >
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {trailing}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--iz-on-green)] text-white">
          {loading ? <Spinner /> : <Icon name={icon} strokeWidth={2.4} />}
        </span>
      </button>
    );
  }
);

/** Full-width 56px soft red action ("Chiqish"). */
export const DangerButton = forwardRef<HTMLButtonElement, BaseProps & { icon?: IconName }>(function DangerButton(
  { loading, disabled, children, className, icon, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "flex h-14 w-full shrink-0 items-center justify-center gap-2.5 rounded-full bg-iz-danger-soft text-[15px] font-extrabold text-iz-danger",
        "active:scale-[0.98] disabled:opacity-40",
        className
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
});

/** 44px text-only action under the main button ("Akkauntni o'chirish", "Yordamga yozish"). */
export const TextButton = forwardRef<HTMLButtonElement, BaseProps & { tone?: "muted" | "danger" | "ink" | "green" }>(
  function TextButton({ loading, disabled, children, className, tone = "muted", type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-2 px-2 text-[14px] font-bold disabled:opacity-40",
          tone === "muted" && "text-iz-muted",
          tone === "danger" && "text-iz-danger",
          tone === "ink" && "text-iz-ink",
          tone === "green" && "text-iz-green-text",
          className
        )}
        {...rest}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {children}
      </button>
    );
  }
);

/**
 * 44px round icon button. `tone="head"` sits on the dark top (thin border),
 * `tone="sheet"` on white, `tone="map"` floats over a map (white, shadow).
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; tone?: "head" | "sheet" | "map"; iconSize?: number }
>(function IconButton({ icon, label, tone = "head", iconSize = 20, className, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40",
        tone === "head" && "border border-iz-head-border bg-transparent text-iz-head-text",
        tone === "sheet" && "bg-iz-field text-iz-ink",
        tone === "map" && "bg-iz-sheet text-iz-ink shadow-[0_6px_20px_var(--iz-shadow)]",
        className
      )}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
});
