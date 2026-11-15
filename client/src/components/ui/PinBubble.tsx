import type { ReactNode } from "react";

/** Map pin bubble: white rounded bubble, small yellow icon square, two lines
 * ("Olib ketish / ~7 daq"). Radius 17, icon 40 / radius 11 (measured). */
export function PinBubble({ icon, caption, value }: { icon: ReactNode; caption: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-bubble bg-card py-1.5 pl-1.5 pr-4 shadow-[0_2px_12px_rgba(0,0,0,0.16)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-yellow text-on-yellow" aria-hidden="true">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block text-sub text-ink/70">{caption}</span>
        <span className="block text-control font-semibold text-ink tabular">{value}</span>
      </span>
    </div>
  );
}
