import type { ReactNode } from "react";

/**
 * Title row for top-level screens. Shares the 44px row (safe-top + 16px) with
 * AppShell's floating hamburger, so the title is vertically centred on it and
 * content below starts 8px under the hamburger rather than beside it.
 */
export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div
      className="mb-2 flex h-11 shrink-0 items-center justify-between gap-2 pl-[68px] pr-4"
      style={{ marginTop: "calc(var(--safe-top) + 16px)" }}
    >
      <h1 className="min-w-0 truncate text-lg font-semibold text-ink">{children}</h1>
      {right}
    </div>
  );
}
