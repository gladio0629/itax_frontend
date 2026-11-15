import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

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
  if (!open) return null;
  const reasonMissing = !!reasonLabel && reason.trim().length < reasonMinLength;
  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-center justify-center bg-ink/40 px-4 animate-fade-in">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          // Close only this dialog, not a drawer underneath it.
          e.stopPropagation();
          if (!loading) onCancel();
        }}
        className="w-full max-w-sm rounded-sheet bg-card p-6 text-center shadow-2xl animate-scale-in"
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent-10 text-accent"}`}
        >
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 id="confirm-title" className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p id="confirm-desc" className="mt-2 text-sm text-ink/60">
          {description}
        </p>
        {reasonLabel && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonLabel}
            aria-label={reasonLabel}
            rows={2}
            maxLength={500}
            className="mt-4 w-full rounded-button border border-border bg-card p-3 text-left text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        )}
        {error && <p className="mt-3 text-xs font-semibold text-danger">{error}</p>}
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={loading} autoFocus>
            Bekor qilish
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            fullWidth
            loading={loading}
            disabled={reasonMissing}
            onClick={() => onConfirm(reasonLabel ? reason.trim() : undefined)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
