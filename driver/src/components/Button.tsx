import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight } from "@/lib/icons";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "lg" | "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** lg 60 (main action), md 48 (card actions), sm 40. */
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** lg only: text on the left, this icon in an Ink circle on the right.
   * Defaults to an arrow for a large primary button; `null` hides it. */
  trailing?: ReactNode | null;
};

// Redesign v2: green is the main action (Ink text on it). Buttons are full
// pills. Disabled keeps the shape and drops to 40% so the layout never jumps.
const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand",
  secondary: "bg-raised text-ink",
  ghost: "bg-transparent text-ink",
  danger: "bg-danger-soft text-danger",
  dark: "bg-night text-white",
};
const sizes: Record<Size, string> = {
  lg: "h-[60px] px-6 text-base font-extrabold",
  md: "h-12 px-5 text-sm font-bold",
  sm: "h-11 px-4 text-13 font-bold",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, fullWidth, trailing, className, children, disabled, type = "button", ...rest }, ref) => {
    const circle = size === "lg" && trailing !== null && (trailing !== undefined || variant === "primary");
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "press inline-flex select-none items-center gap-2 rounded-button",
          "disabled:pointer-events-none disabled:opacity-40",
          circle ? "justify-between pl-6 pr-2" : "justify-center",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {!circle && loading && <Spinner className="h-5 w-5" />}
        {circle ? <span className="min-w-0 truncate text-left">{children}</span> : children}
        {circle && (
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              variant === "dark" ? "bg-brand text-on-brand" : "bg-night text-white"
            )}
            aria-hidden="true"
          >
            {loading ? <Spinner className="h-5 w-5" /> : trailing ?? <ArrowRight className="h-5 w-5" />}
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
