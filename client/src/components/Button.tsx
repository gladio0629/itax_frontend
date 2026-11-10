import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "@/lib/icons";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSoft" | "brand";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none";

// Brand yellow is the signature fill color — always paired with navy
// (on-yellow) text. It's the default ("primary") button everywhere, since
// each screen/sheet in this app renders at most one at a time; `brand` is
// kept as an explicit alias for call sites that want to say so directly.
const PRIMARY_CLASSES = "bg-brand-yellow text-on-yellow shadow-soft hover:brightness-105";

const variants: Record<Variant, string> = {
  primary: PRIMARY_CLASSES,
  brand: PRIMARY_CLASSES,
  secondary: "bg-accent-5 text-accent hover:bg-accent-10",
  ghost: "bg-transparent text-ink/80 hover:bg-ink/5",
  danger: "bg-danger text-bg shadow-soft hover:brightness-105",
  dangerSoft: "bg-danger/10 text-danger hover:bg-danger/15",
};

const sizes: Record<Size, string> = {
  md: "h-[52px] px-6 text-sm",
  sm: "h-11 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    { variant = "primary", size = "md", loading, fullWidth, className, children, disabled, ...rest },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
        {...rest}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
