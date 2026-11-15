import { X } from "@/lib/icons";
import { cn } from "@/lib/cn";

/** Round gray X (header cards, sheets). 32px circle inside a 44px target. */
export function CloseButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fill text-ink/70 transition-colors hover:bg-ink/10">
        <X className="h-4 w-4" />
      </span>
    </button>
  );
}

/** White round X floating above a sheet's top edge (48px). */
export function FloatingClose({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn("flex h-12 w-12 items-center justify-center rounded-full bg-card text-ink shadow-[0_2px_12px_rgba(0,0,0,0.16)]", className)}
    >
      <X className="h-5 w-5" />
    </button>
  );
}
