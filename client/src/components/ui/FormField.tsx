import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Label-as-placeholder field with a bottom hairline (Podyezd, Qavat…). The
 * label is a real <label>: it sits where the placeholder would and floats
 * up (13px) once the field has focus or a value. 57px row (measured).
 */
export const FormField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; trailing?: React.ReactNode }
>(function FormField({ label, error, trailing, className, id, value, onFocus, onBlur, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const [focused, setFocused] = useState(false);
  const up = focused || (value != null && String(value).length > 0);
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("relative flex min-h-[var(--size-row)] items-end gap-2 border-b pb-2", error ? "border-danger" : "border-hairline focus-within:border-accent")}>
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute left-0 origin-left text-ink/55 transition-all duration-150",
            up ? "top-1.5 text-sub" : "top-1/2 -translate-y-1/2 text-body"
          )}
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          aria-invalid={!!error || undefined}
          className="h-6 min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
          {...rest}
        />
        {trailing}
      </div>
      {error && <p className="mt-1 text-sub text-danger">{error}</p>}
    </div>
  );
});

/** Two columns where the reference pairs fields (Podyezd | Kvartira). */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4">{children}</div>;
}
