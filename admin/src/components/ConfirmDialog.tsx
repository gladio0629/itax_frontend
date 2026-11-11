import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "accent";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel = "Tasdiqlash", tone = "danger", loading, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 !m-0 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-sheet bg-card p-6 text-center shadow-2xl animate-fade-in">
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent-10 text-accent"}`}
        >
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-2 text-sm text-ink/60">{description}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
            Bekor qilish
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} fullWidth loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
