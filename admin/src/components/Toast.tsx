import { useEffect } from "react";

// Renders inline — caller's screen root must have `position: relative`.
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center px-6 animate-slide-up">
      <div className="rounded-2xl bg-ink px-4 py-2.5 text-xs font-medium text-white shadow-soft">{message}</div>
    </div>
  );
}
