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
            {rest.required && (
              <span className="ml-1 text-danger" aria-hidden>
                *
              </span>
            )}
          </label>
        )}
        <div
          className={cn(
            "flex h-10 items-center gap-2 rounded-button border bg-card px-3",
            error ? "border-danger ring-2 ring-danger/10" : "border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"
          )}
        >
          {leftIcon && <span className="text-ink/60">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? `${inputId}-msg` : undefined}
            className={cn("h-full w-full bg-transparent text-sm text-ink placeholder:text-ink/50 outline-none", className)}
            {...rest}
          />
          {rightSlot}
        </div>
        {error ? (
          <p id={`${inputId}-msg`} className="mt-2 text-xs font-semibold text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-msg`} className="mt-2 text-xs text-ink/60">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
