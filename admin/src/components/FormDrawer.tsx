import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Drawer } from "./Drawer";
import { Button } from "./Button";

/** Thin shared wrapper over Drawer for every add/edit form: title, fields,
 * error line, pinned submit button. A real <form>, so Enter submits. */
export function FormDrawer({
  open,
  onClose,
  title,
  onSubmit,
  submitLabel = "Saqlash",
  loading,
  disabled,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  const formId = `form-${title.replace(/\W+/g, "-")}`;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="space-y-3">
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="soft" onClick={onClose} disabled={loading}>
              Bekor qilish
            </Button>
            <Button type="submit" form={formId} className="flex-1" loading={loading} disabled={disabled}>
              {submitLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && !disabled) onSubmit();
        }}
      >
        {children}
      </form>
    </Drawer>
  );
}
