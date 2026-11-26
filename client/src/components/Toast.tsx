import { useEffect } from "react";

// Renders inline — caller's screen root must have `position: relative`.
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    // 112 px above the bottom edge plus the home indicator, so it stays clear
    // of the footer (price + main button), which moves up by the same inset.
    <div className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-6 animate-slide-up" style={{ bottom: "calc(var(--safe-bottom) + 112px)" }}>
      <div role="status" aria-live="polite" className="rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-bg shadow-soft">
        {message}
      </div>
    </div>
  );
}
