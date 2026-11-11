import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "navy";
type Size = "lg" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

// Yellow is the primary action everywhere. Disabled keeps the shape and
// drops to 40% so the layout never jumps.
const variants: Record<Variant, string> = {
  primary: "bg-yellow text-on-yellow shadow-1",
  secondary: "bg-raised text-ink",
  ghost: "bg-transparent text-ink",
  danger: "bg-danger-fill text-white",
  navy: "bg-[#264A9F] text-white shadow-1",
};
const sizes: Record<Size, string> = {
  lg: "h-14 px-6 text-base",
  md: "h-12 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, fullWidth, className, children, disabled, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "press inline-flex select-none items-center justify-center gap-2 rounded-button font-bold",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="h-5 w-5" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
