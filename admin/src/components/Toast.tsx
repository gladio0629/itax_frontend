import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

/** One toast style and position for the whole app: top-right, just under the
 * 64px top bar (clear of the user menu), auto-dismisses after 3s. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-6 top-20 z-[60] !m-0 flex justify-end animate-slide-in-right">
      <div className="flex max-w-sm items-center gap-2 rounded-button bg-ink px-4 py-3 text-sm text-white shadow-soft">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-yellow" aria-hidden />
        {message}
      </div>
    </div>
  );
}
