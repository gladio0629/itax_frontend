import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { TextArea } from "./Input";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "accent";
  loading?: boolean;
  /** Ask for a reason (e.g. blocking, rejecting); it is passed to onConfirm. */
  reasonLabel?: string;
  reasonMinLength?: number;
  /** Shown under the text, e.g. the server's answer to a failed attempt. */
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
};

/** Yes/no question for one action (block, archive, cancel order…),
 * optionally with a reason. For changes of values use ChangeConfirmModal. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Tasdiqlash",
  tone = "danger",
  loading,
  reasonLabel,
  reasonMinLength = 1,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const reasonMissing = !!reasonLabel && reason.trim().length < reasonMinLength;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      busy={loading}
      role="alertdialog"
      width={480}
      title={title}
      description={description}
      icon={tone === "danger" ? <AlertTriangle className="h-6 w-6" aria-hidden /> : <ShieldCheck className="h-6 w-6" aria-hidden />}
      iconTone={tone === "danger" ? "danger" : "info"}
      footer={
        <>
          <Button variant="soft" onClick={onCancel} disabled={loading} autoFocus={!reasonLabel}>
            Bekor qilish
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            disabled={reasonMissing}
            onClick={() => onConfirm(reasonLabel ? reason.trim() : undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(reasonLabel || error) && (
        <>
          {reasonLabel && (
            <TextArea
              label={reasonLabel}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              autoFocus
            />
          )}
          {error && (
            <p role="alert" className="text-13 font-semibold text-error">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
