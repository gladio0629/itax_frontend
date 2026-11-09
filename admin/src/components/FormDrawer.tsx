import type { ReactNode } from "react";
import { Drawer } from "./Drawer";
import { Button } from "./Button";

/** Thin shared wrapper over Drawer for every add/edit form: title, fields,
 * error line, submit button. Keeps every create/edit screen consistent. */
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
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {children}
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <Button fullWidth loading={loading} disabled={disabled} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </Drawer>
  );
}
