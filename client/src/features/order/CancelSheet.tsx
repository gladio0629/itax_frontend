import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

const REASONS = [
  "Reja o'zgardi",
  "Juda uzoq kutdim",
  "Narxni qayta ko'rib chiqdim",
  "Boshqa yo'l tanladim",
  "Boshqa sabab",
];

export function CancelSheet({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        className="mt-auto rounded-t-sheet bg-card p-5 animate-slide-up"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Buyurtmani bekor qilish</h2>
          <button onClick={onClose} aria-label="Yopish" className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-ink/60">Sababni tanlang:</p>
        <div className="mb-5 space-y-2">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors",
                reason === r ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/80"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full border-2",
                  reason === r ? "border-accent bg-accent" : "border-ink/30"
                )}
              />
              {r}
            </button>
          ))}
        </div>
        <Button fullWidth variant="danger" disabled={!reason} loading={loading} onClick={() => reason && onConfirm(reason)}>
          Buyurtmani bekor qilish
        </Button>
      </div>
    </div>
  );
}
