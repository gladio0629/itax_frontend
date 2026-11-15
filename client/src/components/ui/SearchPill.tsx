import { ChevronRight } from "@/lib/icons";

/** "Qayerga boramiz?" — gray field, centred label, dark round arrow on the
 * right. 48px tall, radius 19 (measured). */
export function SearchPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-[var(--size-search)] w-full items-center justify-center rounded-field bg-fill px-12 text-lead font-medium text-ink transition-colors hover:bg-ink/10"
    >
      <span className="truncate">{label}</span>
      <span className="absolute right-4 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-bg" aria-hidden="true">
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}
