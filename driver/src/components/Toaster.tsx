import { useToast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { AlertTriangle, Check, Info } from "@/lib/icons";

/** Toasts sit at the top of the content area, clear of thumb-zone controls. */
export function Toaster() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none absolute inset-x-4 z-[60] flex flex-col gap-2"
      style={{ top: "calc(var(--safe-top) + 72px)" }}
      role="status"
      aria-live="polite"
    >
      {items.map((t) => {
        const Icon = t.tone === "danger" ? AlertTriangle : t.tone === "success" ? Check : Info;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex min-h-12 animate-fade-up items-center gap-3 rounded-card bg-raised px-4 py-3 text-left shadow-2"
          >
            <Icon className={cn("h-5 w-5 shrink-0", t.tone === "danger" ? "text-danger" : t.tone === "success" ? "text-success" : "text-accent")} />
            <span className="text-sm text-ink">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
