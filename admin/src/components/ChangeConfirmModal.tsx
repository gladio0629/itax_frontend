import type { ReactNode } from "react";
import { ArrowRight, ClipboardList, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { Modal, ModalNote } from "./Modal";

export type ChangeRow = {
  label: string;
  /** Old value as shown to the admin; null = not set before / not shown. */
  before: ReactNode | null;
  /** New value as typed. */
  after: ReactNode;
};

/**
 * Two-step confirmation (decision 2026-11-22): the admin edits, presses
 * "Saqlash", this modal lists what changes (old → new), "Tasdiqlash" sends it
 * to the server, "Bekor qilish" sends nothing and the screen discards the
 * pending edit (onCancel). One person, no second approver. The server writes the
 * audit entry and is the real check.
 */
export function ChangeConfirmModal({
  open,
  title = "O'zgarishni tasdiqlang",
  description = "Quyidagi qiymatlar o'zgaradi. \"Tasdiqlash\" bosilgandan keyin kuchga kiradi.",
  rows,
  extra,
  confirmLabel = "Tasdiqlash",
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  description?: ReactNode;
  rows: ChangeRow[];
  /** Extra content under the rows (e.g. the reason of a ledger correction). */
  extra?: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      busy={loading}
      title={title}
      description={description}
      icon={<ShieldCheck className="h-6 w-6" aria-hidden />}
      iconTone="info"
      footer={
        <>
          <Button variant="soft" onClick={onCancel} disabled={loading}>
            Bekor qilish
          </Button>
          <Button variant="primary" loading={loading} onClick={onConfirm} disabled={rows.length === 0} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-box shadow-hairline">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">O'zgarishlar: eski va yangi qiymat</caption>
          <thead>
            <tr className="bg-surface">
              <th scope="col" className="label-caps h-10 px-3 text-muted">
                Nima
              </th>
              <th scope="col" className="label-caps h-10 px-3 text-muted">
                Eski
              </th>
              <th scope="col" className="w-6 px-0" aria-hidden />
              <th scope="col" className="label-caps h-10 px-3 text-muted">
                Yangi
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <th scope="row" className="px-3 py-3 font-bold text-ink">
                  {r.label}
                </th>
                <td className="tabular px-3 py-3 font-semibold text-muted line-through decoration-muted/40">{r.before ?? "—"}</td>
                <td className="px-0 text-muted" aria-hidden>
                  <ArrowRight className="h-4 w-4" />
                </td>
                <td className="tabular px-3 py-3 font-extrabold text-ink">
                  <span className="sr-only">yangi: </span>
                  {r.after}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extra}
      <ModalNote icon={<ClipboardList className="h-4 w-4" aria-hidden />}>
        Kim, qachon va nimani o'zgartirgani audit jurnaliga yoziladi.
      </ModalNote>
      {error && (
        <p role="alert" className="text-13 font-semibold text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
