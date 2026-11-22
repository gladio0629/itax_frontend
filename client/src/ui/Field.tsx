import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/** 11px bold caps label (design: "QAYERDAN", "ISM", "TO'LOV USULI"). */
export function SectionLabel({ children, className, as: Tag = "span", id }: { children: ReactNode; className?: string; as?: "span" | "h2" | "h3"; id?: string }) {
  return (
    <Tag id={id} className={cn("text-[11px] font-bold uppercase leading-4 tracking-[0.8px] text-iz-muted", className)}>
      {children}
    </Tag>
  );
}

/** 44px rounded square holding a 20px icon (rows, fields). */
export function IconTile({ icon, className, tone = "field" }: { icon: IconName; className?: string; tone?: "field" | "sheet" | "green" | "head" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile",
        tone === "field" && "bg-iz-field text-iz-ink",
        tone === "sheet" && "bg-iz-sheet text-iz-ink",
        tone === "green" && "bg-iz-green text-iz-on-green",
        tone === "head" && "bg-iz-head-card text-iz-head-text",
        className
      )}
    >
      <Icon name={icon} />
    </span>
  );
}

type FieldShellProps = {
  label: string;
  icon?: IconName;
  /** Right side: a unit, a clear button, a lock… */
  trailing?: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  /** Taller box for multi-line text. */
  multiline?: boolean;
  readOnly?: boolean;
};

function shellClasses(multiline?: boolean, readOnly?: boolean, invalid?: boolean) {
  return cn(
    "group flex w-full cursor-text gap-3.5 rounded-iz-field border-2 bg-iz-field px-3",
    invalid ? "border-iz-danger" : "border-transparent",
    multiline ? "min-h-[68px] items-start py-3" : "h-[68px] items-center",
    !readOnly &&
      "focus-within:border-iz-ink focus-within:bg-iz-field-focus focus-within:shadow-[0_0_0_4px_var(--iz-focus-ring)]"
  );
}

function FieldBody({
  labelId,
  label,
  icon,
  trailing,
  children,
}: {
  labelId: string;
  label: string;
  icon?: IconName;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {icon && (
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink group-focus-within:bg-iz-field"
        >
          <Icon name={icon} />
        </span>
      )}
      <span className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !icon && "pl-1")}>
        <span id={labelId} className="text-[11px] font-bold uppercase leading-4 tracking-[0.8px] text-iz-muted">{label}</span>
        {children}
      </span>
      {trailing}
    </>
  );
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <span id={id} role="alert" className="px-1 text-[13px] font-semibold text-iz-danger">
        {error}
      </span>
    );
  }
  if (hint) {
    return (
      <span id={id} className="px-1 text-[13px] text-iz-muted">
        {hint}
      </span>
    );
  }
  return null;
}

/**
 * Input field (design v2): 68px, light fill, small caps label on top, value
 * below. Focus: white, 2px Ink border, 4px light-green ring.
 */
export const Field = forwardRef<HTMLInputElement, FieldShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className">>(
  function Field({ label, icon, trailing, error, hint, className, readOnly, id, multiline: _m, ...input }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const msgId = `${inputId}-msg`;
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={inputId} className={shellClasses(false, readOnly, !!error)}>
          <FieldBody labelId={`${inputId}-label`} label={label} icon={icon} trailing={trailing ?? (readOnly ? <Icon name="lock" size={18} className="shrink-0 text-iz-muted" /> : null)}>
            <input
              ref={ref}
              id={inputId}
              aria-labelledby={`${inputId}-label`}
              readOnly={readOnly}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || hint ? msgId : undefined}
              className={cn(
                "iz-input h-[22px] w-full min-w-0 border-0 bg-transparent p-0 text-[16px] font-extrabold text-iz-ink outline-none placeholder:font-semibold placeholder:text-iz-muted placeholder:opacity-70",
                readOnly && "text-iz-muted"
              )}
              {...input}
            />
          </FieldBody>
        </label>
        <FieldMessage id={msgId} error={error} hint={hint} />
      </div>
    );
  }
);

/** Multi-line variant ("Haydovchiga izoh", "O'z fikringiz"); grows with the text. */
export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  FieldShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { counter?: string }
>(function TextAreaField({ label, icon, trailing, error, hint, className, id, counter, rows = 2, multiline: _m, ...input }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className={shellClasses(true, input.readOnly, !!error)}>
        <FieldBody
          labelId={`${inputId}-label`}
          label={label}
          icon={icon}
          trailing={trailing ?? (counter ? <span className="shrink-0 self-start text-[12px] font-semibold tabular-nums text-iz-muted">{counter}</span> : null)}
        >
          <textarea
            ref={ref}
            id={inputId}
            aria-labelledby={`${inputId}-label`}
            rows={rows}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? msgId : undefined}
            className="iz-input field-sizing-content w-full min-w-0 resize-none border-0 bg-transparent p-0 text-[16px] font-semibold leading-[22px] text-iz-ink outline-none placeholder:text-iz-muted placeholder:opacity-70"
            {...input}
          />
        </FieldBody>
      </label>
      <FieldMessage id={msgId} error={error} hint={hint} />
    </div>
  );
});
