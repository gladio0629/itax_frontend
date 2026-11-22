import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
};

/** v2 field box: surface fill, radius 16, caps label on top, value below.
 * Focus: white fill, 2px Ink inset border, 4px soft-green ring. */
export const fieldBox = (error?: boolean) =>
  cn(
    "flex min-h-16 items-center gap-3 rounded-field px-4 py-2.5 transition-colors",
    error
      ? "bg-white shadow-[inset_0_0_0_2px_var(--error),0_0_0_4px_var(--error-soft)]"
      : "bg-surface focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]"
  );

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={id} className="mt-2 px-1 text-xs font-semibold text-error">
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={id} className="mt-2 px-1 text-xs font-medium text-muted">
        {hint}
      </p>
    );
  return null;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, leftIcon, rightSlot, className, id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const msgId = `${inputId}-msg`;
    return (
      <div className="w-full">
        <div className={fieldBox(!!error)}>
          {leftIcon && <span className="shrink-0 text-muted">{leftIcon}</span>}
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            {label && (
              <label htmlFor={inputId} className="label-caps text-muted">
                {label}
                {rest.required && (
                  <span className="ml-1 text-error" aria-hidden>
                    *
                  </span>
                )}
              </label>
            )}
            <input
              ref={ref}
              id={inputId}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || hint ? msgId : undefined}
              className={cn(
                "w-full min-w-0 bg-transparent text-15 font-bold text-ink outline-none focus-visible:shadow-none placeholder:font-semibold placeholder:text-muted/70",
                className
              )}
              {...rest}
            />
          </span>
          {rightSlot}
        </div>
        <FieldMessage id={msgId} error={error} hint={hint} />
      </div>
    );
  }
);
Input.displayName = "Input";

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(({ label, hint, error, className, id, rows = 3, ...rest }, ref) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  return (
    <div className="w-full">
      <div className={cn(fieldBox(!!error), "items-start")}>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <label htmlFor={inputId} className="label-caps text-muted">
            {label}
          </label>
          <textarea
            ref={ref}
            id={inputId}
            rows={rows}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? msgId : undefined}
            className={cn("w-full resize-none bg-transparent focus-visible:shadow-none text-15 font-semibold leading-[22px] text-ink outline-none placeholder:text-muted/70", className)}
            {...rest}
          />
        </span>
      </div>
      <FieldMessage id={msgId} error={error} hint={hint} />
    </div>
  );
});
TextArea.displayName = "TextArea";

/** Toolbar search: 40px white pill with a hairline (design: list toolbars). */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: ReactNode; tone?: "white" | "surface" }>(
  ({ label, icon, tone = "white", className, ...rest }, ref) => (
    <label
      className={cn(
        "flex h-11 min-w-0 items-center gap-2.5 rounded-full px-3.5 focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]",
        tone === "white" ? "bg-white shadow-hairline" : "bg-surface",
        className
      )}
    >
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={label}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-13 font-semibold text-ink outline-none focus-visible:shadow-none placeholder:text-muted"
        {...rest}
      />
    </label>
  )
);
SearchInput.displayName = "SearchInput";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
};

/** v2 select field: same box as Input, native <select> inside. */
export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(({ label, hint, error, options, className, id, ...rest }, ref) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const msgId = `${selectId}-msg`;
  return (
    <div className="w-full">
      <div className={cn(fieldBox(!!error), "relative")}>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <label htmlFor={selectId} className="label-caps text-muted">
            {label}
            {rest.required && (
              <span className="ml-1 text-error" aria-hidden>
                *
              </span>
            )}
          </label>
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? msgId : undefined}
            className={cn("w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-6 text-15 font-bold text-ink outline-none", className)}
            {...rest}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
        <ChevronDown aria-hidden className="pointer-events-none h-4 w-4 shrink-0 text-muted" />
      </div>
      <FieldMessage id={msgId} error={error} hint={hint} />
    </div>
  );
});
SelectField.displayName = "SelectField";
