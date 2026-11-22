import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A phone number as the server sent it: already masked ("+998 9• ••• •• 21").
 * This component never receives or masks a full number. When `onReveal` is
 * given, a small button asks the server for the full number (the server
 * writes the audit entry); the result lives only in this component's state.
 */
export function MaskedPhone({
  masked,
  onReveal,
  className,
}: {
  masked: string;
  onReveal?: () => Promise<string>;
  className?: string;
}) {
  const [full, setFull] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reveal() {
    if (!onReveal || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setFull(await onReveal());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="tabular whitespace-nowrap">{full ?? masked}</span>
      {onReveal && !full && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            reveal();
          }}
          disabled={busy}
          aria-label="Telefonni ochish (audit jurnaliga yoziladi)"
          title={failed ? "Ochib bo'lmadi, qayta urinib ko'ring" : "Telefonni ochish (audit jurnaliga yoziladi)"}
          className={cn(
            "relative inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink disabled:opacity-50",
            // 44px hit area around the small icon.
            "before:absolute before:-inset-2.5 before:content-['']",
            failed && "text-error"
          )}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}
