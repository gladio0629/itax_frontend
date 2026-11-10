import type { ReactNode } from "react";

type Props = {
  title?: string;
  right?: ReactNode;
};

// The back arrow itself is owned by AppShell (a 44px floating control at
// safe-top + 16px). This header occupies that same 44px row so the title is
// vertically centred on the arrow, and its 8px bottom margin starts content
// below the arrow instead of beside it.
export function ScreenHeader({ title, right }: Props) {
  return (
    <div
      className="mb-2 flex h-11 shrink-0 items-center gap-2 pl-[60px] pr-4"
      style={{ marginTop: "calc(var(--safe-top) + 16px)" }}
    >
      <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink">{title}</h1>
      <div className="flex min-w-[44px] justify-end">{right}</div>
    </div>
  );
}
