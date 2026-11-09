import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, leftIcon, rightSlot, className, id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-ink/80">
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex h-[52px] items-center gap-2 rounded-xl border bg-card px-4 transition-colors",
            error ? "border-danger" : "border-border focus-within:border-accent"
          )}
        >
          {leftIcon && <span className="text-ink/60">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-full w-full bg-transparent text-sm text-ink placeholder:text-ink/60 outline-none",
              className
            )}
            {...rest}
          />
          {rightSlot}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-ink/60">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
