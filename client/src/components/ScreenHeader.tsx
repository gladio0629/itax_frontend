import type { ReactNode } from "react";

type Props = {
  title?: string;
  right?: ReactNode;
};

// The back arrow itself is owned by AppShell (same floating, no-backdrop
// control that shows the hamburger on top-level screens) — this header
// only reserves the matching space so the title stays centered and never
// sits under it.
export function ScreenHeader({ title, right }: Props) {
  return (
    <div
      className="flex items-center justify-between pl-16 pr-4 pb-2"
      style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}
    >
      {title && <h1 className="flex-1 text-center text-sm font-semibold text-ink">{title}</h1>}
      <div className="flex min-w-[44px] justify-end">{right}</div>
    </div>
  );
}
