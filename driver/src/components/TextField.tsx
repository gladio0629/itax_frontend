import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; prefix?: ReactNode };

export const TextField = forwardRef<HTMLInputElement, Props>(({ label, error, hint, prefix, className, id, ...rest }, ref) => {
  const auto = useId();
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  // Focus the field when validation fails, so the fix is one tap away.
  useEffect(() => {
    if (error) inner.current?.focus({ preventScroll: false });
  }, [error]);
  const inputId = id ?? auto;
  const msgId = `${inputId}-msg`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-muted">
        {label}
      </label>
      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-button bg-raised px-4 ring-inset focus-within:ring-2",
          error ? "ring-2 ring-danger" : "focus-within:ring-yellow"
        )}
      >
        {prefix && <span className="tabular text-base text-muted">{prefix}</span>}
        <input
          ref={inner}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/70 focus-visible:outline-none"
          {...rest}
        />
      </div>
      {(error || hint) && (
        <p id={msgId} role={error ? "alert" : undefined} className={cn("mt-2 text-sm", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
TextField.displayName = "TextField";
