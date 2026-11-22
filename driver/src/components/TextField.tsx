import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** Fixed text before the value (e.g. "+998"). */
  prefix?: ReactNode;
  /** Icon or control on the right. */
  trailing?: ReactNode;
};

/**
 * Redesign v2 field: 68 tall, soft fill, small caps label inside on top and
 * the value under it. Focus: white fill, 2px text-colour border, 4px soft
 * green halo. Error: red border and a message under the field.
 */
export const TextField = forwardRef<HTMLInputElement, Props>(({ label, error, hint, prefix, trailing, className, id, ...rest }, ref) => {
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
      <div
        className={cn(
          "flex min-h-[68px] items-center gap-3 rounded-field border-2 px-4 py-2.5 transition-[background-color,border-color,box-shadow]",
          "focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgb(var(--color-brand-soft-rgb))]",
          error ? "border-danger bg-raised" : "border-raised bg-raised focus-within:border-[color:var(--color-focus)]"
        )}
        onClick={() => inner.current?.focus()}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <label htmlFor={inputId} className="label-caps text-muted">
            {label}
          </label>
          <span className="flex min-w-0 items-center gap-1.5">
            {prefix && <span className="tabular shrink-0 text-base font-bold text-ink">{prefix}</span>}
            <input
              ref={inner}
              id={inputId}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || hint ? msgId : undefined}
              className="h-6 min-w-0 flex-1 bg-transparent text-base font-bold text-ink outline-none placeholder:font-semibold placeholder:text-muted/70 focus-visible:outline-none"
              {...rest}
            />
          </span>
        </span>
        {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
      </div>
      {(error || hint) && (
        <p id={msgId} role={error ? "alert" : undefined} className={cn("mt-2 px-1 text-13", error ? "font-semibold text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
TextField.displayName = "TextField";
