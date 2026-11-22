import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** v2 buttons are pills.
 * primary   = green, Ink text (main action)
 * dark      = Ink, white text ("Keyingi", selected chip)
 * secondary = white with a hairline ("Eksport", "Oldingi")
 * soft      = surface fill ("Bekor qilish" in dialogs)
 * ghost     = no fill
 * danger    = red text on soft red (block, cancel order) */
export type ButtonVariant = "primary" | "dark" | "secondary" | "soft" | "ghost" | "danger";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

// Colour changes are instant; only the press scale animates (transform-only motion).
const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-extrabold transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-green text-ink hover:bg-[#27c877]",
  dark: "bg-ink text-white hover:bg-ink/90",
  secondary: "bg-white text-ink shadow-hairline hover:bg-surface",
  soft: "bg-surface text-ink hover:bg-line",
  ghost: "bg-transparent text-ink hover:bg-surface",
  danger: "bg-error-soft text-error hover:bg-[#fbdcd8]",
};

export const buttonSizes: Record<Size, string> = {
  // 44px: the smallest touch target (RULES 8).
  md: "h-11 px-[18px] text-sm",
  // 36px: only inside table rows (owner decision 2026-11-22). Everything
  // else uses md (44px).
  sm: "h-9 px-3.5 text-13",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, fullWidth, className, children, disabled, type = "button", ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, buttonVariants[variant], buttonSizes[size], fullWidth && "w-full", className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

/** Icon-only round button (close, row actions). `label` becomes aria-label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  // 36 only inside table rows; 44 everywhere else.
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 36 | 44; tone?: "surface" | "white" }
>(({ label, size = 44, tone = "surface", className, children, type = "button", ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={label}
    title={label}
    style={{ width: size, height: size }}
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-full text-ink transition-colors disabled:opacity-50",
      tone === "surface" ? "bg-surface hover:bg-line" : "bg-white shadow-hairline hover:bg-surface",
      className
    )}
    {...rest}
  >
    {children}
  </button>
));
IconButton.displayName = "IconButton";
