import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Right-side detail drawer shared by Drivers/Passengers/Orders tables. */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={onClose} />
      <div className="relative h-full w-[420px] overflow-y-auto bg-card p-6 shadow-2xl animate-fade-in">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-lg font-semibold text-ink">{title}</p>
          <button onClick={onClose} aria-label="Yopish" className="rounded-full p-1.5 hover:bg-ink/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
